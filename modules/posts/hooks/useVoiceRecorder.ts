/**
 * @file modules/posts/hooks/useVoiceRecorder.ts
 * @module posts
 * @description Hook React pour la dictée vocale via MediaRecorder + Whisper.
 *
 *   Flux :
 *   1. `startRecording()` → demande l'accès micro → démarre MediaRecorder
 *   2. `stopRecording()` → arrête l'enregistrement → assemble le Blob audio
 *   3. Envoie le Blob à POST /api/agent/transcribe (Whisper OpenAI)
 *   4. Appelle `onTranscription(text)` avec le texte transcrit
 *
 *   Statuts :
 *   - `idle`          → prêt à enregistrer
 *   - `recording`     → micro actif, capture en cours
 *   - `transcribing`  → audio envoyé à Whisper, en attente du texte
 *
 * @example
 *   const { status, startRecording, stopRecording } = useVoiceRecorder({
 *     onTranscription: (text) => setInstruction((prev) => prev ? `${prev} ${text}` : text),
 *     onError: (msg) => setError(msg),
 *   })
 */

'use client'

import { useCallback, useRef, useState } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

export type VoiceRecorderStatus = 'idle' | 'recording' | 'transcribing'

interface UseVoiceRecorderOptions {
  /** Appelé avec le texte transcrit après chaque enregistrement */
  onTranscription: (text: string) => void
  /** Appelé en cas d'erreur (accès micro refusé, transcription échouée…) */
  onError?: (message: string) => void
}

interface UseVoiceRecorderReturn {
  /** État courant du recorder */
  status: VoiceRecorderStatus
  /** Démarre la capture micro (demande permission si nécessaire) */
  startRecording: () => Promise<void>
  /** Arrête la capture et déclenche la transcription */
  stopRecording: () => void
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Hook de dictée vocale : MediaRecorder → Whisper → texte.
 *
 * @param options - Callbacks de transcription et d'erreur
 * @returns { status, startRecording, stopRecording }
 */
export function useVoiceRecorder({
  onTranscription,
  onError,
}: UseVoiceRecorderOptions): UseVoiceRecorderReturn {
  const [status, setStatus] = useState<VoiceRecorderStatus>('idle')

  /** Référence au MediaRecorder actif */
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  /** Chunks audio collectés pendant l'enregistrement */
  const chunksRef = useRef<Blob[]>([])
  /** Stream actif (pour l'arrêter proprement) */
  const streamRef = useRef<MediaStream | null>(null)

  /**
   * Démarre l'enregistrement audio.
   * Demande l'accès au micro si ce n'est pas déjà accordé.
   */
  const startRecording = useCallback(async (): Promise<void> => {
    if (status !== 'idle') return

    try {
      // Demander l'accès au microphone
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      chunksRef.current = []

      // Choisir le format le plus compatible (webm sur Chrome/Firefox, mp4 sur Safari)
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4'
      const recorder = new MediaRecorder(stream, { mimeType })

      // Collecter les chunks audio au fil de l'enregistrement
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data)
        }
      }

      // Quand l'enregistrement est arrêté → déclencher la transcription
      recorder.onstop = async () => {
        // Arrêter le flux micro (libère l'indicateur micro du navigateur)
        streamRef.current?.getTracks().forEach((track) => track.stop())
        streamRef.current = null

        setStatus('transcribing')

        try {
          // Assembler les chunks en un seul Blob audio
          const audioBlob = new Blob(chunksRef.current, { type: mimeType })
          chunksRef.current = []

          // Envoyer à Whisper via l'API Route
          const formData = new FormData()
          formData.append('audio', audioBlob, 'recording.webm')

          const res = await fetch('/api/agent/transcribe', {
            method: 'POST',
            body: formData,
          })

          const data = (await res.json()) as { text?: string; error?: string }

          if (!res.ok || !data.text) {
            throw new Error(data.error ?? `Erreur transcription ${res.status}`)
          }

          // Passer le texte transcrit au parent
          onTranscription(data.text)
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Transcription échouée'
          console.error('[useVoiceRecorder] Erreur transcription :', err)
          onError?.(message)
        } finally {
          setStatus('idle')
        }
      }

      mediaRecorderRef.current = recorder
      // Collecter les données toutes les 250 ms pour un meilleur streaming
      recorder.start(250)
      setStatus('recording')
    } catch (err) {
      // Erreur d'accès micro (Permission refusée, périphérique indisponible…)
      const message =
        err instanceof DOMException && err.name === 'NotAllowedError'
          ? 'Accès au microphone refusé. Autorisez l\'accès dans les paramètres du navigateur.'
          : 'Impossible d\'accéder au microphone.'
      console.error('[useVoiceRecorder] Erreur accès micro :', err)
      onError?.(message)
      setStatus('idle')
    }
  }, [status, onTranscription, onError])

  /**
   * Arrête l'enregistrement en cours.
   * Déclenche automatiquement la transcription via `recorder.onstop`.
   */
  const stopRecording = useCallback((): void => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop()
      mediaRecorderRef.current = null
    }
  }, [])

  return { status, startRecording, stopRecording }
}
