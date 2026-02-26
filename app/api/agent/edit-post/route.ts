/**
 * @file app/api/agent/edit-post/route.ts
 * @description Route Handler : édition d'un post existant via une instruction libre.
 *
 *   Reçoit le postId, une instruction de modification et un pool de médias optionnel.
 *   Charge le post courant (ownership check).
 *   Appelle Claude Sonnet avec le contenu actuel + les règles de la plateforme.
 *   Claude retourne le texte mis à jour + les médias sélectionnés.
 *   Met à jour le post en DB.
 *   Retourne le post mis à jour.
 *
 *   Flow complet :
 *   1. Authentification (better-auth)
 *   2. Validation Zod du body (postId + instruction + mediaPool optionnel)
 *   3. Chargement du post avec ownership check (where: { id, userId })
 *   4. Appel Claude Sonnet → tool_use "edit_post"
 *      - Context : texte actuel + plateforme + règles
 *   5. Extraction + mise à jour en DB
 *   6. revalidatePath('/compose') + revalidatePath('/calendar')
 *   7. Retour { post: Post }
 *
 * @example
 *   const res = await fetch('/api/agent/edit-post', {
 *     method: 'POST',
 *     body: JSON.stringify({
 *       postId: 'clx...',
 *       instruction: 'Rends le texte plus engageant et ajoute 3 hashtags',
 *       mediaPool: [],  // optionnel
 *     }),
 *   })
 *   const { post } = await res.json()
 */

import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { NextResponse } from 'next/server'
import { z } from 'zod'

import { anthropic, AGENT_MODEL } from '@/lib/ai'
import { auth } from '@/lib/auth'
import { inngest } from '@/lib/inngest/client'
import { prisma } from '@/lib/prisma'
import { PLATFORM_RULES } from '@/modules/platforms/config/platform-rules'

// ─── Schémas de validation du body ────────────────────────────────────────────

/** Schéma d'un média dans le pool (optionnel pour l'édition) */
const PoolMediaSchema = z.object({
  url: z.string().url(),
  type: z.enum(['photo', 'video']),
  filename: z.string(),
})

/** Schéma du body de la requête d'édition */
const EditPostRequestSchema = z.object({
  /** ID du post à modifier (doit appartenir à l'utilisateur connecté) */
  postId: z.string().min(1, 'ID du post requis'),
  /** Instruction libre de modification (ex: "rends le texte plus court") */
  instruction: z.string().min(1, 'Instruction requise').max(2000),
  /** Pool de médias disponibles (optionnel — si fourni, l'agent peut remplacer les médias) */
  mediaPool: z.array(PoolMediaSchema).max(50).default([]),
})

// ─── Schéma de validation du résultat du tool Claude ──────────────────────────

/** Schéma du résultat du tool edit_post retourné par Claude */
const EditPostToolOutputSchema = z.object({
  text: z.string().min(1).max(63206),
  mediaUrls: z.array(z.string()).default([]),
  scheduledFor: z.string().nullable().default(null),
})

// ─── Tool Claude : edit_post ──────────────────────────────────────────────────

/**
 * Définition du tool Anthropic pour l'édition d'un post.
 * Claude remplit ce tool avec le contenu mis à jour du post.
 */
const EDIT_POST_TOOL: Parameters<typeof anthropic.messages.create>[0]['tools'] = [
  {
    name: 'edit_post',
    description: [
      'Met à jour le contenu d\'un post existant selon l\'instruction de l\'utilisateur.',
      'Respecte STRICTEMENT les contraintes de la plateforme cible (maxText, maxPhotos, etc.).',
      'Conserve les médias actuels sauf si l\'instruction demande de les remplacer.',
      'Retourne le texte mis à jour, les médias sélectionnés et la date de publication.',
    ].join(' '),
    input_schema: {
      type: 'object' as const,
      properties: {
        text: {
          type: 'string',
          description: 'Texte mis à jour, adapté aux contraintes de la plateforme',
        },
        mediaUrls: {
          type: 'array',
          items: { type: 'string' },
          description: 'URLs des médias à inclure dans le post (depuis les médias actuels ou le nouveau pool)',
        },
        scheduledFor: {
          type: 'string',
          description: 'Date/heure de publication en ISO 8601. null si pas de date précisée.',
          nullable: true,
        },
      },
      required: ['text', 'mediaUrls', 'scheduledFor'],
    },
  },
]

// ─── Handler POST ─────────────────────────────────────────────────────────────

/**
 * POST /api/agent/edit-post
 * Body : { postId: string, instruction: string, mediaPool?: PoolMedia[] }
 * Réponse : { post: Post }
 *
 * Modifie un post existant selon l'instruction et retourne le post mis à jour.
 */
export async function POST(request: Request): Promise<NextResponse> {
  // ── Vérification de la configuration Anthropic ────────────────────────────
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: 'ANTHROPIC_API_KEY manquante dans .env.local — agent désactivé' },
      { status: 503 },
    )
  }

  // ── Authentification ──────────────────────────────────────────────────────
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  // ── Validation du body ────────────────────────────────────────────────────
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body JSON invalide' }, { status: 400 })
  }

  const parsed = EditPostRequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Données invalides' },
      { status: 400 },
    )
  }

  const { postId, instruction, mediaPool } = parsed.data

  // ── Chargement du post avec ownership check ───────────────────────────────
  // Le filtre userId garantit que l'utilisateur ne peut éditer que ses propres posts
  const post = await prisma.post.findFirst({
    where: { id: postId, userId: session.user.id },
    select: {
      id: true,
      platform: true,
      text: true,
      mediaUrls: true,
      scheduledFor: true,
      status: true,
    },
  })

  if (!post) {
    return NextResponse.json({ error: 'Post introuvable ou non autorisé' }, { status: 404 })
  }

  // Seuls les posts PUBLISHED sont en lecture seule.
  // Les posts FAILED peuvent être modifiés (retry propre).
  if (post.status === 'PUBLISHED') {
    return NextResponse.json(
      { error: 'Ce post ne peut plus être modifié (déjà publié)' },
      { status: 409 },
    )
  }

  // ── Construction du contexte pour Claude ──────────────────────────────────
  const rules = PLATFORM_RULES[post.platform as keyof typeof PLATFORM_RULES]
  const rulesDescription = rules
    ? [
        `- Max ${rules.maxText.toLocaleString('fr-FR')} caractères`,
        rules.maxPhotos > 0 ? `- Max ${rules.maxPhotos} photo(s)` : '- Photos non supportées',
        rules.maxVideos > 0 ? `- Max ${rules.maxVideos} vidéo(s)` : '- Vidéo non supportée',
        rules.requiresMedia ? '- Média obligatoire' : '',
      ].filter(Boolean).join('\n')
    : 'Règles inconnues pour cette plateforme'

  // Médias disponibles = médias actuels du post + nouveau pool (si fourni)
  const allAvailableMediaUrls = [
    ...new Set([...post.mediaUrls, ...mediaPool.map((m) => m.url)]),
  ]

  // Date actuelle transmise à Claude pour qu'il génère des dates FUTURES correctes.
  // Sans cette information, Claude utilise son année de référence interne (souvent passée)
  // et génère des dates invalides → isValidFutureDate = false → scheduledFor = null.
  const now = new Date()
  const nowIso = now.toISOString()

  const systemPrompt = `Tu es un expert en social media. Tu dois modifier un post existant selon les instructions de l'utilisateur.

## Date et heure actuelles
${nowIso} — Utilise cette date comme référence pour toutes les dates relatives ("demain", "la semaine prochaine", "le 1er mars", etc.).
Toutes les dates que tu génères pour scheduledFor DOIVENT être dans le futur (après ${nowIso}).

## Post actuel
- Plateforme : **${post.platform}**
- Texte : "${post.text}"
- Médias actuels : ${post.mediaUrls.length > 0 ? post.mediaUrls.join(', ') : 'aucun'}
- Date de publication : ${post.scheduledFor ? post.scheduledFor.toISOString() : 'pas de date (brouillon)'}

## Contraintes de la plateforme ${post.platform}
${rulesDescription}

## Médias disponibles
${allAvailableMediaUrls.length > 0 ? allAvailableMediaUrls.join('\n') : 'Aucun média disponible'}

## Règles
1. Modifie uniquement ce qui est demandé dans l'instruction.
2. Respecte STRICTEMENT les limites de caractères de la plateforme.
3. Si l'instruction ne mentionne pas les médias, conserve les médias actuels.
4. Si l'instruction mentionne une date, génère une date ISO 8601 strictement future dans scheduledFor.
5. Si l'instruction ne mentionne pas de date, recopie la date actuelle (ou null si pas de date).
6. Retourne le texte complet (pas seulement les modifications).`

  // ── Appel Claude Sonnet ───────────────────────────────────────────────────
  try {
    const response = await anthropic.messages.create({
      model: AGENT_MODEL,
      max_tokens: 2048,
      system: systemPrompt,
      tool_choice: { type: 'any' },
      tools: EDIT_POST_TOOL,
      messages: [{ role: 'user', content: instruction }],
    })

    // ── Extraction du résultat du tool ──────────────────────────────────────
    const toolUseBlock = response.content.find((block) => block.type === 'tool_use')
    if (!toolUseBlock || toolUseBlock.type !== 'tool_use') {
      console.error('[edit-post] Claude n\'a pas appelé le tool :', response.content)
      return NextResponse.json(
        { error: 'L\'agent n\'a pas pu modifier le post. Veuillez réessayer.' },
        { status: 500 },
      )
    }

    // ── Validation du résultat du tool ──────────────────────────────────────
    const toolOutputParsed = EditPostToolOutputSchema.safeParse(toolUseBlock.input)
    if (!toolOutputParsed.success) {
      console.error('[edit-post] Résultat tool invalide :', toolUseBlock.input)
      return NextResponse.json(
        { error: 'L\'agent a retourné un format inattendu. Veuillez réessayer.' },
        { status: 500 },
      )
    }

    const { text, mediaUrls, scheduledFor: newScheduledForStr } = toolOutputParsed.data

    // ── Calcul de la date et du statut résultant ──────────────────────────
    const newScheduledDate = newScheduledForStr ? new Date(newScheduledForStr) : null
    const isValidFutureDate = newScheduledDate !== null
      && !isNaN(newScheduledDate.getTime())
      && newScheduledDate > now   // `now` défini plus haut — cohérence avec le prompt

    // Statut précédent du post (pour détecter une transition DRAFT → SCHEDULED)
    const previousStatus = post.status
    const newStatus = isValidFutureDate ? 'SCHEDULED' : 'DRAFT'

    // ── Mise à jour en DB ─────────────────────────────────────────────────
    const updatedPost = await prisma.post.update({
      where: { id: postId },
      data: {
        text,
        // Filtrer les URLs vides ou invalides avant persistance
        mediaUrls: mediaUrls.filter((url) => url.startsWith('http')),
        scheduledFor: isValidFutureDate ? newScheduledDate : null,
        status: newStatus,
        // Réinitialiser les champs de publication si on replanifie
        latePostId: null,
        failureReason: null,
        publishedAt: null,
      },
    })

    // ── Event Inngest : déclencher la publication si nouvelle date assignée ──
    // Opération non-bloquante : un échec Inngest (ex: dev server non démarré)
    // ne doit PAS faire échouer la sauvegarde du post déjà persistée en DB.
    // Cas couverts :
    // - DRAFT → SCHEDULED (nouvelle date assignée via l'agent)
    // - SCHEDULED → SCHEDULED (replanification : annule l'ancien run puis crée le nouveau)
    if (isValidFutureDate && newScheduledDate) {
      if (!process.env.INNGEST_EVENT_KEY) {
        // En local sans clé Inngest, on skip l'envoi — pas de scheduling à déclencher.
        console.warn('[edit-post] INNGEST_EVENT_KEY non défini — envoi Inngest ignoré (mode local).')
      } else {
        try {
          // Annuler l'éventuel run Inngest précédent avant d'en créer un nouveau
          // pour éviter deux runs concurrents sur le même post lors d'une replanification.
          if (previousStatus === 'SCHEDULED') {
            await inngest.send({ name: 'post/cancel', data: { postId } })
          }

          await inngest.send({
            name: 'post/schedule',
            data: {
              postId,
              scheduledFor: newScheduledDate.toISOString(),
            },
          })
        } catch (inngestError) {
          // Log sans faire échouer la requête — le post est déjà sauvé en DB.
          // L'utilisateur pourra replanifier manuellement si nécessaire.
          console.error('[edit-post] Inngest send échoué (non-bloquant) :', inngestError)
        }
      }
    }

    // ── Invalidation du cache ─────────────────────────────────────────────
    revalidatePath('/compose')
    revalidatePath('/calendar')
    revalidatePath('/kanban')

    return NextResponse.json({ post: updatedPost })
  } catch (error) {
    // Logger l'erreur réelle (visible dans les logs serveur / Vercel)
    const message = error instanceof Error ? error.message : String(error)
    console.error('[edit-post] Erreur :', message, error)
    return NextResponse.json(
      { error: `Erreur lors de la modification du post : ${message}` },
      { status: 500 },
    )
  }
}
