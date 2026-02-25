/**
 * @file lib/ai.ts
 * @description Singletons des clients IA utilisés par l'AgentComposer.
 *
 *   - Anthropic Claude Sonnet : agent de planification de contenu
 *     → reçoit instruction + pool médias + règles plateformes
 *     → produit un plan structuré via tool_use
 *
 *   - OpenAI Whisper : transcription audio → texte
 *     → reçoit un fichier audio (webm/mp4/wav)
 *     → retourne la transcription en français
 *
 *   Les deux clients sont des singletons (instanciation unique au démarrage).
 *   Ne jamais les importer côté client — server-only.
 *
 * @example
 *   import { anthropic, openaiClient } from '@/lib/ai'
 *   const msg = await anthropic.messages.create({ ... })
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
 * Utilisé par /api/agent/compose pour orchestrer le plan de contenu.
 */
export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY ?? '',
})

/**
 * Modèle Claude utilisé pour l'agent composer (tâches complexes : planification,
 * génération de contenu multi-plateformes, édition).
 */
export const AGENT_MODEL = 'claude-opus-4-6' as const

/**
 * Modèle Claude léger utilisé pour les tâches simples (extraction de filtres,
 * classification, parsing). Plus rapide et moins coûteux qu'Opus.
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
