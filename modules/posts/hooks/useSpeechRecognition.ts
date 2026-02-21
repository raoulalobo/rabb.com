/**
 * @file modules/posts/hooks/useSpeechRecognition.ts
 * @module posts
 * @description Hook React pour la dictée vocale via la Web Speech API native du navigateur.
 *   Transcription 100% côté navigateur — aucun appel serveur requis, aucune clé API.
 *
 *   Différence avec useVoiceRecorder (supprimé) :
 *   - useVoiceRecorder : MediaRecorder → Blob → POST /api/agent/transcribe (Whisper OpenAI)
 *   - useSpeechRecognition : SpeechRecognition native → texte instantané (0 latence serveur)
 *
 *   Limitations :
 *   - Support principal : Chrome et Edge. Firefox a un support partiel (derrière flag).
 *   - La reconnaissance s'arrête automatiquement après une pause de silence.
 *   - Une seule instance SpeechRecognition active à la fois.
 *
 *   Ce hook est partagé entre :
 *   - AgentModalCreate.tsx — instruction de création
 *   - AgentModalEdit.tsx   — instruction d'édition
 *   - AIFilterModal.tsx    — requête de recherche naturelle
 *
 * @example
 *   const { isListening, startListening, stopListening, isSupported } = useSpeechRecognition({
 *     onResult: (text) => setInstruction((prev) => prev ? `${prev} ${text}` : text),
 *   })
 *
 *   // Dans le JSX :
 *   {isSupported && (
 *     <button onClick={isListening ? stopListening : startListening}>
 *       {isListening ? <MicOff /> : <Mic />}
 *     </button>
 *   )}
 */

'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface UseSpeechRecognitionOptions {
  /** Callback appelé avec le texte transcrit à chaque résultat final */
  onResult: (text: string) => void
}

interface UseSpeechRecognitionReturn {
  /** `true` si la reconnaissance vocale est en cours */
  isListening: boolean
  /** Démarre la reconnaissance vocale (crée une nouvelle instance SpeechRecognition) */
  startListening: () => void
  /** Arrête la reconnaissance vocale manuellement (déclenche aussi `onend` automatiquement) */
  stopListening: () => void
  /**
   * `true` si le navigateur supporte l'API Web Speech.
   * Utiliser ce flag pour masquer/afficher le bouton micro conditionnellement.
   * Firefox sans flag : `false`. Chrome/Edge : `true`.
   */
  isSupported: boolean
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Hook de dictée vocale natif navigateur via `window.SpeechRecognition`.
 * Ne nécessite aucune clé API ni appel serveur.
 *
 * Fonctionnement :
 * 1. `startListening()` → crée une instance SpeechRecognition et démarre l'écoute
 * 2. Le navigateur transcrit la parole en temps réel
 * 3. À la pause ou au stop, `onResult(texte)` est appelé avec le résultat
 * 4. `isListening` repasse à `false` automatiquement après `onend`
 *
 * @param options.onResult - Callback appelé avec le texte transcrit (résultats finaux uniquement)
 * @returns Objet avec `isListening`, `startListening`, `stopListening`, `isSupported`
 *
 * @example
 *   const { isListening, startListening, stopListening, isSupported } = useSpeechRecognition({
 *     onResult: (text) => setQuery((prev) => prev.trim() ? `${prev.trim()} ${text}` : text),
 *   })
 */
export function useSpeechRecognition({
  onResult,
}: UseSpeechRecognitionOptions): UseSpeechRecognitionReturn {
  const [isListening, setIsListening] = useState(false)
  /** Référence stable à l'instance SpeechRecognition active */
  const recognitionRef = useRef<SpeechRecognition | null>(null)
  /**
   * Référence stable au callback `onResult`.
   * Évite que la closure dans `startListening` capture une version périmée du callback
   * quand le composant parent se re-rend (ex: après un setState).
   * Toujours lire `onResultRef.current` dans les handlers, jamais `onResult` directement.
   */
  const onResultRef = useRef(onResult)
  // Synchroniser la référence à chaque render sans provoquer de re-création des handlers
  onResultRef.current = onResult

  /**
   * Détecte si le navigateur supporte la Web Speech API.
   * Le check `typeof window` est nécessaire pour éviter les erreurs SSR (Next.js).
   * Fallback webkit pour Chrome < 33 et les anciens navigateurs.
   */
  const isSupported =
    typeof window !== 'undefined' &&
    (typeof window.SpeechRecognition !== 'undefined' ||
      typeof (window as unknown as { webkitSpeechRecognition: unknown }).webkitSpeechRecognition !==
        'undefined')

  /**
   * Démarre la reconnaissance vocale.
   * Crée une nouvelle instance SpeechRecognition à chaque appel car les instances
   * ne sont pas réutilisables après `stop()` / `end`.
   *
   * Configuration :
   * - `lang: 'fr-FR'`          → reconnaissance en français
   * - `continuous: false`      → arrêt automatique après silence
   * - `interimResults: false`  → résultats finaux uniquement (pas de texte partiel)
   *
   * Stratégie anti-doublon :
   * L'API Web Speech peut déclencher `onresult` plusieurs fois par session
   * (une fois par unité de parole détectée), même avec `continuous: false`.
   * Pour éviter l'accumulation répétée dans `setInstruction`, on :
   * 1. Accumule tous les résultats finaux dans `sessionTranscript` (variable locale)
   * 2. N'appelle `onResult` qu'une seule fois dans `onend` avec le texte complet
   */
  const startListening = useCallback((): void => {
    if (!isSupported) return

    // Résoudre le constructeur selon le navigateur (standard ou prefixé webkit)
    const SpeechRecognitionAPI =
      window.SpeechRecognition ??
      (window as unknown as { webkitSpeechRecognition: typeof SpeechRecognition })
        .webkitSpeechRecognition

    const recognition = new SpeechRecognitionAPI()
    recognition.lang = 'fr-FR'           // Langue : français
    recognition.continuous = false       // Une seule phrase, pas d'écoute continue
    recognition.interimResults = false   // Résultats finaux uniquement

    /**
     * Accumulateur local à cette session de reconnaissance.
     * Réinitialisé à chaque appel de `startListening` (nouvelle instance = nouvelle session).
     * Les résultats partiels de chaque `onresult` s'y concatènent avant l'envoi final.
     */
    let sessionTranscript = ''

    // onstart : écoute active
    recognition.onstart = (): void => {
      setIsListening(true)
    }

    recognition.onresult = (event: SpeechRecognitionEvent): void => {
      // Itérer depuis event.resultIndex (nouveaux résultats uniquement, pas les précédents)
      // Ne prendre que les résultats isFinal pour éviter les doublons intérimaires
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i]?.isFinal) {
          sessionTranscript += event.results[i]?.[0]?.transcript ?? ''
        }
      }
      // Ne PAS appeler onResult ici — attendre onend pour envoyer tout le texte d'un coup
    }

    // onend : déclenché automatiquement après silence ou après stop()
    // C'est ici qu'on envoie le transcript complet de la session en une seule fois
    recognition.onend = (): void => {
      const trimmed = sessionTranscript.trim()
      if (trimmed) onResultRef.current(trimmed)
      setIsListening(false)
      recognitionRef.current = null
    }

    // onerror : erreur réseau, permission refusée, etc.
    recognition.onerror = (): void => {
      // Ne pas envoyer de transcript partiel en cas d'erreur
      sessionTranscript = ''
      setIsListening(false)
      recognitionRef.current = null
    }

    // Stocker la référence pour pouvoir appeler stop() manuellement
    recognitionRef.current = recognition
    recognition.start()
  }, [isSupported]) // onResult retiré des dépendances — lu via onResultRef.current

  /**
   * Arrête la reconnaissance vocale manuellement.
   * `onend` sera déclenché automatiquement par le navigateur après l'arrêt,
   * ce qui remettra `isListening` à `false`.
   */
  const stopListening = useCallback((): void => {
    recognitionRef.current?.stop()
  }, [])

  /**
   * Nettoyage : stopper la reconnaissance si le composant est démonté
   * (évite les memory leaks et les mises à jour d'état sur un composant démonté).
   */
  useEffect(() => {
    return (): void => {
      recognitionRef.current?.stop()
    }
  }, [])

  return { isListening, startListening, stopListening, isSupported }
}
