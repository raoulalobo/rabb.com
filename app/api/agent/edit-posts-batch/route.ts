/**
 * @file app/api/agent/edit-posts-batch/route.ts
 * @description Route Handler : édition en masse de posts via une instruction libre.
 *
 *   Reçoit un tableau de postIds + une instruction en langage naturel.
 *   Charge le contenu actuel de chaque post (ownership check).
 *   Appelle Claude avec le contenu de TOUS les posts + l'instruction.
 *   Claude retourne des modifications proposées pour chaque post.
 *   N'écrit PAS en DB — retourne uniquement les propositions pour review.
 *   La confirmation passe ensuite par la Server Action bulk-apply-edits.
 *
 *   Flow :
 *   1. Authentification (better-auth)
 *   2. Validation Zod du body (BulkEditBatchSchema)
 *   3. Chargement de chaque post avec ownership check (where: { id in postIds, userId })
 *   4. Exclusion des posts PUBLISHED (en lecture seule)
 *   5. Construction du contexte complet (chaque post + ses règles plateforme)
 *   6. Appel Claude → tool_use "edit_posts_batch"
 *   7. Validation de chaque ProposedEdit avec ProposedEditSchema
 *   8. Retour { edits: ProposedEdit[] }
 *
 * @example
 *   const res = await fetch('/api/agent/edit-posts-batch', {
 *     method: 'POST',
 *     body: JSON.stringify({
 *       postIds: ['abc123', 'def456'],
 *       instruction: 'Ajoute #promo2026 à chaque post et reprogramme pour demain 9h',
 *     }),
 *   })
 *   const { edits } = await res.json()
 *   // edits[0] = { postId, text, mediaUrls, scheduledFor } — pas encore en DB
 */

import { headers } from 'next/headers'
import { NextResponse } from 'next/server'

import Anthropic from '@anthropic-ai/sdk'

import { callAnthropicWithFallback, AGENT_MODEL, ANTHROPIC_OVERLOADED_STATUS, ANTHROPIC_SERVER_ERROR_STATUS } from '@/lib/ai'
import { auth } from '@/lib/auth'
import { rateLimiters, rateLimitResponse } from '@/lib/rate-limit'
import { prisma } from '@/lib/prisma'
import { PLATFORM_RULES } from '@/modules/platforms/config/platform-rules'
import { BulkEditBatchSchema, ProposedEditSchema } from '@/modules/posts/schemas/post.schema'
import type { ProposedEdit } from '@/modules/posts/schemas/post.schema'

// ─── Tool Claude : edit_posts_batch ──────────────────────────────────────────

/**
 * Définition du tool Anthropic pour l'édition en masse de posts.
 * Claude remplit ce tool avec un tableau de modifications — une par post.
 * Chaque entrée contient le postId + le nouveau contenu complet.
 */
const EDIT_POSTS_BATCH_TOOL: Parameters<typeof callAnthropicWithFallback>[0]['tools'] = [
  {
    name: 'edit_posts_batch',
    description: [
      'Met à jour le contenu de plusieurs posts existants selon l\'instruction de l\'utilisateur.',
      'Pour CHAQUE post fourni, retourne une entrée dans le tableau "edits" avec :',
      '- postId : identique à celui reçu en entrée (ne pas modifier)',
      '- text : texte mis à jour selon l\'instruction, dans les limites de la plateforme',
      '- mediaUrls : tableau des URLs des médias à conserver (copier depuis les médias actuels sauf si l\'instruction demande de les modifier)',
      '- scheduledFor : date ISO 8601 strictement future si une date est mentionnée, sinon reprendre la date actuelle du post (ou null si le post n\'avait pas de date)',
    ].join(' '),
    input_schema: {
      type: 'object' as const,
      properties: {
        edits: {
          type: 'array',
          description: 'Une entrée par post — même nombre d\'entrées que les posts fournis',
          items: {
            type: 'object',
            properties: {
              postId: {
                type: 'string',
                description: 'ID du post (copier exactement depuis le contexte)',
              },
              text: {
                type: 'string',
                description: 'Texte mis à jour, adapté aux contraintes de la plateforme',
              },
              mediaUrls: {
                type: 'array',
                items: { type: 'string' },
                description: 'URLs des médias à inclure (conserver les actuels sauf si demande explicite)',
              },
              scheduledFor: {
                type: 'string',
                description: 'Date/heure de publication en ISO 8601. null si aucune date.',
                nullable: true,
              },
            },
            required: ['postId', 'text', 'mediaUrls', 'scheduledFor'],
          },
        },
      },
      required: ['edits'],
    },
  },
]

// ─── Handler POST ─────────────────────────────────────────────────────────────

/**
 * POST /api/agent/edit-posts-batch
 * Body : { postIds: string[], instruction: string }
 * Réponse : { edits: ProposedEdit[] }
 *
 * Génère des modifications proposées pour chaque post sans écrire en DB.
 * L'utilisateur confirme via la phase preview (AgentModalBulkEdit) avant application.
 */
export async function POST(request: Request): Promise<NextResponse> {
  // ── Vérification de la configuration Anthropic ─────────────────────────────
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: 'ANTHROPIC_API_KEY manquante dans .env.local — agent désactivé' },
      { status: 503 },
    )
  }

  // ── Authentification ───────────────────────────────────────────────────────
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  // ── Rate limiting ──────────────────────────────────────────────────────────
  // Limite à 10 req/min par userId — le batch consomme plus de tokens que l'édition simple
  const rl = await rateLimiters.ai(session.user.id)
  if (!rl.success) return rateLimitResponse(rl.reset)

  // ── Validation du body ─────────────────────────────────────────────────────
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body JSON invalide' }, { status: 400 })
  }

  const parsed = BulkEditBatchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Données invalides' },
      { status: 400 },
    )
  }

  const { postIds, instruction, mediaPool } = parsed.data

  // ── Chargement des posts avec ownership check ──────────────────────────────
  // Le filtre userId garantit que l'utilisateur ne peut modifier que ses propres posts.
  // findMany retourne uniquement les posts trouvés (ownership implicite par le filtre).
  const posts = await prisma.post.findMany({
    where: { id: { in: postIds }, userId: session.user.id },
    select: {
      id: true,
      platform: true,
      text: true,
      mediaUrls: true,
      scheduledFor: true,
      status: true,
    },
  })

  if (posts.length === 0) {
    return NextResponse.json({ error: 'Aucun post trouvé ou non autorisé' }, { status: 404 })
  }

  // ── Exclure les posts PUBLISHED (en lecture seule) ─────────────────────────
  const editablePosts = posts.filter((p) => p.status !== 'PUBLISHED')
  if (editablePosts.length === 0) {
    return NextResponse.json(
      { error: 'Tous les posts sélectionnés sont déjà publiés et ne peuvent plus être modifiés' },
      { status: 409 },
    )
  }

  // ── Construction du contexte pour Claude ──────────────────────────────────
  // Date/heure actuelle transmise pour que Claude génère des dates FUTURES correctes.
  const now = new Date()
  const nowIso = now.toISOString()

  // Règles de chaque plateforme unique (dédupliquées pour éviter les répétitions)
  const uniquePlatforms = [...new Set(editablePosts.map((p) => p.platform))]
  const platformRulesSection = uniquePlatforms
    .map((platform) => {
      const rules = PLATFORM_RULES[platform as keyof typeof PLATFORM_RULES]
      if (!rules) return `### ${platform}\nRègles inconnues pour cette plateforme`
      return [
        `### ${platform}`,
        `- Max ${rules.maxText.toLocaleString('fr-FR')} caractères`,
        rules.maxPhotos > 0 ? `- Max ${rules.maxPhotos} photo(s)` : '- Photos non supportées',
        rules.maxVideos > 0 ? `- Max ${rules.maxVideos} vidéo(s)` : '- Vidéo non supportée',
        rules.requiresMedia ? '- Média obligatoire' : '',
      ]
        .filter(Boolean)
        .join('\n')
    })
    .join('\n\n')

  // Section détaillée de chaque post (contexte complet pour Claude)
  const postsSection = editablePosts
    .map(
      (post, index) =>
        `### Post ${index + 1} (ID: ${post.id})
- Plateforme : ${post.platform}
- Texte actuel : "${post.text}"
- Médias actuels : ${post.mediaUrls.length > 0 ? post.mediaUrls.join(', ') : 'aucun'}
- Date de publication : ${post.scheduledFor ? post.scheduledFor.toISOString() : 'pas de date (brouillon)'}
- Statut : ${post.status}`,
    )
    .join('\n\n')

  // Section décrivant le pool de médias partagés (vide ou non)
  // Transmise à Claude pour qu'il puisse distribuer les médias entre les posts si l'instruction le demande
  const mediaPoolSection =
    mediaPool.length === 0
      ? "Aucun nouveau média fourni par l'utilisateur."
      : mediaPool
          .map((m, i) => `${i + 1}. ${m.url} (${m.filename}, type: ${m.type})`)
          .join('\n')

  const systemPrompt = `Tu es un expert en social media. Tu dois modifier plusieurs posts selon une instruction unique appliquée à chacun.

## Date et heure actuelles
${nowIso} — Toutes les dates générées pour scheduledFor DOIVENT être strictement après ${nowIso}.
Si l'instruction mentionne "demain 9h", calcule "demain" par rapport à cette date actuelle.

## Règles par plateforme
${platformRulesSection}

## Posts à modifier (${editablePosts.length} posts)
${postsSection}

## Nouveaux médias disponibles dans le pool partagé
${mediaPoolSection}
Si l'instruction demande d'ajouter des médias à tout ou partie des posts, puise depuis ce pool.
Respecte les limites de chaque plateforme (maxPhotos, types autorisés).

## Règles importantes
1. Appliquer l'instruction à CHAQUE post individuellement.
2. Respecter les limites de caractères de CHAQUE plateforme.
3. Conserver les médias actuels de chaque post sauf si l'instruction demande de les modifier.
4. Si l'instruction mentionne une date (ex: "demain 9h"), générer une date ISO 8601 FUTURE dans scheduledFor pour tous les posts concernés.
5. Si l'instruction ne mentionne pas de date, conserver la date actuelle de chaque post (ou null si le post n'avait pas de date).
6. Retourner le texte COMPLET du post (pas seulement les modifications).
7. Le tableau "edits" doit contenir EXACTEMENT ${editablePosts.length} entrée(s) — une par post.`

  // ── Appel Claude ──────────────────────────────────────────────────────────
  try {
    // Appel via le wrapper : tente Sonnet, bascule sur Opus si 529 persistant
    const response = await callAnthropicWithFallback({
      model: AGENT_MODEL,
      // max_tokens élevé car on traite N posts en parallèle (chaque post peut avoir jusqu'à ~500 tokens)
      max_tokens: Math.min(4096, 1024 + editablePosts.length * 600),
      system: systemPrompt,
      tool_choice: { type: 'any' },
      tools: EDIT_POSTS_BATCH_TOOL,
      messages: [{ role: 'user', content: instruction }],
    })

    // ── Extraction du résultat du tool ─────────────────────────────────────
    const toolUseBlock = response.content.find((block) => block.type === 'tool_use')
    if (!toolUseBlock || toolUseBlock.type !== 'tool_use') {
      console.error('[edit-posts-batch] Claude n\'a pas appelé le tool :', response.content)
      return NextResponse.json(
        { error: 'L\'agent n\'a pas pu générer les modifications. Veuillez réessayer.' },
        { status: 500 },
      )
    }

    // ── Extraction et validation de chaque ProposedEdit ────────────────────
    // Le tool retourne { edits: [...] } — on valide chaque entrée avec ProposedEditSchema
    const rawEdits = (toolUseBlock.input as { edits?: unknown })?.edits
    if (!Array.isArray(rawEdits)) {
      console.error('[edit-posts-batch] Format inattendu du tool :', toolUseBlock.input)
      return NextResponse.json(
        { error: 'L\'agent a retourné un format inattendu. Veuillez réessayer.' },
        { status: 500 },
      )
    }

    // Valider chaque entrée individuellement — ignorer les entrées invalides avec un log
    const validEdits: ProposedEdit[] = []
    for (const rawEdit of rawEdits) {
      const editParsed = ProposedEditSchema.safeParse(rawEdit)
      if (editParsed.success) {
        // Vérifier que le postId correspond à l'un des posts demandés (sécurité)
        const matchingPost = editablePosts.find((p) => p.id === editParsed.data.postId)
        if (matchingPost) {
          validEdits.push(editParsed.data)
        } else {
          console.warn('[edit-posts-batch] postId inconnu ignoré :', editParsed.data.postId)
        }
      } else {
        console.warn('[edit-posts-batch] Entrée invalide ignorée :', rawEdit, editParsed.error)
      }
    }

    if (validEdits.length === 0) {
      return NextResponse.json(
        { error: 'L\'agent n\'a pas généré de modifications valides. Veuillez réessayer.' },
        { status: 500 },
      )
    }

    return NextResponse.json({ edits: validEdits })
  } catch (error) {
    // ── Erreur 529 : serveurs Anthropic surchargés ────────────────────────────
    if (error instanceof Anthropic.APIError && error.status === ANTHROPIC_OVERLOADED_STATUS) {
      console.warn('[edit-posts-batch] Anthropic overloaded (529) après 5 tentatives')
      return NextResponse.json(
        { error: 'Les serveurs Claude sont momentanément surchargés. Veuillez réessayer dans quelques instants.' },
        { status: 503 },
      )
    }

    // ── Erreur 500 : erreur interne côté Anthropic (x-should-retry: false) ─────
    if (error instanceof Anthropic.APIError && error.status === ANTHROPIC_SERVER_ERROR_STATUS) {
      console.warn('[edit-posts-batch] Anthropic internal server error (500) :', error.message)
      return NextResponse.json(
        { error: 'Une erreur interne est survenue du côté de Claude. Veuillez réessayer dans quelques instants.' },
        { status: 503 },
      )
    }

    const message = error instanceof Error ? error.message : String(error)
    console.error('[edit-posts-batch] Erreur :', message, error)
    return NextResponse.json(
      { error: `Erreur lors de la génération des modifications : ${message}` },
      { status: 500 },
    )
  }
}
