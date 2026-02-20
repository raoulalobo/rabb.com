/**
 * @file modules/posts/components/AgentComposer/index.tsx
 * @module posts
 * @description Orchestrateur de l'AgentComposer — remplace entièrement le PostComposer.
 *
 *   L'AgentComposer est un assistant IA qui :
 *   1. Reçoit des médias dans un pool (sans destination assignée)
 *   2. Reçoit une instruction en texte libre ou en dictée vocale (Whisper)
 *   3. Appelle Claude Sonnet via /api/agent/compose → plan structuré par plateforme
 *   4. Affiche le plan pour validation/modification par l'utilisateur
 *   5. Confirme → Server Action execute-plan → Post + PostPlatformContent + Inngest
 *
 *   Conversation multi-tours persistante :
 *   - Chaque appel à /api/agent/compose est sauvegardé en DB (AgentSession)
 *   - L'utilisateur peut affiner le plan en plusieurs tours successifs
 *   - Si l'utilisateur ferme le navigateur, la session DRAFT survit
 *   - Au rechargement, le bandeau "Reprendre" est affiché si une session DRAFT existe
 *
 *   Étapes de l'UI (state machine simple) :
 *   - "input" : saisie de l'instruction + upload des médias
 *   - "plan"  : affichage et édition du plan Claude + zone de raffinement
 *   - "success" : confirmation de l'enregistrement
 *
 *   Gestion des médias :
 *   Utilise le même endpoint POST /api/posts/upload-url (presigned URL Supabase)
 *   que le PostComposer — mais sans plateforme cible au moment de l'upload.
 *
 * @example
 *   // Dans AgentComposerCard.tsx
 *   <AgentComposer className="rounded-xl border bg-card shadow-sm" />
 */

'use client'

import { BotMessageSquare, Clock, Loader2, MessageSquare, Plus, RefreshCw, Sparkles } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useId, useState } from 'react'

import { getLatestDraftSession, saveAgentSessionPlan } from '@/modules/posts/actions/agent-session.action'
import { executePlan } from '@/modules/posts/actions/execute-plan.action'
import type { AgentPlan as AgentPlanType, AgentSessionData, ChatTurn, PoolMedia, UploadingFile } from '@/modules/posts/types'

import { AgentInput } from './AgentInput'
import { AgentPlan } from './AgentPlan'
import { MediaPool } from './MediaPool'
import { RefinementInput } from './RefinementInput'

// ─── Types internes ───────────────────────────────────────────────────────────

/** Étapes du flux de l'AgentComposer */
type Step = 'input' | 'plan' | 'success'

// ─── Props ────────────────────────────────────────────────────────────────────

interface AgentComposerProps {
  /** Classes CSS additionnelles pour le conteneur racine */
  className?: string
}

// ─── Utilitaire : formatage de la date relative ───────────────────────────────

/**
 * Formate une date en temps relatif lisible.
 * Ex: "il y a 2h", "il y a 3j", "à l'instant"
 *
 * @param date - Date à formater
 * @returns Chaîne de temps relatif en français
 */
function formatRelativeTime(date: Date): string {
  const diffMs = Date.now() - date.getTime()
  const diffMin = Math.floor(diffMs / 60_000)
  const diffH = Math.floor(diffMin / 60)
  const diffJ = Math.floor(diffH / 24)

  if (diffMin < 1) return "à l'instant"
  if (diffMin < 60) return `il y a ${diffMin}min`
  if (diffH < 24) return `il y a ${diffH}h`
  return `il y a ${diffJ}j`
}

// ─── Composant ────────────────────────────────────────────────────────────────

/**
 * AgentComposer — interface de publication pilotée par l'IA.
 * Gère l'intégralité du flux : upload médias → instruction → plan Claude → confirmation.
 *
 * Le state est local (pas de draftStore Zustand ici), mais la session est persistée
 * en DB pour permettre la reprise après fermeture du navigateur.
 */
export function AgentComposer({ className }: AgentComposerProps): React.JSX.Element {
  const router = useRouter()
  const uploadIdPrefix = useId()

  // ── Étape courante du flux ────────────────────────────────────────────────
  const [step, setStep] = useState<Step>('input')

  // ── Médias uploadés dans le pool ──────────────────────────────────────────
  const [mediaPool, setMediaPool] = useState<PoolMedia[]>([])
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([])

  // ── Instruction textuelle de l'utilisateur ────────────────────────────────
  const [instruction, setInstruction] = useState('')

  // ── Plan Claude (null avant la génération) ────────────────────────────────
  const [plan, setPlan] = useState<AgentPlanType | null>(null)

  // ── Session multi-tours ───────────────────────────────────────────────────
  /** ID de la session agent courante (null avant le premier tour) */
  const [sessionId, setSessionId] = useState<string | null>(null)
  /** Nombre de tours effectués (pour l'affichage "Tour N") */
  const [turnCount, setTurnCount] = useState(0)
  /**
   * Historique des messages affichés dans le fil de conversation UI.
   * Type `ChatTurn[]` — exclusivement UI, jamais persisté en DB.
   * Construit localement à chaque tour (génération + raffinement).
   */
  const [chatHistory, setChatHistory] = useState<ChatTurn[]>([])
  /** Session DRAFT existante détectée au montage (pour le bandeau de reprise) */
  const [draftSession, setDraftSession] = useState<AgentSessionData | null>(null)

  // ── États de chargement ───────────────────────────────────────────────────
  const [isGenerating, setIsGenerating] = useState(false)
  /** Vrai pendant un raffinement multi-tours (distinct de isGenerating pour le premier tour) */
  const [isRefining, setIsRefining] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  /** Vrai pendant 1.5s après un auto-save (badge "Sauvegardé" dans RefinementInput) */
  const [isSaving, setIsSaving] = useState(false)

  // ── Instruction de raffinement (zone sous le plan) ────────────────────────
  const [refinementInstruction, setRefinementInstruction] = useState('')

  // ── Erreurs ───────────────────────────────────────────────────────────────
  const [generateError, setGenerateError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // ── Confirmation "Nouveau fil" ────────────────────────────────────────────
  /** Vrai quand le panneau de confirmation "Nouveau fil" est affiché */
  const [showNewThreadConfirm, setShowNewThreadConfirm] = useState(false)

  // ── Vérification de session DRAFT au montage ──────────────────────────────

  useEffect(() => {
    // Vérifier si une session DRAFT existe pour cet utilisateur.
    // Si oui, proposer le bandeau "Reprendre" à l'étape "input".
    void getLatestDraftSession().then((session) => {
      if (session && session.turnCount > 0) {
        setDraftSession(session)
      }
    })
    // Exécuté une seule fois au montage
  }, [])

  // ── Normalisation du plan en mémoire ─────────────────────────────────────
  //
  // Claude peut retourner `platforms` comme une STRING JSON encodée au lieu
  // d'un tableau (bug de double-encodage). Ce useEffect détecte ce cas dès que
  // `plan` est mis à jour et corrige le state immédiatement, sans rechargement.
  //
  // La condition `!Array.isArray` évite toute boucle infinie : dès que platforms
  // est un tableau, l'effet ne rappelle plus setPlan.
  useEffect(() => {
    if (!plan) return
    const raw = plan.platforms as unknown
    if (Array.isArray(raw)) return // Déjà un tableau — rien à faire

    if (typeof raw === 'string') {
      try {
        const parsed: unknown = JSON.parse(raw)
        if (Array.isArray(parsed)) {
          setPlan({ ...plan, platforms: parsed as AgentPlanType['platforms'] })
        } else {
          // JSON valide mais pas un tableau → on force un tableau vide
          setPlan({ ...plan, platforms: [] })
        }
      } catch {
        // String non-JSON (cas improbable) → tableau vide
        setPlan({ ...plan, platforms: [] })
      }
    } else {
      // null, objet, etc. → tableau vide
      setPlan({ ...plan, platforms: [] })
    }
  }, [plan])

  // ── Auto-save du plan édité manuellement (debounce 2s) ───────────────────

  useEffect(() => {
    // Ne sauvegarder que si on est à l'étape "plan" avec une session et un plan valide
    if (!sessionId || !plan || step !== 'plan') return

    // Debounce : attendre 2s d'inactivité avant de sauvegarder
    const timer = setTimeout(() => {
      void saveAgentSessionPlan(sessionId, plan, mediaPool).then((result) => {
        if (result.success) {
          // Afficher le badge "Sauvegardé" pendant 1.5s
          setIsSaving(true)
          setTimeout(() => setIsSaving(false), 1500)
        }
      })
    }, 2000)

    return () => clearTimeout(timer)
  }, [plan, sessionId, mediaPool, step])

  // ── Reprise d'une session DRAFT ───────────────────────────────────────────

  /**
   * Charge la session DRAFT existante dans l'état local du composant.
   * Appelé quand l'utilisateur clique "Reprendre" dans le bandeau.
   */
  const handleResumeSession = useCallback((): void => {
    if (!draftSession) return

    // Restaurer l'ID de session pour les prochains tours
    setSessionId(draftSession.id)
    // Restaurer le pool de médias
    setMediaPool(draftSession.mediaPool)
    // Restaurer le compteur de tours
    setTurnCount(draftSession.turnCount)

    // Reconstruire le fil de conversation UI depuis l'historique DB :
    // chaque ConversationTurn → bulle user (instruction) + bulle agent (plan)
    const rebuilt: ChatTurn[] = draftSession.conversationHistory.flatMap((turn, i) => {
      // Garde défensif : platforms peut être non-tableau si Claude a renvoyé un format
      // inattendu lors de la session précédente (stocké tel quel en DB).
      const count = Array.isArray(turn.planSnapshot.platforms)
        ? turn.planSnapshot.platforms.length
        : 0
      return [
        { role: 'user' as const,  content: turn.instruction, turnCount: i + 1 },
        {
          role: 'agent' as const,
          content: `Plan généré — ${count} plateforme${count > 1 ? 's' : ''}.`,
          turnCount: i + 1,
        },
      ]
    })
    setChatHistory(rebuilt)

    // Si un plan existe, aller directement à l'étape "plan"
    if (draftSession.currentPlan) {
      setPlan(draftSession.currentPlan)
      setStep('plan')
    }

    // Fermer le bandeau (ne supprime PAS la session en DB)
    setDraftSession(null)
  }, [draftSession])

  /**
   * Ignore la session DRAFT et repart de zéro.
   * Appelé quand l'utilisateur clique "Nouveau fil" depuis le bandeau de reprise.
   * Ne supprime PAS la session en DB (sera écrasée par la nouvelle session).
   */
  const handleDismissDraftSession = useCallback((): void => {
    setDraftSession(null)
  }, [])

  /**
   * Démarre un nouveau fil depuis l'étape "plan" (fil en cours).
   *
   * La session courante est préservée intégralement en DB (status DRAFT, auto-sauvée).
   * Le composant est réinitialisé à l'état "input" vide, prêt pour une nouvelle instruction.
   * Au prochain chargement, le bandeau "Reprendre" proposera de revenir à l'ancien fil.
   *
   * Ce handler ne touche PAS la DB — il réinitialise uniquement le state local.
   */
  const handleStartNewThread = useCallback((): void => {
    // Réinitialiser tout le state local : l'ancien fil reste intact en DB
    setSessionId(null)
    setPlan(null)
    setChatHistory([])
    setTurnCount(0)
    setInstruction('')
    setRefinementInstruction('')
    setSubmitError(null)
    setShowNewThreadConfirm(false)
    setStep('input')
  }, [])

  // ── Upload d'un fichier dans le pool ─────────────────────────────────────

  /**
   * Upload un fichier vers Supabase Storage via l'endpoint presigned URL.
   * Ajoute le fichier au pool avec suivi de progression.
   *
   * @param file - Fichier sélectionné par l'utilisateur
   */
  const handleUploadFile = useCallback(async (file: File): Promise<void> => {
    const uploadId = `${uploadIdPrefix}-${Date.now()}-${Math.random()}`

    // Ajouter l'entrée "en cours" au state
    const pending: UploadingFile = { id: uploadId, file, progress: 0 }
    setUploadingFiles((prev) => [...prev, pending])

    try {
      // 1. Obtenir le presigned URL depuis l'API
      const urlRes = await fetch('/api/posts/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: file.name,
          mimeType: file.type,
          size: file.size,
        }),
      })

      if (!urlRes.ok) {
        throw new Error('Impossible d\'obtenir l\'URL d\'upload')
      }

      const { signedUrl, publicUrl } = (await urlRes.json()) as {
        signedUrl: string
        publicUrl: string
      }

      // 2. Upload direct vers Supabase (PUT avec XMLHttpRequest pour la progression)
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest()

        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            const progress = Math.round((e.loaded / e.total) * 100)
            setUploadingFiles((prev) =>
              prev.map((f) => (f.id === uploadId ? { ...f, progress } : f)),
            )
          }
        })

        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve()
          } else {
            reject(new Error(`Upload échoué : ${xhr.status}`))
          }
        })

        xhr.addEventListener('error', () => reject(new Error('Erreur réseau lors de l\'upload')))

        xhr.open('PUT', signedUrl)
        xhr.setRequestHeader('Content-Type', file.type)
        xhr.send(file)
      })

      // 3. Ajouter au pool avec son type détecté
      const mediaType: PoolMedia['type'] = file.type.startsWith('video/') ? 'video' : 'photo'
      const poolMedia: PoolMedia = { url: publicUrl, type: mediaType, filename: file.name }

      setMediaPool((prev) => [...prev, poolMedia])
    } catch (err) {
      console.error('[AgentComposer] Erreur upload :', err)
      // Marquer l'erreur dans le fichier en cours
      setUploadingFiles((prev) =>
        prev.map((f) =>
          f.id === uploadId ? { ...f, error: 'Upload échoué' } : f,
        ),
      )
      // Retirer après 3 secondes pour ne pas encombrer l'UI
      setTimeout(() => {
        setUploadingFiles((prev) => prev.filter((f) => f.id !== uploadId))
      }, 3000)
      return
    }

    // Retirer de la liste "en cours" (le média est maintenant dans le pool)
    setUploadingFiles((prev) => prev.filter((f) => f.id !== uploadId))
  }, [uploadIdPrefix])

  /**
   * Retire un média du pool par son URL publique.
   * Note : ne supprime PAS le fichier de Supabase Storage (orphelin accepté pour le MVP).
   */
  const handleRemoveMedia = useCallback((url: string): void => {
    setMediaPool((prev) => prev.filter((m) => m.url !== url))
  }, [])

  // ── Appel interne à l'API compose ─────────────────────────────────────────

  /**
   * Logique commune pour appeler POST /api/agent/compose.
   * Utilisée aussi bien pour le premier tour que pour les raffinements.
   *
   * @param instructionText - Instruction à envoyer (premier tour ou raffinement)
   * @returns { plan, sessionId } si succès, null si erreur
   */
  const callComposeApi = useCallback(async (
    instructionText: string,
  ): Promise<{ plan: AgentPlanType; sessionId: string } | null> => {
    const response = await fetch('/api/agent/compose', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        instruction: instructionText,
        mediaPool,
        // Inclure le sessionId courant pour les tours suivants (null au premier tour)
        ...(sessionId ? { sessionId } : {}),
      }),
    })

    if (!response.ok) {
      const { error } = (await response.json()) as { error?: string }
      throw new Error(error ?? `Erreur ${response.status}`)
    }

    return (await response.json()) as { plan: AgentPlanType; sessionId: string }
  }, [mediaPool, sessionId])

  // ── Génération du plan Claude (premier tour) ──────────────────────────────

  /**
   * Appelle POST /api/agent/compose pour générer le plan Claude.
   * Passe à l'étape "plan" si la réponse est valide.
   * Sauvegarde le sessionId retourné pour les tours suivants.
   */
  const handleGeneratePlan = async (): Promise<void> => {
    if (!instruction.trim()) return
    setGenerateError(null)
    setIsGenerating(true)

    try {
      const result = await callComposeApi(instruction.trim())
      if (!result) return

      const { plan: generatedPlan, sessionId: newSessionId } = result

      // Stocker le sessionId retourné par l'API (premier tour → nouvelle session)
      setSessionId(newSessionId)
      setPlan(generatedPlan)
      setTurnCount(1)

      // Initialiser le fil de conversation avec la paire user+agent du tour 1
      // Garde défensif : platforms peut être non-tableau si Claude retourne un format
      // inattendu malgré le schéma (ex: objet au lieu d'array). Évite un crash.
      const genCount = Array.isArray(generatedPlan.platforms)
        ? generatedPlan.platforms.length
        : 0
      setChatHistory([
        { role: 'user',  content: instruction.trim(), turnCount: 1 },
        {
          role: 'agent',
          content: `Plan généré — ${genCount} plateforme${genCount > 1 ? 's' : ''}.`,
          turnCount: 1,
        },
      ])

      setStep('plan')
    } catch (err) {
      console.error('[AgentComposer] Erreur génération plan :', err)
      setGenerateError(
        err instanceof Error
          ? err.message
          : 'Erreur lors de la génération du plan. Veuillez réessayer.',
      )
    } finally {
      setIsGenerating(false)
    }
  }

  // ── Raffinement du plan (tours 2+) ────────────────────────────────────────

  /**
   * Envoie une nouvelle instruction pour affiner le plan existant.
   * Utilise le même sessionId que le premier tour pour maintenir l'historique.
   * Disponible uniquement à l'étape "plan".
   */
  const handleRefinePlan = async (): Promise<void> => {
    if (!refinementInstruction.trim() || !sessionId) return
    setIsRefining(true)

    try {
      const result = await callComposeApi(refinementInstruction.trim())
      if (!result) return

      const { plan: refinedPlan } = result

      // Mettre à jour le plan avec la nouvelle version raffinée
      setPlan(refinedPlan)

      // Incrémenter le compteur de tours et ajouter la paire user+agent dans le fil.
      // IMPORTANT : on lit `turnCount` depuis la closure plutôt que d'imbriquer
      // `setChatHistory` dans l'updater de `setTurnCount`. En React Strict Mode,
      // les updaters fonctionnels sont exécutés deux fois, ce qui produirait des
      // clés dupliquées dans le chatHistory (même `nextTurn` ajouté 2×).
      const nextTurn = turnCount + 1
      setTurnCount(nextTurn)
      // Garde défensif : même protection que pour le premier tour.
      // Si Claude retourne platforms comme non-tableau, on évite un TypeError
      // à l'intérieur du updater (ce qui provoquerait un crash React).
      const refCount = Array.isArray(refinedPlan.platforms)
        ? refinedPlan.platforms.length
        : 0
      setChatHistory((prev) => [
        ...prev,
        { role: 'user',  content: refinementInstruction.trim(), turnCount: nextTurn },
        {
          role: 'agent',
          content: `Plan mis à jour — ${refCount} plateforme${refCount > 1 ? 's' : ''}.`,
          turnCount: nextTurn,
        },
      ])

      // Vider l'instruction de raffinement après succès
      setRefinementInstruction('')
    } catch (err) {
      console.error('[AgentComposer] Erreur raffinement plan :', err)
      // Afficher l'erreur dans la zone d'erreur existante
      setSubmitError(
        err instanceof Error
          ? err.message
          : 'Erreur lors du raffinement. Veuillez réessayer.',
      )
    } finally {
      setIsRefining(false)
    }
  }

  // ── Confirmation du plan → execute-plan ──────────────────────────────────

  /**
   * Soumet le plan confirmé (après édition éventuelle) au Server Action execute-plan.
   * Passe également le sessionId pour que la session soit marquée VALIDATED.
   * Redirige vers /calendar si succès.
   */
  const handleConfirmPlan = async (): Promise<void> => {
    if (!plan) return
    setSubmitError(null)
    setIsSubmitting(true)

    try {
      const result = await executePlan({
        plan,
        instruction: instruction.trim() || undefined,
        // Passer le sessionId pour que execute-plan.action appelle validateAgentSession
        sessionId: sessionId ?? undefined,
      })

      if (!result.success) {
        throw new Error(result.error ?? 'Erreur inconnue')
      }

      // Succès → afficher l'étape de confirmation puis rediriger
      setStep('success')
      setTimeout(() => {
        router.push('/calendar')
      }, 1500)
    } catch (err) {
      console.error('[AgentComposer] Erreur exécution plan :', err)
      setSubmitError(
        err instanceof Error ? err.message : 'Erreur lors de la sauvegarde du plan.',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  // ── Rendu ─────────────────────────────────────────────────────────────────

  return (
    <div className={className}>
      {/* ── En-tête de l'AgentComposer ───────────────────────────────────── */}
      <div className="flex items-center gap-2.5 border-b border-border px-5 py-4">
        <BotMessageSquare className="size-4 text-primary" />
        <span className="text-sm font-medium">Agent IA</span>
        {step === 'plan' && plan && (
          <span className="ml-auto text-xs text-muted-foreground">
            {/* Normalisation identique à AgentPlan : gère tableau, string JSON, et autres */}
            {(() => {
              const raw = plan.platforms as unknown
              let n = 0
              if (Array.isArray(raw)) {
                n = raw.length
              } else if (typeof raw === 'string') {
                try { const p = JSON.parse(raw); n = Array.isArray(p) ? p.length : 0 } catch { n = 0 }
              }
              return `Plan pour ${n} plateforme${n > 1 ? 's' : ''}`
            })()}
          </span>
        )}
      </div>

      {/* ── Contenu selon l'étape ────────────────────────────────────────── */}
      <div className="px-5 py-5">
        {/* ÉTAPE 1 : Input + pool de médias */}
        {step === 'input' && (
          <div className="space-y-5">
            {/* ── Bandeau de reprise (session DRAFT existante) ──────────── */}
            {draftSession && (
              <div className="flex items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
                {/* Icône */}
                <MessageSquare className="size-4 shrink-0 text-primary" />

                {/* Informations sur la session */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">
                    Brouillon en cours
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {draftSession.turnCount} tour{draftSession.turnCount > 1 ? 's' : ''}
                    {' · '}
                    <span className="inline-flex items-center gap-1">
                      <Clock className="size-3" />
                      {formatRelativeTime(draftSession.updatedAt)}
                    </span>
                  </p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleResumeSession}
                    className={[
                      'flex items-center gap-1.5 rounded-lg px-3 py-1.5',
                      'bg-primary text-xs font-semibold text-primary-foreground',
                      'hover:bg-primary/90 active:scale-[0.98] transition-all',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    ].join(' ')}
                  >
                    <RefreshCw className="size-3" />
                    Reprendre
                  </button>

                  <button
                    type="button"
                    onClick={handleDismissDraftSession}
                    className={[
                      'flex items-center gap-1.5 rounded-lg px-3 py-1.5',
                      'border border-border bg-background text-xs font-medium text-muted-foreground',
                      'hover:text-foreground hover:border-foreground/30 active:scale-[0.98] transition-all',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    ].join(' ')}
                  >
                    <Plus className="size-3" />
                    Nouveau fil
                  </button>
                </div>
              </div>
            )}

            {/* Zone d'instruction (texte + micro) */}
            <AgentInput
              value={instruction}
              onChange={setInstruction}
              disabled={isGenerating}
            />

            {/* Séparateur */}
            <div className="border-t border-border/60" />

            {/* Pool de médias */}
            <MediaPool
              mediaPool={mediaPool}
              uploadingFiles={uploadingFiles}
              onUpload={handleUploadFile}
              onRemove={handleRemoveMedia}
              disabled={isGenerating}
            />

            {/* Erreur de génération */}
            {generateError && (
              <div className="rounded-lg bg-destructive/10 px-3.5 py-2.5 text-sm text-destructive">
                {generateError}
              </div>
            )}

            {/* Bouton de génération */}
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => void handleGeneratePlan()}
                disabled={isGenerating || !instruction.trim() || uploadingFiles.length > 0}
                className={[
                  'flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5',
                  'text-sm font-semibold text-primary-foreground shadow-sm transition-all',
                  'hover:bg-primary/90 active:scale-[0.98]',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  'disabled:cursor-not-allowed disabled:opacity-50',
                ].join(' ')}
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Génération du plan...
                  </>
                ) : (
                  <>
                    <Sparkles className="size-4" />
                    Générer le plan
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* ÉTAPE 2 : Plan Claude à valider + zone de raffinement */}
        {step === 'plan' && plan && (
          <div className="space-y-4">
            {/* ── Fil de contexte : instructions passées ──────────────────── */}
            {/* Les messages user s'empilent du plus ancien (grisé) au plus récent.
                Chaque instruction reste visible pour que l'utilisateur comprenne
                pourquoi le plan a évolué d'un tour à l'autre. */}
            {chatHistory.filter((t) => t.role === 'user').length > 0 && (
              <div className="space-y-2">
                {chatHistory
                  .filter((t) => t.role === 'user')
                  .map((turn, i, arr) => {
                    // Le dernier message est "actif" (pleine opacité), les précédents sont estompés
                    const isLast = i === arr.length - 1
                    return (
                      <div
                        // Utiliser l'index comme clé : plusieurs ChatTurn peuvent
                        // partager le même `turnCount` (user + agent du même tour),
                        // ce qui provoquerait des clés dupliquées avec `key={turn.turnCount}`.
                        // L'index `i` dans le tableau filtré est garanti unique.
                        key={i}
                        className={[
                          'flex items-start gap-2 transition-opacity',
                          isLast ? 'opacity-100' : 'opacity-40',
                        ].join(' ')}
                      >
                        <MessageSquare className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                        <p className="text-sm leading-relaxed text-foreground">
                          {turn.content}
                        </p>
                      </div>
                    )
                  })}
                {/* Séparateur fin entre le fil et le plan */}
                <div className="border-t border-border/40" />
              </div>
            )}

            <AgentPlan
              plan={plan}
              onPlanChange={setPlan}
              onConfirm={() => void handleConfirmPlan()}
              isSubmitting={isSubmitting}
            />

            {/* ── Zone de raffinement multi-tours ─────────────────────── */}
            {/* Visible uniquement si on a un sessionId (session persistée en DB) */}
            {sessionId && (
              <RefinementInput
                value={refinementInstruction}
                onChange={setRefinementInstruction}
                onSubmit={handleRefinePlan}
                isLoading={isRefining}
                disabled={isSubmitting}
                turnCount={turnCount}
                isSaving={isSaving}
                mediaPool={mediaPool}
                uploadingFiles={uploadingFiles}
                onUploadMedia={handleUploadFile}
                onRemoveMedia={handleRemoveMedia}
              />
            )}

            {/* ── Nouveau fil ───────────────────────────────────────────── */}
            {showNewThreadConfirm ? (
              /* Panneau de confirmation inline : explique la limitation
                 (seul le fil le plus récent est accessible via "Reprendre")
                 avant d'effacer le state du composant. */
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 space-y-3">
                <p className="text-xs text-amber-800 leading-relaxed">
                  <strong>Démarrer un nouveau fil ?</strong>
                  <br />
                  Le fil actuel sera sauvegardé, mais seul le fil{' '}
                  <strong>le plus récemment modifié</strong> est proposé dans
                  le bandeau &ldquo;Reprendre&rdquo; au prochain chargement.
                  Si vous démarrez deux fils, l&rsquo;ancien ne sera plus
                  directement accessible depuis cette interface.
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowNewThreadConfirm(false)
                      handleStartNewThread()
                    }}
                    className={[
                      'rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white',
                      'hover:bg-amber-700 active:scale-[0.98] transition-all',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500',
                    ].join(' ')}
                  >
                    Oui, démarrer un nouveau fil
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowNewThreadConfirm(false)}
                    className={[
                      'rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground',
                      'hover:text-foreground hover:bg-muted/50 transition-colors',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    ].join(' ')}
                  >
                    Annuler
                  </button>
                </div>
              </div>
            ) : (
              /* Bouton discret en bas de l'étape plan */
              <div className="flex justify-center pt-1">
                <button
                  type="button"
                  onClick={() => setShowNewThreadConfirm(true)}
                  disabled={isSubmitting || isRefining}
                  className={[
                    'flex items-center gap-1.5 rounded-lg px-3 py-1.5',
                    'text-xs text-muted-foreground/60 transition-colors',
                    'hover:text-muted-foreground hover:bg-muted/50',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    'disabled:cursor-not-allowed disabled:opacity-40',
                  ].join(' ')}
                >
                  <Plus className="size-3" />
                  Nouveau fil
                </button>
              </div>
            )}

            {/* Erreur de soumission ou de raffinement */}
            {submitError && (
              <div className="rounded-lg bg-destructive/10 px-3.5 py-2.5 text-sm text-destructive">
                {submitError}
              </div>
            )}
          </div>
        )}

        {/* ÉTAPE 3 : Succès */}
        {step === 'success' && (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-green-100">
              <Sparkles className="size-6 text-green-600" />
            </div>
            <div>
              <p className="font-semibold text-foreground">Plan enregistré !</p>
              <p className="text-sm text-muted-foreground">
                Redirection vers le calendrier...
              </p>
            </div>
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>
    </div>
  )
}
