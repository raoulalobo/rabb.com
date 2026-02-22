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

import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'

// ─── Anthropic Claude ─────────────────────────────────────────────────────────

/**
 * Client Anthropic singleton.
 * Utilisé par /api/agent/compose pour orchestrer le plan de contenu.
 */
export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY ?? '',
})

/** Modèle Claude utilisé pour l'agent composer */
export const AGENT_MODEL = 'claude-opus-4-6' as const

// ─── OpenAI Whisper ───────────────────────────────────────────────────────────

/**
 * Client OpenAI singleton.
 * Utilisé uniquement pour l'API Whisper (transcription audio).
 * Le modèle de génération de texte reste Claude (Anthropic).
 */
export const openaiClient = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY ?? '',
})
