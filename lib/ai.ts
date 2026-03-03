/**
 * @file lib/ai.ts
 * @description Singletons des clients IA utilisés par l'AgentComposer.
 *
 *   - Anthropic Claude Sonnet : agent de planification de contenu
 *     → reçoit instruction + pool médias + règles plateformes
 *     → produit un plan structuré via tool_use
 *     → fallback automatique vers Opus si Sonnet retourne 529
 *
 *   - OpenAI Whisper : transcription audio → texte
 *     → reçoit un fichier audio (webm/mp4/wav)
 *     → retourne la transcription en français
 *
 *   Les deux clients sont des singletons (instanciation unique au démarrage).
 *   Ne jamais les importer côté client — server-only.
 *
 * @example
 *   import { callAnthropicWithFallback, openaiClient } from '@/lib/ai'
 *   const msg = await callAnthropicWithFallback({ model: AGENT_MODEL, ... })
 *   const transcription = await openaiClient.audio.transcriptions.create({ ... })
 */

import dns from 'dns'

import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'

// ─── Correction DNS IPv6 → IPv4 ───────────────────────────────────────────────
// Node.js (undici, utilisé par fetch natif et les SDK) tente IPv6 en premier.
// Sur les machines où IPv6 est configuré mais non fonctionnel, cela provoque
// un ETIMEDOUT immédiat avant de retomber sur IPv4.
// dns.setDefaultResultOrder('ipv4first') force la résolution IPv4 en priorité
// pour tout le processus, résolvant les erreurs "Connection error" vers les APIs.
dns.setDefaultResultOrder('ipv4first')

// ─── Anthropic Claude ─────────────────────────────────────────────────────────

/**
 * Client Anthropic singleton.
 * Utilisé par callAnthropicWithFallback pour orchestrer la génération de contenu.
 *
 * maxRetries=2 : 3 tentatives totales (1 originale + 2 retries) par modèle.
 * Réduit de 4 à 2 car on bénéficie maintenant d'un fallback Sonnet → Opus :
 * 2 modèles × 3 tentatives = 6 attempts totaux max.
 * Temps max : ~14s par modèle (2+4+8s) × 2 = ~28s, bien en deçà des 60s Vercel.
 *
 * Le SDK réessaie automatiquement sur les erreurs 529 et 5xx
 * grâce au header `x-should-retry: true` retourné par l'API Anthropic.
 */
export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY ?? '',
  maxRetries: 2,
})

/**
 * Code HTTP retourné par Anthropic quand ses serveurs sont surchargés.
 * Le header `x-should-retry: true` accompagne toujours ce code.
 * Utilisé dans les catch blocks des routes agent pour retourner un 503
 * avec un message explicite plutôt que le 500 générique.
 */
export const ANTHROPIC_OVERLOADED_STATUS = 529

/**
 * Code HTTP retourné par Anthropic en cas d'erreur interne côté Anthropic
 * (type "api_error", ex: "Internal server error").
 * Différence clé avec le 529 : le header `x-should-retry: false` — le SDK
 * ne réessaie PAS, ni nous. C'est une défaillance temporaire côté Anthropic.
 * Traité comme un 503 vers le client (erreur tierce, pas la nôtre).
 */
export const ANTHROPIC_SERVER_ERROR_STATUS = 500

/**
 * Modèle principal de l'agent (création, édition, bulk-edit de posts).
 * Sonnet 4.6 : bon équilibre qualité / disponibilité / coût.
 * Plus disponible qu'Opus sur les pics de charge — moins de 529/500.
 */
export const AGENT_MODEL = 'claude-sonnet-4-6' as const

/**
 * Modèle de fallback si AGENT_MODEL est surchargé (529) ou en erreur interne (500).
 * Opus 4.6 : pool de capacité distinct de Sonnet — activé automatiquement via
 * callAnthropicWithFallback si Sonnet reste en 529 après ses 3 tentatives.
 */
export const AGENT_MODEL_FALLBACK = 'claude-opus-4-6' as const

/**
 * Wrapper autour de anthropic.messages.create avec fallback automatique Sonnet → Opus.
 *
 * Stratégie de résilience :
 *   1. Tente le modèle demandé (params.model = AGENT_MODEL = Sonnet) avec maxRetries=2
 *      → 3 tentatives totales (1 originale + 2 retries SDK, ~2s+4s+8s backoff)
 *   2. Si 529 persiste après les 3 tentatives → console.warn + retry avec AGENT_MODEL_FALLBACK (Opus)
 *      → Opus bénéficie aussi du maxRetries=2 (3 nouvelles tentatives)
 *   3. Si Opus est aussi surchargé → propage le 529 Anthropic.APIError
 *      → le catch de la route le traduit en 503 "serveurs surchargés" pour l'UI
 *
 * Transparent pour les routes : aucune logique métier modifiée.
 * Toutes les routes agent appellent cette fonction au lieu de anthropic.messages.create.
 *
 * @param params - Paramètres identiques à anthropic.messages.create (model, messages, tools, etc.)
 * @returns La réponse Anthropic (du modèle primaire ou du fallback Opus)
 * @throws Anthropic.APIError si les deux modèles sont indisponibles (propagé au catch de la route)
 *
 * @example
 *   import { callAnthropicWithFallback, AGENT_MODEL } from '@/lib/ai'
 *   const response = await callAnthropicWithFallback({
 *     model: AGENT_MODEL,
 *     max_tokens: 4096,
 *     messages: [{ role: 'user', content: 'Bonjour' }],
 *   })
 */
export async function callAnthropicWithFallback(
  params: Parameters<typeof anthropic.messages.create>[0],
): Promise<Anthropic.Message> {
  try {
    // Tentative avec le modèle demandé (Sonnet par défaut).
    // Cast explicite vers Anthropic.Message : toutes nos routes utilisent le mode
    // non-streaming (pas de { stream: true }), donc le retour est toujours un Message.
    return await anthropic.messages.create(params) as unknown as Anthropic.Message
  } catch (error) {
    // Si Sonnet retourne 529 (overloaded) après toutes ses tentatives,
    // on bascule sur Opus qui a un pool de capacité indépendant
    if (error instanceof Anthropic.APIError && error.status === ANTHROPIC_OVERLOADED_STATUS) {
      console.warn(
        `[AI] ${String(params.model)} surchargé (529) après 3 tentatives` +
          ` — fallback vers ${AGENT_MODEL_FALLBACK}`,
      )
      // Opus bénéficie du même maxRetries=2 (3 tentatives) via le SDK
      return await anthropic.messages.create({ ...params, model: AGENT_MODEL_FALLBACK }) as unknown as Anthropic.Message
    }
    // Toute autre erreur (401, 422, 500, erreur réseau) est propagée directement
    throw error
  }
}

/**
 * Modèle léger utilisé pour les tâches simples (extraction de filtres,
 * classification, parsing). Plus rapide et moins coûteux que Sonnet.
 */
export const FILTER_MODEL = 'claude-haiku-4-5-20251001' as const

// ─── OpenAI Whisper ───────────────────────────────────────────────────────────

/**
 * Client OpenAI singleton.
 * Utilisé uniquement pour l'API Whisper (transcription audio).
 * Le modèle de génération de texte reste Claude (Anthropic).
 */
export const openaiClient = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY ?? '',
})
