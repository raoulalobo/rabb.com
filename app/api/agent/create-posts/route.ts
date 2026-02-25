/**
 * @file app/api/agent/create-posts/route.ts
 * @description Route Handler : génération de N posts (un par plateforme) depuis une instruction libre.
 *
 *   Reçoit l'instruction de l'utilisateur + le pool de médias disponibles.
 *   Charge les plateformes connectées de l'user.
 *   Appelle Claude Sonnet avec le tool "create_posts_per_platform".
 *   Claude produit un PostDraft par plateforme mentionnée dans l'instruction.
 *   Persiste chaque PostDraft comme un Post DRAFT ou SCHEDULED en DB.
 *   Déclenche un event Inngest "post/schedule" pour chaque post SCHEDULED.
 *   Retourne les posts créés.
 *
 *   Flow complet :
 *   1. Authentification (better-auth)
 *   2. Validation Zod du body (instruction + mediaPool)
 *   3. Chargement des plateformes connectées de l'utilisateur
 *   4. Appel Claude Sonnet → tool_use "create_posts_per_platform"
 *   5. Extraction + validation des PostDraft depuis le tool_use
 *   6. Création en DB : prisma.post.createMany() avec status DRAFT ou SCHEDULED
 *   7. Envoi des events Inngest "post/schedule" pour chaque post SCHEDULED
 *   8. Retour { posts: Post[] }
 *
 * @example
 *   const res = await fetch('/api/agent/create-posts', {
 *     method: 'POST',
 *     body: JSON.stringify({
 *       instruction: 'Poste mes 2 photos sur TikTok et Instagram demain 9h',
 *       mediaPool: [
 *         { url: 'https://...photo1.jpg', type: 'photo', filename: 'photo1.jpg' },
 *         { url: 'https://...photo2.jpg', type: 'photo', filename: 'photo2.jpg' },
 *       ],
 *     }),
 *   })
 *   const { posts } = await res.json()
 *   // posts = [{ id, platform: 'tiktok', text: '...', ... }, { id, platform: 'instagram', text: '...', ... }]
 */

import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import { z } from 'zod'

import { anthropic, AGENT_MODEL } from '@/lib/ai'
import { auth } from '@/lib/auth'
import { inngest } from '@/lib/inngest/client'
import { prisma } from '@/lib/prisma'
import { PLATFORM_RULES } from '@/modules/platforms/config/platform-rules'
import type { PoolMedia, PostDraft } from '@/modules/posts/types'

// ─── Schémas de validation du body ────────────────────────────────────────────

/** Schéma d'un média dans le pool */
const PoolMediaSchema = z.object({
  url: z.string().url(),
  type: z.enum(['photo', 'video']),
  filename: z.string(),
})

/** Schéma du body de la requête */
const CreatePostsRequestSchema = z.object({
  /** Instruction en langage naturel de l'utilisateur */
  instruction: z.string().min(1, 'Instruction requise').max(2000),
  /** Pool de médias uploadés disponibles pour l'agent */
  mediaPool: z.array(PoolMediaSchema).max(50).default([]),
})

// ─── Schéma de validation du résultat du tool Claude ──────────────────────────

/** Schéma d'un PostDraft tel que Claude doit le retourner */
const PostDraftSchema = z.object({
  platform: z.string().min(1),
  text: z.string().min(1).max(63206),
  mediaUrls: z.array(z.string()).default([]),
  scheduledFor: z.string().nullable().default(null),
})

const CreatePostsToolOutputSchema = z.object({
  posts: z.array(PostDraftSchema).min(1),
})

// ─── Tool Claude : create_posts_per_platform ──────────────────────────────────

/**
 * Définition du tool Anthropic que Claude doit utiliser.
 * Claude remplit ce tool avec un post par plateforme ciblée par l'instruction.
 */
const CREATE_POSTS_TOOL: Parameters<typeof anthropic.messages.create>[0]['tools'] = [
  {
    name: 'create_posts_per_platform',
    description: [
      'Crée un post adapté pour chaque plateforme sociale mentionnée dans l\'instruction.',
      'Respecte STRICTEMENT les contraintes techniques de chaque réseau (maxText, maxPhotos, etc.).',
      'Adapte le texte au ton de chaque plateforme.',
      'Sélectionne les médias appropriés depuis le pool disponible.',
      'Déduit les dates de publication depuis les instructions (ex: "demain matin" → ISO date).',
    ].join(' '),
    input_schema: {
      type: 'object' as const,
      properties: {
        posts: {
          type: 'array',
          description: 'Un post par plateforme ciblée par l\'instruction',
          items: {
            type: 'object',
            properties: {
              platform: {
                type: 'string',
                description: 'Identifiant de la plateforme (ex: "instagram", "tiktok")',
              },
              text: {
                type: 'string',
                description: 'Texte adapté au ton et aux contraintes de caractères de la plateforme',
              },
              mediaUrls: {
                type: 'array',
                items: { type: 'string' },
                description: 'URLs des médias sélectionnés depuis le pool (respecter les limites de la plateforme)',
              },
              scheduledFor: {
                type: 'string',
                // Exemple dynamique : demain à cette heure (toujours dans le futur)
                description: `Date/heure de publication en ISO 8601 UTC (ex: "${new Date(Date.now() + 86_400_000).toISOString()}"). null si pas de date précisée. Doit être strictement dans le futur par rapport à l'horodatage fourni dans le system prompt.`,
                nullable: true,
              },
            },
            required: ['platform', 'text', 'mediaUrls', 'scheduledFor'],
          },
        },
      },
      required: ['posts'],
    },
  },
]

// ─── Construction du system prompt ────────────────────────────────────────────

/**
 * Construit le system prompt de l'agent avec :
 * - La date/heure actuelle (pour interpréter "demain", "lundi prochain", etc.)
 * - Les plateformes connectées de l'utilisateur et leurs règles
 * - Le pool de médias disponibles avec leurs types
 *
 * @param connectedPlatforms - Plateformes connectées de l'utilisateur (depuis la DB)
 * @param mediaPool - Pool de médias uploadés par l'utilisateur
 * @returns System prompt complet
 */
function buildSystemPrompt(
  connectedPlatforms: Array<{ platform: string; accountName: string }>,
  mediaPool: PoolMedia[],
): string {
  const now = new Date()
  const dateStr = now.toLocaleString('fr-FR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Paris',
  })

  // Section plateformes connectées avec leurs règles techniques
  const platformsSection = connectedPlatforms
    .map(({ platform, accountName }) => {
      const rules = PLATFORM_RULES[platform as keyof typeof PLATFORM_RULES]
      if (!rules) return `- ${platform} (@${accountName}) : règles inconnues`

      const rulesParts: string[] = [
        `max ${rules.maxText.toLocaleString('fr-FR')} caractères`,
        rules.maxPhotos > 0 ? `max ${rules.maxPhotos} photo(s)` : 'photos non supportées',
        rules.maxVideos > 0 ? `max ${rules.maxVideos} vidéo(s)` : 'vidéo non supportée',
        rules.allowsMixed ? 'photos+vidéo dans le même post OK' : 'photos et vidéo séparées',
        rules.requiresMedia ? '⚠ média obligatoire' : '',
      ].filter(Boolean)

      return `- **${platform}** (compte : ${accountName}) : ${rulesParts.join(', ')}`
    })
    .join('\n')

  // Section pool de médias
  const photos = mediaPool.filter((m) => m.type === 'photo')
  const videos = mediaPool.filter((m) => m.type === 'video')
  const mediaSection = mediaPool.length === 0
    ? 'Aucun média dans le pool.'
    : [
        photos.length > 0 ? `Photos (${photos.length}) :` : '',
        ...photos.map((m, i) => `  ${i + 1}. ${m.url} (${m.filename})`),
        videos.length > 0 ? `Vidéos (${videos.length}) :` : '',
        ...videos.map((m, i) => `  ${i + 1}. ${m.url} (${m.filename})`),
      ].filter(Boolean).join('\n')

  return `Tu es un expert en social media chargé de créer du contenu adapté à chaque plateforme.

## Date et heure actuelles
${dateStr} (fuseau Europe/Paris)
Horodatage ISO UTC exact : ${now.toISOString()}
Utilise cet horodatage comme référence absolue pour calculer les expressions temporelles
("dans 10 minutes", "demain matin", "lundi prochain", etc.).
Toutes les dates de publication dans le tool doivent être en ISO 8601 UTC.

## Plateformes connectées de l'utilisateur
${platformsSection}

## Pool de médias disponibles
${mediaSection}

## Règles impératives
1. Crée UN post par plateforme mentionnée dans l'instruction de l'utilisateur.
2. Si l'utilisateur ne précise pas de plateformes, crée un post pour CHAQUE plateforme connectée.
3. Respecte STRICTEMENT les limites de chaque plateforme (caractères, nombre de médias, types autorisés).
4. Si une plateforme a une limite de 4 photos et le pool en contient 6 : sélectionne les 4 premières.
5. Si une plateforme ne supporte pas les vidéos (ex: google_business) : n'inclus que des photos.
6. Adapte le ton : LinkedIn professionnel, TikTok/Instagram créatif et accessible, Twitter concis.
7. Si l'utilisateur précise une heure ou un jour, calcule la date ISO exacte.
8. Si aucune date n'est précisée : scheduledFor = null (brouillon, pas de date de publication).
9. Si aucun média n'est dans le pool : mediaUrls = [] (ne pas inventer d'URLs).
10. Si l'utilisateur dit "maintenant", "tout de suite", "immédiatement" ou similaire :
    scheduledFor = horodatage ISO UTC exact + 120 secondes
    (ex: "${new Date(Date.now() + 120_000).toISOString()}")
    Ce buffer de 2 min garantit que la date est encore dans le futur lors de la validation en DB.`
}

// ─── Handler POST ─────────────────────────────────────────────────────────────

/**
 * POST /api/agent/create-posts
 * Body : { instruction: string, mediaPool: PoolMedia[] }
 * Réponse : { posts: Post[] }
 *
 * Crée N posts DRAFT en DB — un par plateforme ciblée par l'instruction.
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

  const parsed = CreatePostsRequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Données invalides' },
      { status: 400 },
    )
  }

  const { instruction, mediaPool } = parsed.data

  // ── Récupération des plateformes connectées ───────────────────────────────
  // Ownership check : on ne lit que les plateformes de l'utilisateur connecté
  const connectedPlatforms = await prisma.connectedPlatform.findMany({
    where: { userId: session.user.id, isActive: true },
    select: { platform: true, accountName: true },
    orderBy: { connectedAt: 'asc' },
  })

  if (connectedPlatforms.length === 0) {
    return NextResponse.json(
      { error: 'Aucune plateforme connectée. Connectez au moins un réseau dans les paramètres.' },
      { status: 422 },
    )
  }

  // ── Appel Claude Sonnet ───────────────────────────────────────────────────
  try {
    const systemPrompt = buildSystemPrompt(connectedPlatforms, mediaPool)

    const response = await anthropic.messages.create({
      model: AGENT_MODEL,
      max_tokens: 4096,
      system: systemPrompt,
      // Forcer Claude à utiliser le tool (pas de réponse texte libre)
      tool_choice: { type: 'any' },
      tools: CREATE_POSTS_TOOL,
      messages: [{ role: 'user', content: instruction }],
    })

    // ── Extraction du résultat du tool ──────────────────────────────────────
    const toolUseBlock = response.content.find((block) => block.type === 'tool_use')
    if (!toolUseBlock || toolUseBlock.type !== 'tool_use') {
      console.error('[create-posts] Claude n\'a pas appelé le tool :', response.content)
      return NextResponse.json(
        { error: 'L\'agent n\'a pas pu générer les posts. Veuillez réessayer.' },
        { status: 500 },
      )
    }

    // ── Validation du résultat du tool ──────────────────────────────────────
    // Le tool_use.input est parsé automatiquement par le SDK comme Record<string, unknown>
    const toolOutputParsed = CreatePostsToolOutputSchema.safeParse(toolUseBlock.input)
    if (!toolOutputParsed.success) {
      console.error('[create-posts] Résultat tool invalide :', toolUseBlock.input)
      return NextResponse.json(
        { error: 'L\'agent a retourné un format inattendu. Veuillez réessayer.' },
        { status: 500 },
      )
    }

    const postDrafts: PostDraft[] = toolOutputParsed.data.posts

    // ── Création des posts en DB ────────────────────────────────────────────
    // createMany crée tous les posts en une seule transaction (atomique)
    await prisma.post.createMany({
      data: postDrafts.map((draft) => {
        // Calculer la date et le statut pour chaque post
        const scheduledDate = draft.scheduledFor ? new Date(draft.scheduledFor) : null
        const isValidFutureDate = scheduledDate !== null
          && !isNaN(scheduledDate.getTime())
          && scheduledDate > new Date()

        return {
          userId: session.user.id,
          platform: draft.platform,
          text: draft.text,
          // Filtrer les URLs vides ou invalides (protection défensive)
          mediaUrls: draft.mediaUrls.filter((url) => url.startsWith('http')),
          scheduledFor: isValidFutureDate ? scheduledDate : null,
          // Status SCHEDULED si date valide dans le futur, DRAFT sinon
          status: isValidFutureDate ? ('SCHEDULED' as const) : ('DRAFT' as const),
        }
      }),
    })

    // ── Récupération des posts créés pour la réponse ────────────────────────
    // On récupère les posts récemment créés (triés par création décroissante)
    // pour pouvoir retourner leur ID à l'UI
    const createdPosts = await prisma.post.findMany({
      where: {
        userId: session.user.id,
        // Filtre temporel : posts créés dans les 10 dernières secondes
        // (évite de retourner d'anciens posts si createMany échouait silencieusement)
        createdAt: { gte: new Date(Date.now() - 10_000) },
      },
      orderBy: { createdAt: 'desc' },
      take: postDrafts.length,
    })

    // ── Déclenchement des events Inngest pour les posts planifiés ──────────
    // Filtre uniquement les posts avec status SCHEDULED (date valide dans le futur).
    // Les posts DRAFT (scheduledFor = null) ne déclenchent pas d'event.
    const scheduledPosts = createdPosts.filter((p) => p.status === 'SCHEDULED')
    if (scheduledPosts.length > 0) {
      // Si INNGEST_EVENT_KEY n'est pas défini (env local sans clé), on skip
      // l'envoi d'events pour ne pas bloquer les tests. En production la clé
      // est obligatoire et l'erreur remontera normalement.
      if (!process.env.INNGEST_EVENT_KEY) {
        console.warn(
          '[create-posts] INNGEST_EVENT_KEY non défini — envoi des events Inngest ignoré (mode local).',
          `${scheduledPosts.length} post(s) planifié(s) concerné(s).`,
        )
      } else {
        try {
          await Promise.all(
            scheduledPosts.map((post) =>
              inngest.send({
                name: 'post/schedule',
                data: {
                  // ID du post en DB pour que la fonction Inngest puisse le retrouver
                  postId: post.id,
                  // scheduledFor est forcément non-null ici (filtré par status SCHEDULED)
                  scheduledFor: post.scheduledFor!.toISOString(),
                },
              }),
            ),
          )
        } catch (inngestError) {
          // En cas d'erreur Inngest (ex: clé invalide, service indisponible),
          // on log sans faire crasher la route — les posts sont déjà sauvegardés en DB.
          console.error(
            '[create-posts] Échec envoi event(s) Inngest (posts déjà sauvegardés en DB) :',
            inngestError,
          )
        }
      }
    }

    return NextResponse.json({ posts: createdPosts })
  } catch (error) {
    console.error('[create-posts] Erreur :', error)
    return NextResponse.json(
      { error: 'Erreur lors de la génération des posts. Veuillez réessayer.' },
      { status: 500 },
    )
  }
}
