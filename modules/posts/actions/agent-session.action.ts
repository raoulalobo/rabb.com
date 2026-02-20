/**
 * @file modules/posts/actions/agent-session.action.ts
 * @module posts
 * @description Server Actions pour la gestion des sessions agent multi-tours.
 *
 *   Trois actions :
 *   1. `getLatestDraftSession`  — charge la dernière session DRAFT de l'utilisateur
 *   2. `saveAgentSessionPlan`   — sauvegarde le plan édité manuellement (debounce 2s côté UI)
 *   3. `validateAgentSession`   — marque la session comme VALIDATED et lie le postId
 *
 *   Ces actions permettent la persistance du fil de conversation même après fermeture
 *   du navigateur. La session DRAFT survit jusqu'à validation ou remplacement par une
 *   nouvelle instruction.
 *
 * @example
 *   // Vérifier si un brouillon existe au montage du composant
 *   const session = await getLatestDraftSession()
 *   if (session) {
 *     // Proposer le bandeau "Reprendre la session (N tours)"
 *   }
 *
 * @example
 *   // Sauvegarder le plan après édition manuelle (appelé en debounce 2s)
 *   await saveAgentSessionPlan(sessionId, currentPlan, mediaPool)
 *
 * @example
 *   // Valider la session après création du post
 *   await validateAgentSession(sessionId, post.id)
 */

'use server'

import { headers } from 'next/headers'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import type { AgentPlan, AgentSessionData, ConversationTurn, PoolMedia } from '@/modules/posts/types'

// ─── Normalisation du plan ─────────────────────────────────────────────────────

/**
 * Normalise le champ `platforms` d'un plan agent.
 *
 * Claude peut retourner `platforms` sous deux formes :
 * - Un tableau parsé (cas nominal) → retourné tel quel
 * - Une string JSON encodée (cas dégradé, ex: `"[{\"platform\":\"tiktok\"...}]"`)
 *   → parsée et convertie en tableau
 * - Autre (null, objet, etc.) → tableau vide
 *
 * Cette normalisation est appliquée à la lecture depuis la DB pour corriger les
 * plans déjà stockés dans le mauvais format.
 *
 * @param plan - Plan brut issu du cast JsonValue → AgentPlan (peut être malformé)
 * @returns Plan avec `platforms` garantie comme tableau
 *
 * @example
 *   // Plan stocké avec platforms en string JSON
 *   normalizePlan({ platforms: "[{\"platform\":\"tiktok\"}]", summary: "..." })
 *   // → { platforms: [{ platform: "tiktok" }], summary: "..." }
 */
function normalizePlan(plan: AgentPlan): AgentPlan {
  const raw = plan.platforms as unknown
  if (Array.isArray(raw)) {
    // Cas nominal : déjà un tableau
    return plan
  }
  if (typeof raw === 'string') {
    // Cas dégradé : string JSON encodée par Claude
    try {
      const parsed: unknown = JSON.parse(raw)
      return { ...plan, platforms: Array.isArray(parsed) ? (parsed as AgentPlan['platforms']) : [] }
    } catch {
      console.error('[normalizePlan] platforms non-parseable :', raw)
      return { ...plan, platforms: [] }
    }
  }
  // Cas inattendu : null, objet, etc.
  return { ...plan, platforms: [] }
}

// ─── getLatestDraftSession ────────────────────────────────────────────────────

/**
 * Charge la dernière session DRAFT de l'utilisateur connecté.
 *
 * Utilisée au montage du composant AgentComposer pour détecter un brouillon en cours
 * et proposer à l'utilisateur de le reprendre ou de repartir de zéro.
 *
 * Seule la session la plus récemment modifiée est retournée (si plusieurs DRAFT coexistent).
 *
 * @returns La session DRAFT la plus récente, ou null si aucune
 *
 * @example
 *   const session = await getLatestDraftSession()
 *   if (session?.turnCount > 0) {
 *     // Afficher le bandeau de reprise
 *   }
 */
export async function getLatestDraftSession(): Promise<AgentSessionData | null> {
  // Authentification obligatoire — pas d'accès aux sessions d'un autre utilisateur
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return null

  try {
    const agentSession = await prisma.agentSession.findFirst({
      where: {
        userId: session.user.id,
        status: 'DRAFT',
      },
      // La plus récemment modifiée en premier (si plusieurs brouillons)
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        mediaPool: true,
        currentPlan: true,
        conversationHistory: true,
        updatedAt: true,
      },
    })

    if (!agentSession) return null

    // Désérialiser les champs JSON stockés en DB
    // Désérialiser via `unknown` : les champs Json Prisma retournent JsonValue,
    // pas directement nos types métier — le double cast est intentionnel.
    const rawHistory = agentSession.conversationHistory as unknown as ConversationTurn[]
    const mediaPool = agentSession.mediaPool as unknown as PoolMedia[]
    const rawPlan = agentSession.currentPlan as unknown as AgentPlan | null

    // Normaliser le plan courant : corriger `platforms` si Claude l'avait encodé
    // en string JSON au lieu d'un tableau (bug de double-encodage possible).
    const currentPlan = rawPlan ? normalizePlan(rawPlan) : null

    // Normaliser également chaque planSnapshot de l'historique pour la même raison
    const conversationHistory: ConversationTurn[] = rawHistory.map((turn) => ({
      ...turn,
      planSnapshot: normalizePlan(turn.planSnapshot),
    }))

    return {
      id: agentSession.id,
      mediaPool,
      currentPlan,
      conversationHistory,
      turnCount: conversationHistory.length,
      updatedAt: agentSession.updatedAt,
    }
  } catch (error) {
    console.error('[getLatestDraftSession] Erreur lecture session :', error)
    return null
  }
}

// ─── saveAgentSessionPlan ─────────────────────────────────────────────────────

/**
 * Sauvegarde le plan courant édité manuellement par l'utilisateur.
 *
 * Appelée en debounce (2s) depuis le composant AgentComposer chaque fois que
 * l'utilisateur modifie une carte de plan (texte, médias, date).
 * Sauvegarde également le pool de médias courant.
 *
 * Effectue un ownership check (la session doit appartenir à l'utilisateur connecté)
 * avant toute écriture.
 *
 * @param sessionId  - ID de la session agent en DB
 * @param currentPlan - Plan courant (avec modifications de l'utilisateur)
 * @param mediaPool  - Pool de médias courant
 * @returns { success: true } si OK, { success: false, error } si KO
 *
 * @example
 *   useEffect(() => {
 *     if (!sessionId || !plan) return
 *     const timer = setTimeout(() => {
 *       void saveAgentSessionPlan(sessionId, plan, mediaPool)
 *     }, 2000)
 *     return () => clearTimeout(timer)
 *   }, [plan, sessionId, mediaPool])
 */
export async function saveAgentSessionPlan(
  sessionId: string,
  currentPlan: AgentPlan,
  mediaPool: PoolMedia[],
): Promise<{ success: boolean; error?: string }> {
  // Authentification obligatoire
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return { success: false, error: 'Non authentifié' }

  try {
    // Ownership check : vérifier que la session appartient à l'utilisateur connecté
    const existingSession = await prisma.agentSession.findFirst({
      where: { id: sessionId, userId: session.user.id, status: 'DRAFT' },
      select: { id: true },
    })

    if (!existingSession) {
      return { success: false, error: 'Session introuvable ou non autorisée' }
    }

    // Mise à jour du plan courant et du pool de médias
    await prisma.agentSession.update({
      where: { id: sessionId },
      data: {
        // JSON : Prisma accepte les objets JS directement pour les champs Json
        currentPlan: currentPlan as object,
        mediaPool: mediaPool as unknown as object,
      },
    })

    return { success: true }
  } catch (error) {
    console.error('[saveAgentSessionPlan] Erreur sauvegarde session :', error)
    return { success: false, error: 'Erreur lors de la sauvegarde' }
  }
}

// ─── validateAgentSession ─────────────────────────────────────────────────────

/**
 * Marque une session agent comme VALIDATED et la lie au Post créé.
 *
 * Appelée par `execute-plan.action.ts` après la création réussie du Post.
 * La session passe en status VALIDATED et ne sera plus proposée comme "reprise"
 * à l'utilisateur (filtre DRAFT dans `getLatestDraftSession`).
 *
 * @param sessionId - ID de la session agent en DB
 * @param postId    - ID du Post créé (pour la relation FK)
 * @returns { success: true } si OK, { success: false, error } si KO
 *
 * @example
 *   // Dans execute-plan.action.ts, après creation du Post
 *   if (input.sessionId) {
 *     await validateAgentSession(input.sessionId, post.id)
 *   }
 */
export async function validateAgentSession(
  sessionId: string,
  postId: string,
): Promise<{ success: boolean; error?: string }> {
  // Authentification obligatoire
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return { success: false, error: 'Non authentifié' }

  try {
    // Ownership check intégré via le filtre userId
    await prisma.agentSession.updateMany({
      where: {
        id: sessionId,
        userId: session.user.id,
        status: 'DRAFT',
      },
      data: {
        status: 'VALIDATED',
        postId,
      },
    })

    return { success: true }
  } catch (error) {
    console.error('[validateAgentSession] Erreur validation session :', error)
    // Erreur non bloquante : le post a déjà été créé, on log mais on ne rejette pas
    return { success: false, error: 'Erreur lors de la validation de la session' }
  }
}
