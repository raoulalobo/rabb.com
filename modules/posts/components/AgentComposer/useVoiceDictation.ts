/**
 * @file modules/posts/components/AgentComposer/useVoiceDictation.ts
 * @module posts
 * @description Hook React encapsulant la dictée vocale via Web Speech API.
 *
 *   Factorisation de la logique commune à AgentInput et RefinementInput :
 *   - Détection du support navigateur (Chrome/Edge uniquement)
 *   - Démarrage / arrêt de la reconnaissance vocale (fr-FR, mode continu)
 *   - Résultats intermédiaires (feedback temps réel) et finals (intégration au texte)
 *
 *   Aucun appel réseau — tout est traité localement par le navigateur.
 *
 *   Compatibilité :
 *   - Chrome, Edge : supporté nativement ✅
 *   - Firefox, Safari : non supporté → `isSupported = false`
 *
 * @example
 *   const { isRecording, isSupported, micError, interimText, handleMicToggle } =
 *     useVoiceDictation({ value, onChange, disabled })
 */

import { useEffect, useRef, useState } from 'react'

// ─── Helper ───────────────────────────────────────────────────────────────────

/**
 * Retourne le constructeur SpeechRecognition si disponible dans le navigateur.
 * Gère le préfixe webkit (Chrome < 33, Android WebView).
 *
 * @returns Constructeur SpeechRecognition ou null si non supporté
 */
function getSpeechRecognitionAPI(): typeof SpeechRecognition | null {
  if (typeof window === 'undefined') return null
  // Standard (Chrome 33+, Edge)
  if ('SpeechRecognition' in window) return window.SpeechRecognition
  // Webkit préfixé (Chrome < 33, Android WebView)
  if ('webkitSpeechRecognition' in window) {
    return (
      window as unknown as { webkitSpeechRecognition: typeof SpeechRecognition }
    ).webkitSpeechRecognition
  }
  return null
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface UseVoiceDictationOptions {
  /** Valeur actuelle du champ texte (pour la concaténation des segments vocaux) */
  value: string
  /** Callback de mise à jour du texte (après chaque segment finalisé) */
  onChange: (value: string) => void
  /** Désactive le toggle microphone si true */
  disabled?: boolean
}

interface UseVoiceDictationReturn {
  /** Vrai pendant l'écoute (animation pulsante sur le bouton micro) */
  isRecording: boolean
  /** Vrai si le navigateur supporte SpeechRecognition */
  isSupported: boolean
  /** Message d'erreur microphone (accès refusé, no-speech, etc.) ou null */
  micError: string | null
  /** Texte intermédiaire en cours de dictée (non finalisé, pour l'overlay) */
  interimText: string
  /** Toggle démarrage/arrêt de la reconnaissance vocale */
  handleMicToggle: () => void
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Hook de dictée vocale via Web Speech API (fr-FR, mode continu).
 *
 * Les segments finalisés sont concaténés à `value` via `onChange`.
 * Les segments intermédiaires sont exposés via `interimText` pour un overlay.
 *
 * @param options - Valeur actuelle, callback onChange, et état disabled
 * @returns État de la dictée + handler de toggle microphone
 */
export function useVoiceDictation({
  value,
  onChange,
  disabled = false,
}: UseVoiceDictationOptions): UseVoiceDictationReturn {
  const [isRecording, setIsRecording] = useState(false)
  const [micError, setMicError] = useState<string | null>(null)
  // Texte intermédiaire (résultats non finalisés) affiché en overlay temps réel
  const [interimText, setInterimText] = useState('')
  // true si le navigateur supporte SpeechRecognition (mis à jour côté client uniquement)
  const [isSupported, setIsSupported] = useState(false)

  // Référence à l'instance SpeechRecognition active
  const recognitionRef = useRef<SpeechRecognition | null>(null)

  // Référence à la valeur courante pour éviter les closures périmées dans onresult.
  // Sans useRef, onresult capture la valeur initiale et ignore les mises à jour state.
  const valueRef = useRef(value)
  useEffect(() => {
    valueRef.current = value
  }, [value])

  // Détection du support au montage (côté client uniquement — SSR retourne false)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsSupported(getSpeechRecognitionAPI() !== null)
  }, [])

  // ── Démarrage de la reconnaissance ──────────────────────────────────────────

  /**
   * Initialise et démarre la reconnaissance vocale (fr-FR, continue).
   * Configure les handlers onresult / onerror / onend.
   */
  const startRecording = (): void => {
    const SpeechRecognitionAPI = getSpeechRecognitionAPI()
    if (!SpeechRecognitionAPI) return

    setMicError(null)
    setInterimText('')

    const recognition = new SpeechRecognitionAPI()
    recognitionRef.current = recognition

    recognition.lang = 'fr-FR'
    recognition.continuous = true      // Continue jusqu'au clic "Stop"
    recognition.interimResults = true  // Résultats non finalisés en temps réel

    recognition.onstart = (): void => {
      setIsRecording(true)
    }

    /**
     * Traitement des résultats.
     * - Finaux → concaténés au texte via onChange
     * - Intermédiaires → affichés dans l'overlay (non persistés)
     */
    recognition.onresult = (event: SpeechRecognitionEvent): void => {
      let interimAccumulator = ''

      // Parcourir uniquement les nouveaux résultats (depuis resultIndex)
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]

        if (result.isFinal) {
          // Segment finalisé → concaténer au texte existant
          const finalText = result[0]?.transcript ?? ''
          const separator = valueRef.current.trim() ? ' ' : ''
          const newValue = valueRef.current.trim() + separator + finalText

          // Mettre à jour la ref immédiatement (avant le prochain onresult)
          valueRef.current = newValue
          onChange(newValue)
          setInterimText('')
        } else {
          interimAccumulator += result[0]?.transcript ?? ''
        }
      }

      if (interimAccumulator) {
        setInterimText(interimAccumulator)
      }
    }

    recognition.onerror = (event: SpeechRecognitionErrorEvent): void => {
      // 'aborted' est déclenché par notre propre appel stop() → pas une vraie erreur
      if (event.error === 'aborted') return

      console.error('[useVoiceDictation] Erreur Web Speech API :', event.error)
      setMicError(
        event.error === 'not-allowed'
          ? 'Accès au microphone refusé. Autorisez-le dans les paramètres du navigateur.'
          : event.error === 'no-speech'
            ? 'Aucune parole détectée. Réessayez.'
            : `Erreur de reconnaissance : ${event.error}`,
      )
      setIsRecording(false)
      setInterimText('')
    }

    // Reconnaissance terminée (stop manuel ou timeout navigateur)
    recognition.onend = (): void => {
      setIsRecording(false)
      setInterimText('')
    }

    recognition.start()
  }

  // ── Arrêt de la reconnaissance ───────────────────────────────────────────────

  /**
   * Arrête proprement la reconnaissance vocale.
   * isRecording sera mis à false via l'événement onend (arrêt asynchrone).
   */
  const stopRecording = (): void => {
    recognitionRef.current?.stop()
  }

  // ── Toggle microphone ────────────────────────────────────────────────────────

  const handleMicToggle = (): void => {
    if (disabled || !isSupported) return
    if (isRecording) {
      stopRecording()
    } else {
      startRecording()
    }
  }

  return { isRecording, isSupported, micError, interimText, handleMicToggle }
}
