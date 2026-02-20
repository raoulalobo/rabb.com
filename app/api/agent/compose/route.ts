/**
 * @file app/api/agent/compose/route.ts
 * @description Route Handler : orchestration de l'agent Claude pour la planification de contenu.
 *
 *   Reçoit l'instruction de l'utilisateur + le pool de médias + éventuellement un sessionId.
 *   Appelle Claude Sonnet avec un tool unique "plan_content_per_platform".
 *   Claude remplit le tool avec un plan structuré : texte adapté + médias + date par plateforme.
 *   Retourne le plan à l'UI pour confirmation avant publication.
 *
 *   Supporte les conversations multi-tours grâce à sessionId :
 *   - Tour 1 : pas de sessionId → crée une nouvelle session en DB → retourne sessionId
 *   - Tour N+1 : sessionId fourni → charge l'historique → reconstruit les messages Anthropic
 *     → appelle Claude avec le contexte complet → met à jour la session en DB
 *
 *   Flow complet (premier tour) :
 *   1. Authentification + lecture du body JSON
 *   2. Récupération des plateformes connectées depuis la DB (ownership check)
 *   3. Construction du system prompt (règles plateformes + médias disponibles + date actuelle)
 *   4. Appel Claude Sonnet avec tool_use → réponse complète (pas de streaming)
 *   5. Extraction du plan depuis l'appel outil (tool_use block)
 *   6. Création de la session en DB → retour { plan, sessionId }
 *
 *   Flow complet (tour suivant) :
 *   1-3. Idem premier tour
 *   4. Chargement de l'historique depuis la session existante
 *   5. Reconstruction des messages Anthropic : [user, assistant (tool_use), user (tool_result + nouvelle instruction)]
 *   6. Appel Claude → nouveau plan
 *   7. Mise à jour de la session (conversationHistory, currentPlan)
 *   8. Retour { plan, sessionId }
 *
 * @example
 *   // Premier tour
 *   const res = await fetch('/api/agent/compose', {
 *     method: 'POST',
 *     body: JSON.stringify({ instruction: "Poste sur Insta demain 9h", mediaPool: [...] }),
 *   })
 *   const { plan, sessionId } = await res.json()
 *
 * @example
 *   // Raffinement (tour 2+)
 *   const res = await fetch('/api/agent/compose', {
 *     method: 'POST',
 *     body: JSON.stringify({ instruction: "Retire TikTok", mediaPool: [...], sessionId }),
 *   })
 *   const { plan } = await res.json()
 */

import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import { z } from 'zod'

import { anthropic, AGENT_MODEL } from '@/lib/ai'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PLATFORM_RULES } from '@/modules/platforms/config/platform-rules'
import type { AgentPlan, ConversationTurn, PoolMedia } from '@/modules/posts/types'

// ─── Schéma de validation du body ────────────────────────────────────────────

const PoolMediaSchema = z.object({
  url: z.string().url(),
  type: z.enum(['photo', 'video']),
  filename: z.string(),
})

const ComposeRequestSchema = z.object({
  /** Instruction en langage naturel de l'utilisateur */
  instruction: z.string().min(1, 'Instruction requise').max(2000),
  /** Pool de médias uploadés (sans destination) */
  mediaPool: z.array(PoolMediaSchema).max(50),
  /**
   * ID de la session agent existante (optionnel).
   * Présent dès le deuxième tour pour charger l'historique et affiner le plan.
   */
  sessionId: z.string().optional(),
})

// ─── Tool Claude : plan_content_per_platform ─────────────────────────────────

/**
 * Définition du tool Anthropic que Claude doit utiliser pour structurer sa réponse.
 * Claude remplit ce tool avec son plan de publication plateforme par plateforme.
 */
const PLAN_TOOL: Parameters<typeof anthropic.messages.create>[0]['tools'] = [
  {
    name: 'plan_content_per_platform',
    description: [
      'Planifie le contenu à publier sur chaque plateforme sociale sélectionnée.',
      'Respecte STRICTEMENT les contraintes techniques de chaque réseau (maxPhotos, maxText, etc.).',
      'Adapte le texte au ton de chaque plateforme.',
      'Sélectionne les médias appropriés depuis le pool disponible.',
      'Déduit les dates de publication depuis les instructions (ex: "demain matin" → ISO date).',
    ].join(' '),
    input_schema: {
      type: 'object' as const,
      properties: {
        platforms: {
          type: 'array',
          description: 'Plan de publication par plateforme (une entrée par plateforme ciblée)',
          items: {
            type: 'object',
            properties: {
              platform: {
                type: 'string',
                description: 'Identifiant de la plateforme (ex: "instagram", "youtube")',
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
                description: 'Date/heure de publication en ISO 8601 (ex: "2024-03-15T09:00:00.000Z"). null si maintenant.',
                nullable: true,
              },
              rationale: {
                type: 'string',
                description: 'Explication courte et transparente des choix faits (affiché à l\'utilisateur)',
              },
            },
            required: ['platform', 'text', 'mediaUrls', 'rationale'],
          },
        },
        summary: {
          type: 'string',
          description: 'Résumé global optionnel si des adaptations importantes ont été faites (ex: médias ignorés, texte tronqué)',
          nullable: true,
        },
      },
      required: ['platforms'],
    },
  },
]

// ─── Construction du system prompt ───────────────────────────────────────────

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

  // Section plateformes connectées avec leurs règles
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

  return `Tu es un expert en social media chargé de distribuer du contenu de façon optimale sur plusieurs plateformes.

## Date et heure actuelles
${dateStr} (fuseau Europe/Paris)
Utilise cette date pour interpréter les expressions temporelles ("demain", "lundi prochain", "dans 2 heures", etc.).
Toutes les dates de publication dans le tool doivent être en ISO 8601 UTC.

## Plateformes connectées de l'utilisateur
${platformsSection}

## Pool de médias disponibles
${mediaSection}

## Règles impératives
1. Tu dois appeler le tool "plan_content_per_platform" avec un plan pour CHAQUE plateforme listée ci-dessus.
2. Respecte STRICTEMENT les limites de chaque plateforme (caractères, nombre de médias, types autorisés).
3. Si une plateforme a une limite de 4 photos et le pool en contient 6 : sélectionne les 4 premières.
4. Si une plateforme ne supporte pas les vidéos (ex: google_business) : n'inclus que des photos.
5. Si une vidéo est disponible pour YouTube : utilise-la (YouTube préfère les vidéos).
6. Adapte le ton : LinkedIn professionnel, TikTok/Instagram créatif et accessible, Twitter concis.
7. Si l'utilisateur précise une heure ou un jour, calcule la date ISO exacte.
8. Si aucune date n'est précisée : scheduledFor = null (publication immédiate).
9. Le champ "rationale" doit être court (1-2 phrases) et expliquer les choix non évidents.`
}

// ─── Reconstruction des messages Anthropic depuis l'historique ────────────────

/**
 * Reconstruit le tableau de messages Anthropic depuis l'historique des tours.
 *
 * L'API Anthropic exige que chaque `tool_use` dans un message `assistant` soit
 * IMMÉDIATEMENT suivi d'un `tool_result` dans le message `user` suivant.
 *
 * Structure produite (exemple avec 2 tours historiques + nouvelle instruction) :
 *
 *   index 0 : user      → "instruction tour 1"   (texte brut — aucun tool_use précédent)
 *   index 1 : assistant → [tool_use toolId_1]
 *   index 2 : user      → [tool_result toolId_1, "instruction tour 2"]  ← chaîné
 *   index 3 : assistant → [tool_use toolId_2]
 *   index 4 : user      → [tool_result toolId_2, newInstruction]         ← chaîné
 *
 * L'ancienne implémentation (boucle for-of) plaçait le message `user` des tours
 * intermédiaires comme texte brut, sans `tool_result` — ce qui causait l'erreur :
 * "tool_use ids were found without tool_result blocks immediately after".
 *
 * @param history        - Historique des tours précédents (ConversationTurn[])
 * @param newInstruction - Nouvelle instruction de l'utilisateur pour ce tour
 * @returns Tableau de messages Anthropic au format attendu par l'API
 */
function buildAnthropicMessages(
  history: ConversationTurn[],
  newInstruction: string,
): Parameters<typeof anthropic.messages.create>[0]['messages'] {
  // Cas premier tour : pas d'historique → message utilisateur simple (texte brut)
  if (history.length === 0) {
    return [{ role: 'user', content: newInstruction }]
  }

  const messages: Parameters<typeof anthropic.messages.create>[0]['messages'] = []

  // Tour 1 : premier message utilisateur en texte brut (pas de tool_use précédent à acquitter)
  messages.push({
    role: 'user',
    content: history[0]!.instruction,
  })

  // Réponse assistant du tour 1 avec son bloc tool_use
  messages.push({
    role: 'assistant',
    content: [
      {
        type: 'tool_use',
        id: history[0]!.toolUseId,
        name: 'plan_content_per_platform',
        // planSnapshot sérialisé en JSON en DB → cast en objet pour le SDK
        input: history[0]!.planSnapshot as unknown as Record<string, unknown>,
      },
    ],
  })

  // Tours 2+ : chaque message `user` chaîne le tool_result du tour précédent
  // + l'instruction de ce tour. Cela satisfait la contrainte Anthropic.
  for (let i = 1; i < history.length; i++) {
    const prevTurn = history[i - 1]!
    const currentTurn = history[i]!

    // user : [tool_result du tour i-1] + [instruction du tour i]
    messages.push({
      role: 'user',
      content: [
        {
          // Acquittement du tool_use du tour précédent (obligatoire par l'API Anthropic)
          type: 'tool_result',
          tool_use_id: prevTurn.toolUseId,
          content: 'Plan accepté.',
        },
        {
          // Instruction de ce tour en texte libre
          type: 'text',
          text: currentTurn.instruction,
        },
      ],
    })

    // assistant : tool_use du tour i
    messages.push({
      role: 'assistant',
      content: [
        {
          type: 'tool_use',
          id: currentTurn.toolUseId,
          name: 'plan_content_per_platform',
          input: currentTurn.planSnapshot as unknown as Record<string, unknown>,
        },
      ],
    })
  }

  // Nouvelle instruction : tool_result du dernier tour historique + instruction courante
  const lastTurn = history[history.length - 1]!
  messages.push({
    role: 'user',
    content: [
      {
        // Acquittement du dernier tool_use (contrainte Anthropic : tout tool_use doit
        // être immédiatement suivi d'un tool_result dans le message user suivant)
        type: 'tool_result',
        tool_use_id: lastTurn.toolUseId,
        content: 'Plan accepté. Voici les ajustements demandés.',
      },
      {
        // Nouvelle instruction de raffinement
        type: 'text',
        text: newInstruction,
      },
    ],
  })

  return messages
}

// ─── Handler POST ─────────────────────────────────────────────────────────────

/**
 * POST /api/agent/compose
 * Body : { instruction: string, mediaPool: PoolMedia[], sessionId?: string }
 * Réponse : { plan: AgentPlan, sessionId: string }
 */
export async function POST(request: Request): Promise<NextResponse> {
  // ── Vérification de la configuration ────────────────────────────────────────
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: 'ANTHROPIC_API_KEY manquante dans .env.local — agent désactivé' },
      { status: 503 },
    )
  }

  // ── Authentification ────────────────────────────────────────────────────────
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  // ── Validation du body ──────────────────────────────────────────────────────
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body JSON invalide' }, { status: 400 })
  }

  const parsed = ComposeRequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Données invalides' },
      { status: 400 },
    )
  }

  const { instruction, mediaPool, sessionId } = parsed.data

  // ── Chargement de l'historique (si session existante) ───────────────────────
  // Ownership check : on vérifie que la session appartient à l'utilisateur connecté
  let conversationHistory: ConversationTurn[] = []

  if (sessionId) {
    const existingSession = await prisma.agentSession.findFirst({
      where: { id: sessionId, userId: session.user.id, status: 'DRAFT' },
      select: { conversationHistory: true },
    })

    if (!existingSession) {
      // Session introuvable ou non autorisée → on ignore le sessionId (repart de zéro)
      console.warn('[compose] Session introuvable ou non autorisée :', sessionId)
    } else {
      conversationHistory = existingSession.conversationHistory as unknown as ConversationTurn[]
    }
  }

  // ── Récupération des plateformes connectées ─────────────────────────────────
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

  // ── Appel Claude Sonnet ─────────────────────────────────────────────────────
  try {
    const systemPrompt = buildSystemPrompt(connectedPlatforms, mediaPool)

    // Reconstruction des messages Anthropic depuis l'historique + nouvelle instruction
    const messages = buildAnthropicMessages(conversationHistory, instruction)

    const response = await anthropic.messages.create({
      model: AGENT_MODEL,
      max_tokens: 4096,
      system: systemPrompt,
      // Forcer Claude à utiliser le tool (pas de réponse texte libre)
      tool_choice: { type: 'any' },
      tools: PLAN_TOOL,
      messages,
    })

    // ── Extraction du résultat du tool ──────────────────────────────────────
    const toolUseBlock = response.content.find((block) => block.type === 'tool_use')

    if (!toolUseBlock || toolUseBlock.type !== 'tool_use') {
      console.error('[compose] Claude n\'a pas appelé le tool :', response.content)
      return NextResponse.json(
        { error: 'L\'agent n\'a pas pu générer un plan. Veuillez réessayer.' },
        { status: 500 },
      )
    }

    // Le SDK Anthropic parse normalement le JSON du tool_use automatiquement.
    // Cependant, Claude peut parfois retourner `platforms` comme une STRING JSON
    // encodée (ex: "[{\"platform\":\"youtube\"...}]") au lieu d'un tableau parsé.
    // On normalise ici à la source pour que TOUTE la suite travaille avec un vrai tableau.
    const rawInput = toolUseBlock.input as Record<string, unknown>
    const rawPlatforms = rawInput['platforms']
    let normalizedPlatforms: AgentPlan['platforms']
    if (Array.isArray(rawPlatforms)) {
      // Cas nominal : Claude a retourné un tableau correctement parsé
      normalizedPlatforms = rawPlatforms as AgentPlan['platforms']
    } else if (typeof rawPlatforms === 'string') {
      // Cas dégradé : Claude a retourné une string JSON — on la parse
      try {
        const parsed: unknown = JSON.parse(rawPlatforms)
        normalizedPlatforms = Array.isArray(parsed)
          ? (parsed as AgentPlan['platforms'])
          : []
        console.warn('[compose] platforms était une string JSON — parsé avec succès')
      } catch {
        console.error('[compose] platforms est une string non-parseable :', rawPlatforms)
        normalizedPlatforms = []
      }
    } else {
      // Cas inattendu : null, objet, etc.
      console.error('[compose] platforms est de type inattendu :', typeof rawPlatforms, rawPlatforms)
      normalizedPlatforms = []
    }
    const newPlan: AgentPlan = {
      ...(rawInput as Omit<AgentPlan, 'platforms'>),
      platforms: normalizedPlatforms,
    }
    const toolUseId = toolUseBlock.id

    // ── Nouveau tour à enregistrer dans l'historique ────────────────────────
    const newTurn: ConversationTurn = {
      toolUseId,
      instruction,
      planSnapshot: newPlan,
      timestamp: new Date().toISOString(),
    }

    const updatedHistory = [...conversationHistory, newTurn]

    // ── Upsert de la session en DB ──────────────────────────────────────────
    // Création (premier tour) ou mise à jour (tour suivant) de la session agent
    let resultSessionId = sessionId

    if (!sessionId || !resultSessionId) {
      // Premier tour → créer une nouvelle session
      const newSession = await prisma.agentSession.create({
        data: {
          userId: session.user.id,
          status: 'DRAFT',
          // Pool de médias initial (JSON)
          mediaPool: mediaPool as unknown as object,
          // Plan courant = plan généré par ce premier tour
          currentPlan: newPlan as unknown as object,
          // Historique initialisé avec ce premier tour
          conversationHistory: updatedHistory as unknown as object,
        },
        select: { id: true },
      })
      resultSessionId = newSession.id
    } else {
      // Tour suivant → mettre à jour la session existante
      await prisma.agentSession.update({
        where: { id: sessionId },
        data: {
          // Pool de médias courant (peut avoir changé si l'utilisateur a ajouté des médias)
          mediaPool: mediaPool as unknown as object,
          // Plan courant mis à jour avec la nouvelle version de Claude
          currentPlan: newPlan as unknown as object,
          // Historique enrichi du nouveau tour
          conversationHistory: updatedHistory as unknown as object,
        },
      })
    }

    // Retour du plan + sessionId pour que l'UI puisse l'utiliser aux tours suivants
    return NextResponse.json({ plan: newPlan, sessionId: resultSessionId })
  } catch (error) {
    console.error('[compose] Erreur Claude :', error)
    return NextResponse.json(
      { error: 'Erreur lors de la génération du plan. Veuillez réessayer.' },
      { status: 500 },
    )
  }
}
