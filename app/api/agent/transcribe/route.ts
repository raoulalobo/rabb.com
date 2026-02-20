/**
 * @file app/api/agent/transcribe/route.ts
 * @description Route Handler : transcription audio → texte via OpenAI Whisper.
 *
 *   Reçoit un fichier audio (multipart/form-data, champ "audio").
 *   Envoie le fichier à l'API Whisper d'OpenAI.
 *   Retourne la transcription en français.
 *
 *   Limites :
 *   - Taille max : 25 Mo (limite Whisper API)
 *   - Formats acceptés : webm, mp4, wav, m4a, ogg, flac
 *   - Langue forcée : français (paramètre language: 'fr')
 *
 * @example
 *   // Depuis AgentInput.tsx
 *   const formData = new FormData()
 *   formData.append('audio', audioBlob, 'recording.webm')
 *   const res = await fetch('/api/agent/transcribe', { method: 'POST', body: formData })
 *   const { text } = await res.json()  // → "Publie mes 5 photos sur Instagram..."
 */

import { headers } from 'next/headers'
import { NextResponse } from 'next/server'

import { openaiClient } from '@/lib/ai'
import { auth } from '@/lib/auth'

// ─── Constantes ───────────────────────────────────────────────────────────────

/** Taille max acceptée : 24 Mo (marge de sécurité sous la limite Whisper de 25 Mo) */
const MAX_AUDIO_SIZE = 24 * 1024 * 1024

// ─── Handler POST ─────────────────────────────────────────────────────────────

/**
 * POST /api/agent/transcribe
 * Corps : multipart/form-data avec champ "audio" (Blob)
 * Réponse : { text: string }
 */
export async function POST(request: Request): Promise<NextResponse> {
  // ── Vérification de la configuration ────────────────────────────────────────
  // Retourner une erreur claire si la clé OpenAI n'est pas configurée
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: 'OPENAI_API_KEY manquante dans .env.local — transcription désactivée' },
      { status: 503 },
    )
  }

  // ── Authentification ────────────────────────────────────────────────────────
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  // ── Lecture du fichier audio ────────────────────────────────────────────────
  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Requête multipart invalide' }, { status: 400 })
  }

  const audioEntry = formData.get('audio')
  if (!audioEntry || !(audioEntry instanceof Blob)) {
    return NextResponse.json({ error: 'Champ "audio" manquant ou invalide' }, { status: 400 })
  }

  // ── Validation de la taille ─────────────────────────────────────────────────
  if (audioEntry.size > MAX_AUDIO_SIZE) {
    return NextResponse.json(
      { error: `Fichier audio trop volumineux (max 24 Mo, reçu ${Math.round(audioEntry.size / 1024 / 1024)} Mo)` },
      { status: 413 },
    )
  }

  // ── Transcription Whisper ───────────────────────────────────────────────────
  try {
    // Whisper attend un File avec un nom et un type MIME
    // Le navigateur enregistre en webm par défaut (MediaRecorder)
    const audioFile = new File([audioEntry], 'recording.webm', {
      type: audioEntry.type || 'audio/webm',
    })

    const transcription = await openaiClient.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1',
      // Forcer le français pour une meilleure précision
      language: 'fr',
      // Prompt de contexte pour aider Whisper sur le vocabulaire social media
      prompt: 'Instruction pour publier du contenu sur les réseaux sociaux Instagram TikTok YouTube Facebook LinkedIn Twitter.',
    })

    return NextResponse.json({ text: transcription.text })
  } catch (error) {
    console.error('[transcribe] Erreur Whisper :', error)
    return NextResponse.json(
      { error: 'Erreur lors de la transcription audio' },
      { status: 500 },
    )
  }
}
