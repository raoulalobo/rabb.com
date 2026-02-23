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
 *   Fonctionnement du timer de silence :
 *   - `continuous: true`  → le navigateur n'arrête plus seul après ~1,5s de silence
 *   - Un `setTimeout` (durée = `silenceTimeoutMs`) est lancé dès le début de l'écoute
 *   - À chaque résultat vocal (`onresult`), le timer est réinitialisé
 *   - Quand le timer expire sans nouveau résultat → `recognition.stop()` est appelé
 *   → L'utilisateur peut faire des pauses naturelles sans couper la dictée
 *
 *   Limitations :
 *   - Support principal : Chrome et Edge. Firefox a un support partiel (derrière flag).
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
 *     silenceTimeoutMs: 5000, // 5s de silence → arrêt automatique
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
  /** Callback appelé avec le texte transcrit à chaque fin de session */
  onResult: (text: string) => void
  /**
   * Durée de silence (en ms) avant arrêt automatique de la reconnaissance.
   * Défaut : 5000ms (5 secondes).
   * Le timer se réinitialise à chaque résultat vocal détecté.
   *
   * @example
   *   silenceTimeoutMs: 3000 // arrêt après 3s de silence
   */
  silenceTimeoutMs?: number
}

interface UseSpeechRecognitionReturn {
  /** `true` si la reconnaissance vocale est en cours */
  isListening: boolean
  /** Démarre la reconnaissance vocale (crée une nouvelle instance SpeechRecognition) */
  startListening: () => void
  /** Arrête la reconnaissance vocale manuellement */
  stopListening: () => void
  /**
   * `true` si le navigateur supporte l'API Web Speech.
   * Utiliser ce flag pour masquer/afficher le bouton micro conditionnellement.
   * Firefox sans flag : `false`. Chrome/Edge : `true`.
   */
  isSupported: boolean
}

// ─── Constante ────────────────────────────────────────────────────────────────

/** Durée de silence par défaut si `silenceTimeoutMs` n'est pas fourni */
const DEFAULT_SILENCE_TIMEOUT_MS = 5000

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Hook de dictée vocale natif navigateur via `window.SpeechRecognition`.
 * Ne nécessite aucune clé API ni appel serveur.
 *
 * Fonctionnement :
 * 1. `startListening()` → crée une instance SpeechRecognition + démarre le timer de silence
 * 2. Le navigateur transcrit la parole en continu (`continuous: true`)
 * 3. À chaque résultat vocal → timer réinitialisé, transcript accumulé
 * 4. Après `silenceTimeoutMs` ms sans parole → stop automatique
 * 5. `onResult(texte)` est appelé avec tout le texte de la session
 *
 * @param options.onResult         - Callback avec le texte transcrit de la session
 * @param options.silenceTimeoutMs - Délai de silence avant arrêt (défaut : 5000ms)
 * @returns Objet avec `isListening`, `startListening`, `stopListening`, `isSupported`
 *
 * @example
 *   const { isListening, startListening, stopListening, isSupported } = useSpeechRecognition({
 *     onResult: (text) => setQuery((prev) => prev.trim() ? `${prev.trim()} ${text}` : text),
 *     silenceTimeoutMs: 5000,
 *   })
 */
export function useSpeechRecognition({
  onResult,
  silenceTimeoutMs = DEFAULT_SILENCE_TIMEOUT_MS,
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
   * - `lang: 'fr-FR'`         → reconnaissance en français
   * - `continuous: true`      → reste actif pendant les pauses (le timer gère l'arrêt)
   * - `interimResults: false` → résultats finaux uniquement (pas de texte partiel)
   *
   * Timer de silence :
   * - Lancé dès `onstart`, réinitialisé à chaque `onresult`
   * - Expire après `silenceTimeoutMs` ms sans parole → appelle `recognition.stop()`
   *
   * Stratégie anti-doublon :
   * L'API Web Speech peut déclencher `onresult` plusieurs fois par session.
   * Pour éviter l'accumulation répétée, on :
   * 1. Accumule tous les résultats finaux dans `sessionTranscript` (variable locale)
   * 2. N'appelle `onResult` qu'une seule fois dans `onend` avec le texte complet
   */
  const startListening = useCallback((): void => {
    if (!isSupported) return

    // Résoudre le constructeur selon le navigateur (standard ou préfixé webkit)
    const SpeechRecognitionAPI =
      window.SpeechRecognition ??
      (window as unknown as { webkitSpeechRecognition: typeof SpeechRecognition })
        .webkitSpeechRecognition

    const recognition = new SpeechRecognitionAPI()
    recognition.lang = 'fr-FR'          // Langue : français
    recognition.continuous = true       // Reste actif pendant les pauses (timer gère l'arrêt)
    recognition.interimResults = false  // Résultats finaux uniquement

    /**
     * Accumulateur local à cette session de reconnaissance.
     * Réinitialisé à chaque appel de `startListening` (nouvelle instance = nouvelle session).
     */
    let sessionTranscript = ''

    /**
     * Identifiant du setTimeout gérant le délai de silence.
     * Réinitialisé à chaque résultat vocal ; expire → stop().
     */
    let silenceTimer: ReturnType<typeof setTimeout> | null = null

    /**
     * Réinitialise le compte à rebours de silence.
     * Appelé au démarrage et à chaque résultat vocal pour éviter un arrêt prématuré.
     *
     * @example
     *   // Utilisateur parle → onresult → resetSilenceTimer() → timer repart à 5s
     *   // Utilisateur se tait 5s → timer expire → recognition.stop()
     */
    const resetSilenceTimer = (): void => {
      if (silenceTimer !== null) clearTimeout(silenceTimer)
      silenceTimer = setTimeout(() => {
        // Silence détecté : arrêt gracieux — onend sera déclenché automatiquement
        recognition.stop()
      }, silenceTimeoutMs)
    }

    // onstart : écoute active → démarrer le premier timer de silence
    recognition.onstart = (): void => {
      setIsListening(true)
      // Démarrer le timer dès l'activation du micro (même sans parole immédiate)
      resetSilenceTimer()
    }

    recognition.onresult = (event: SpeechRecognitionEvent): void => {
      // Réinitialiser le timer : l'utilisateur vient de parler
      resetSilenceTimer()

      // Itérer depuis event.resultIndex (nouveaux résultats uniquement, pas les précédents)
      // Ne prendre que les résultats isFinal pour éviter les doublons intérimaires
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i]?.isFinal) {
          sessionTranscript += event.results[i]?.[0]?.transcript ?? ''
        }
      }
      // Ne PAS appeler onResult ici — attendre onend pour envoyer tout le texte d'un coup
    }

    // onend : déclenché après stop() (manuel ou par timer) ou après arrêt natif
    // C'est ici qu'on envoie le transcript complet de la session en une seule fois
    recognition.onend = (): void => {
      // Nettoyer le timer au cas où onend arrive avant l'expiration
      if (silenceTimer !== null) clearTimeout(silenceTimer)
      const trimmed = sessionTranscript.trim()
      if (trimmed) onResultRef.current(trimmed)
      setIsListening(false)
      recognitionRef.current = null
    }

    // onerror : erreur réseau, permission refusée, etc.
    recognition.onerror = (): void => {
      // Nettoyer le timer et ne pas envoyer de transcript partiel en cas d'erreur
      if (silenceTimer !== null) clearTimeout(silenceTimer)
      sessionTranscript = ''
      setIsListening(false)
      recognitionRef.current = null
    }

    // Stocker la référence pour pouvoir appeler stop() manuellement
    recognitionRef.current = recognition
    recognition.start()
  }, [isSupported, silenceTimeoutMs]) // silenceTimeoutMs en dep : chaque nouveau démarrage utilise la valeur courante

  /**
   * Arrête la reconnaissance vocale manuellement.
   * `onend` sera déclenché automatiquement par le navigateur après l'arrêt,
   * ce qui remettra `isListening` à `false` et enverra le transcript.
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
