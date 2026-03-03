/**
 * @file modules/posts/components/AgentModal/AgentModalBulkEdit.tsx
 * @module posts
 * @description Zone d'édition en masse via une instruction libre — 3 phases séquentielles.
 *
 *   Phase 1 — INPUT :
 *     Résumé des posts sélectionnés (N posts, icônes plateformes)
 *     Pool de médias partagés (upload, galerie, drag & drop) — optionnel
 *     Textarea instruction + dictée vocale (Web Speech API)
 *     Bouton "Générer les modifications" → POST /api/agent/edit-posts-batch
 *
 *   Phase 2 — PREVIEW :
 *     Affichage des changements proposés pour chaque post (texte avant/après)
 *     Section médias par post : avant (lecture seule) + après (éditable : ✕ supprimer, + ajouter du pool)
 *     Bouton "← Revenir" (retour phase input pour re-générer)
 *     Bouton "Appliquer à N posts" → Server Action bulkApplyEdits
 *
 *   Phase 3 — SUCCESS :
 *     Confirmation "N posts modifiés avec succès"
 *     Bouton "Fermer"
 *
 *   L'agent IA ne modifie pas la DB lors de la génération.
 *   Seule la confirmation (phase 3) déclenche la persistance.
 *
 * @example
 *   <AgentModalBulkEdit
 *     posts={selectedPosts}
 *     onPostsUpdated={(updatedPosts) => { replacePostsInList(updatedPosts) }}
 *     onClose={() => setOpen(false)}
 *   />
 */

'use client'

import { ArrowLeft, CheckCircle, ImagePlus, LayoutGrid, Loader2, Mic, MicOff, Plus, Sparkles, X } from 'lucide-react'
import { useCallback, useId, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Textarea } from '@/components/ui/textarea'
import { MediaPicker } from '@/modules/media/components/MediaPicker'
import { PLATFORM_CONFIG } from '@/modules/platforms/constants'
import { bulkApplyEdits } from '@/modules/posts/actions/bulk-apply-edits.action'
import { useSpeechRecognition } from '@/modules/posts/hooks/useSpeechRecognition'
import { isVideoUrl } from '@/modules/posts/utils/media.utils'
import { useAppStore } from '@/store/app.store'
import type { Post, PoolMedia, UploadingFile } from '@/modules/posts/types'
import type { ProposedEdit } from '@/modules/posts/schemas/post.schema'

// ─── Props ────────────────────────────────────────────────────────────────────

interface AgentModalBulkEditProps {
  /** Posts sélectionnés à modifier */
  posts: Post[]
  /**
   * Callback appelé après application réussie des modifications.
   * Reçoit les posts mis à jour (version DB) pour mettre à jour la liste.
   * Note : les posts retournés par bulkApplyEdits ne contiennent pas le Post complet —
   * on reconstruit une version optimiste depuis les ProposedEdit confirmées.
   */
  onPostsUpdated: (posts: Post[]) => void
  /** Callback pour fermer la modale */
  onClose: () => void
}

// ─── Types internes ────────────────────────────────────────────────────────────

/** Les 3 phases séquentielles de la modale */
type Phase = 'input' | 'preview' | 'success'

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Formate une date en chaîne lisible en français.
 * Retourne "non planifié" si la date est null.
 *
 * @param dateStr - Date ISO 8601 ou null
 * @returns Chaîne formatée (ex: "15 mars à 09h00") ou "non planifié"
 */
function formatDate(dateStr: string | null | Date | undefined): string {
  if (!dateStr) return 'non planifié'
  return new Date(dateStr).toLocaleString('fr-FR', {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * Tronque un texte à N caractères avec "…" si dépassement.
 *
 * @param text - Texte à tronquer
 * @param max - Nombre de caractères max (défaut: 120)
 * @returns Texte tronqué
 */
function truncate(text: string, max = 120): string {
  return text.length > max ? `${text.slice(0, max)}…` : text
}

// ─── Sous-composant : ligne de médias (avant ou après) ────────────────────────

interface MediaRowProps {
  /** Label affiché à gauche ("Avant" ou "Après") */
  label: string
  /** URLs des médias à afficher */
  urls: string[]
  /**
   * Callback de suppression d'un média.
   * Absent pour les lignes en lecture seule (phase "Avant").
   */
  onRemove?: (url: string) => void
  /**
   * Items du pool disponibles pour ajout (non encore inclus dans urls).
   * Absent pour les lignes en lecture seule.
   */
  poolItems?: PoolMedia[]
  /** Callback d'ajout d'un média depuis le pool */
  onAddFromPool?: (item: PoolMedia) => void
  /** Si true, les vignettes sont grisées et non interactives */
  dimmed?: boolean
}

/**
 * Ligne compacte affichant des vignettes de médias.
 * En mode lecture (dimmed=true) : vignettes semi-transparentes sans contrôle.
 * En mode édition : bouton ✕ sur chaque vignette + bouton [+] pour ajouter du pool.
 */
function MediaRow({ label, urls, onRemove, poolItems, onAddFromPool, dimmed }: MediaRowProps): React.JSX.Element | null {
  // N'afficher la ligne "Avant" que s'il y a des médias à montrer
  if (dimmed && urls.length === 0) return null

  return (
    <div className="flex items-start gap-2">
      {/* Label "Avant" / "Après" */}
      <span
        className={[
          'mt-0.5 shrink-0 text-[10px] font-medium w-8',
          dimmed ? 'text-muted-foreground/60' : 'text-foreground/70',
        ].join(' ')}
      >
        {label}
      </span>

      {/* Vignettes */}
      <div className="flex flex-wrap items-center gap-1.5">
        {urls.map((url) => (
          <div
            key={url}
            className={[
              'relative size-10 overflow-hidden rounded border bg-muted shrink-0',
              dimmed ? 'opacity-50' : '',
            ].join(' ')}
          >
            {/* Aperçu image ou badge vidéo */}
            {isVideoUrl(url) ? (
              <div className="flex size-full items-center justify-center">
                <span className="text-[8px] font-bold uppercase text-muted-foreground">Vidéo</span>
              </div>
            ) : (
              <img
                src={url}
                alt=""
                className="size-full object-cover"
              />
            )}

            {/* Bouton ✕ de suppression (mode édition uniquement) */}
            {!dimmed && onRemove && (
              <button
                type="button"
                onClick={() => onRemove(url)}
                aria-label="Supprimer ce média"
                className="absolute right-0 top-0 flex size-3.5 items-center justify-center rounded-bl rounded-tr bg-black/70 text-white hover:bg-black/90"
              >
                <X className="size-2" />
              </button>
            )}
          </div>
        ))}

        {/* Bouton [+] pour ajouter du pool (affiché uniquement si le pool n'est pas vide) */}
        {!dimmed && poolItems && poolItems.length > 0 && onAddFromPool && (
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label="Ajouter un média depuis le pool"
                className="flex size-10 shrink-0 items-center justify-center rounded border-2 border-dashed border-border/60 text-muted-foreground transition-colors hover:border-primary hover:text-primary"
              >
                <Plus className="size-3.5" />
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-auto p-1.5">
              {/* Liste des items du pool disponibles pour ce post */}
              <div className="flex flex-wrap gap-1.5 max-w-[200px]">
                {poolItems.map((item) => (
                  <button
                    key={item.url}
                    type="button"
                    onClick={() => onAddFromPool(item)}
                    aria-label={`Ajouter ${item.filename}`}
                    className="relative size-12 overflow-hidden rounded border bg-muted hover:opacity-80 transition-opacity"
                    title={item.filename}
                  >
                    {item.type === 'photo' ? (
                      <img src={item.url} alt={item.filename} className="size-full object-cover" />
                    ) : (
                      <div className="flex size-full items-center justify-center">
                        <span className="text-[8px] font-bold uppercase text-muted-foreground">Vidéo</span>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        )}

        {/* Message si la ligne "Après" est vide et qu'il n'y a rien dans le pool */}
        {!dimmed && urls.length === 0 && (!poolItems || poolItems.length === 0) && (
          <span className="text-[10px] text-muted-foreground/60 italic">aucun média</span>
        )}
      </div>
    </div>
  )
}

// ─── Composant principal ───────────────────────────────────────────────────────

/**
 * Éditeur en masse via instruction libre.
 * Gère les 3 phases : saisie de l'instruction → preview avant/après → confirmation.
 * Intègre un pool de médias partagés (upload, galerie, drag & drop) optionnel.
 */
export function AgentModalBulkEdit({ posts, onPostsUpdated, onClose }: AgentModalBulkEditProps): React.JSX.Element {
  // Préfixe unique pour les IDs d'upload (évite les collisions si plusieurs modales)
  const uploadIdPrefix = useId()
  /** Référence vers l'input file caché (déclenchement programmatique) */
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [phase, setPhase] = useState<Phase>('input')
  const [instruction, setInstruction] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [isApplying, setIsApplying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  /** true quand l'erreur est un 503 Anthropic surchargé (récupérable → bouton Réessayer) */
  const [canRetry, setCanRetry] = useState(false)
  /** Modifications proposées par l'IA (phase preview) */
  const [proposedEdits, setProposedEdits] = useState<ProposedEdit[]>([])
  /** Nombre de posts mis à jour lors de la phase succès */
  const [updatedCount, setUpdatedCount] = useState(0)

  // ── Pool de médias partagés (phase 1) ──────────────────────────────────────
  /** Médias uploadés ou sélectionnés depuis la galerie — transmis à Claude */
  const [mediaPool, setMediaPool] = useState<PoolMedia[]>([])
  /** Fichiers en cours d'upload avec suivi de progression */
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([])
  /** Contrôle l'ouverture du MediaPicker (sélection galerie) */
  const [pickerOpen, setPickerOpen] = useState(false)

  // ── Drag & Drop ─────────────────────────────────────────────────────────────
  /** Compteur d'entrées DnD pour gérer les faux dragLeave causés par les éléments enfants */
  const dragCounterRef = useRef(0)
  const [isDraggingOver, setIsDraggingOver] = useState(false)

  // ── Dictée vocale (Web Speech API — natif, aucun appel serveur) ───────────
  const speechSilenceTimeoutMs = useAppStore((s) => s.speechSilenceTimeoutMs)
  const { isListening, startListening, stopListening, isSupported } = useSpeechRecognition({
    silenceTimeoutMs: speechSilenceTimeoutMs,
    onResult: (text) => {
      setInstruction((prev) => (prev.trim() ? `${prev.trim()} ${text}` : text))
    },
  })

  const isDisabled = isGenerating || isApplying || isListening

  // ── Plateformes uniques affichées dans le résumé ───────────────────────────
  // Dédupliquées pour ne montrer chaque icône qu'une fois
  const uniquePlatforms = [...new Set(posts.map((p) => p.platform))]

  // ── Upload d'un fichier ────────────────────────────────────────────────────

  /**
   * Upload un fichier vers Supabase Storage via presigned URL.
   * Ajoute le fichier au pool partagé avec suivi de progression (0 → 100).
   *
   * @param file - Fichier image ou vidéo sélectionné ou déposé
   */
  const handleUploadFile = useCallback(async (file: File): Promise<void> => {
    const uploadId = `${uploadIdPrefix}-${Date.now()}-${Math.random()}`

    // Valider le type MIME avant tout traitement
    if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
      setError(`Fichier ignoré : "${file.name}" — seules les images et vidéos sont acceptées.`)
      return
    }

    // Ajouter à la liste des uploads en cours (progression visible dans l'UI)
    setUploadingFiles((prev) => [...prev, { id: uploadId, file, progress: 0 }])

    try {
      // 1. Obtenir le presigned URL depuis le Route Handler
      const urlRes = await fetch('/api/posts/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: file.name, mimeType: file.type, size: file.size }),
      })

      if (!urlRes.ok) throw new Error("Impossible d'obtenir l'URL d'upload")
      const { signedUrl, publicUrl } = (await urlRes.json()) as {
        signedUrl: string
        publicUrl: string
      }

      // 2. Upload direct vers Supabase Storage (XHR pour suivi de progression)
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
          xhr.status >= 200 && xhr.status < 300
            ? resolve()
            : reject(new Error(`Upload échoué : ${xhr.status}`))
        })
        xhr.addEventListener('error', () =>
          reject(new Error("Erreur réseau lors de l'upload")),
        )

        xhr.open('PUT', signedUrl)
        xhr.setRequestHeader('Content-Type', file.type)
        xhr.send(file)
      })

      // 3. Ajouter au pool partagé avec type détecté depuis le MIME
      const mediaType: PoolMedia['type'] = file.type.startsWith('video/') ? 'video' : 'photo'
      setMediaPool((prev) => [...prev, { url: publicUrl, type: mediaType, filename: file.name }])
    } catch (err) {
      console.error('[AgentModalBulkEdit] Erreur upload :', err)
      // Afficher l'erreur sur la vignette de progression pendant 3 secondes
      setUploadingFiles((prev) =>
        prev.map((f) => (f.id === uploadId ? { ...f, error: 'Upload échoué' } : f)),
      )
      setTimeout(
        () => setUploadingFiles((prev) => prev.filter((f) => f.id !== uploadId)),
        3000,
      )
      return
    }

    // Nettoyer la vignette de progression une fois terminé
    setUploadingFiles((prev) => prev.filter((f) => f.id !== uploadId))
  }, [uploadIdPrefix])

  /** Gère la sélection de fichiers via l'input file caché */
  const handleFileInputChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
      const files = Array.from(e.target.files ?? [])
      for (const file of files) {
        await handleUploadFile(file)
      }
      // Réinitialiser l'input pour permettre la re-sélection du même fichier
      if (fileInputRef.current) fileInputRef.current.value = ''
    },
    [handleUploadFile],
  )

  // ── Drag & Drop handlers ──────────────────────────────────────────────────

  /**
   * Incrémente le compteur d'entrées DnD.
   * Le compteur évite les faux dragLeave quand le curseur passe sur un enfant.
   */
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    dragCounterRef.current += 1
    if (dragCounterRef.current === 1) setIsDraggingOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    dragCounterRef.current -= 1
    if (dragCounterRef.current === 0) setIsDraggingOver(false)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
  }, [])

  /** Dépose les fichiers images/vidéos dans la zone DnD et lance leur upload */
  const handleDrop = useCallback(
    async (e: React.DragEvent): Promise<void> => {
      e.preventDefault()
      dragCounterRef.current = 0
      setIsDraggingOver(false)

      const files = Array.from(e.dataTransfer.files).filter(
        (f) => f.type.startsWith('image/') || f.type.startsWith('video/'),
      )
      for (const file of files) {
        await handleUploadFile(file)
      }
    },
    [handleUploadFile],
  )

  // ── Phase 1 → Phase 2 : génération des modifications ──────────────────────

  /**
   * Appelle /api/agent/edit-posts-batch et passe à la phase preview.
   * N'écrit pas en DB — retourne uniquement les propositions de l'IA.
   * Transmet également le pool de médias partagés à Claude.
   */
  const handleGenerate = async (): Promise<void> => {
    if (!instruction.trim() || isGenerating) return

    setError(null)
    setCanRetry(false)
    setIsGenerating(true)

    let isRetryableError = false

    try {
      const res = await fetch('/api/agent/edit-posts-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          postIds: posts.map((p) => p.id),
          instruction: instruction.trim(),
          // Pool de médias partagés — optionnel, transmis à Claude pour distribution entre posts
          mediaPool,
        }),
      })

      const data = (await res.json()) as { edits?: ProposedEdit[]; error?: string }

      if (!res.ok || !data.edits) {
        if (res.status === 503) {
          isRetryableError = true
          setCanRetry(true)
        }
        throw new Error(data.error ?? `Erreur ${res.status}`)
      }

      setProposedEdits(data.edits)
      setPhase('preview')
    } catch (err) {
      if (isRetryableError) {
        console.warn('[AgentModalBulkEdit] Anthropic surchargé (503) — invite à réessayer')
      } else {
        console.error('[AgentModalBulkEdit] Erreur génération :', err)
      }
      setError(
        err instanceof Error ? err.message : 'Erreur lors de la génération. Veuillez réessayer.',
      )
    } finally {
      setIsGenerating(false)
    }
  }

  // ── Fonctions d'édition médias par post (phase 2) ─────────────────────────

  /**
   * Retire une URL des médias proposés pour un post donné.
   * Modifie le tableau proposedEdits localement (pas de DB à ce stade).
   *
   * @param postId - ID du post concerné
   * @param url - URL du média à retirer
   */
  const handleRemoveMedia = (postId: string, url: string): void => {
    setProposedEdits((prev) =>
      prev.map((e) =>
        e.postId === postId
          ? { ...e, mediaUrls: e.mediaUrls.filter((u) => u !== url) }
          : e,
      ),
    )
  }

  /**
   * Ajoute un item du pool de médias aux médias proposés pour un post donné.
   * Ignore l'ajout si l'URL est déjà présente dans ce post.
   *
   * @param postId - ID du post concerné
   * @param item - Item du pool à ajouter
   */
  const handleAddMediaFromPool = (postId: string, item: PoolMedia): void => {
    setProposedEdits((prev) =>
      prev.map((e) =>
        e.postId === postId && !e.mediaUrls.includes(item.url)
          ? { ...e, mediaUrls: [...e.mediaUrls, item.url] }
          : e,
      ),
    )
  }

  // ── Phase 2 → Phase 3 : application des modifications confirmées ───────────

  /**
   * Appelle la Server Action bulkApplyEdits avec les modifications confirmées.
   * Reconstruit une version optimiste des posts mis à jour pour le callback onPostsUpdated.
   */
  const handleApply = async (): Promise<void> => {
    if (isApplying) return

    setError(null)
    setIsApplying(true)

    try {
      const result = await bulkApplyEdits(proposedEdits)

      if (result.errors.length > 0 && result.updated === 0) {
        throw new Error(result.errors[0])
      }

      // Reconstruction optimiste des posts mis à jour depuis les ProposedEdit confirmées.
      // bulkApplyEdits retourne { updated, errors } sans les posts complets.
      // On mappe chaque ProposedEdit vers une version updatée du post original.
      const postMap = new Map(posts.map((p) => [p.id, p]))
      // Le `.flatMap` avec un tableau vide pour les nulls évite le type predicate
      // (contournement du conflit status : 'DRAFT'|'SCHEDULED' vs Post['status']).
      const updatedPosts: Post[] = proposedEdits.flatMap((edit) => {
        const original = postMap.get(edit.postId)
        if (!original) return []

        const isValidFuture =
          !!edit.scheduledFor &&
          !isNaN(new Date(edit.scheduledFor).getTime()) &&
          new Date(edit.scheduledFor) > new Date()

        const updated: Post = {
          ...original,
          text: edit.text,
          mediaUrls: edit.mediaUrls,
          scheduledFor: isValidFuture ? new Date(edit.scheduledFor!) : null,
          status: isValidFuture ? 'SCHEDULED' : 'DRAFT',
          latePostId: null,
          failureReason: null,
          publishedAt: null,
        }
        return [updated]
      })

      setUpdatedCount(result.updated)
      onPostsUpdated(updatedPosts)
      setPhase('success')
    } catch (err) {
      console.error('[AgentModalBulkEdit] Erreur application :', err)
      setError(
        err instanceof Error ? err.message : "Erreur lors de l'application. Veuillez réessayer.",
      )
    } finally {
      setIsApplying(false)
    }
  }

  // ── Phase 3 : succès ───────────────────────────────────────────────────────

  if (phase === 'success') {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2 text-green-600">
          <CheckCircle className="size-5 shrink-0" />
          <p className="text-sm font-medium">
            {updatedCount} post{updatedCount !== 1 ? 's' : ''} modifié{updatedCount !== 1 ? 's' : ''} avec succès
          </p>
        </div>
        <Button onClick={onClose} className="w-full">
          Fermer
        </Button>
      </div>
    )
  }

  // ── Phase 2 : preview avant/après ─────────────────────────────────────────

  if (phase === 'preview') {
    return (
      <div className="flex h-full flex-col gap-4">
        {/* Zone scrollable : liste des previews avant/après */}
        <div className="min-h-0 flex-1 overflow-y-auto space-y-3 pr-1">
          <p className="text-xs text-muted-foreground">
            Vérifiez les modifications proposées avant de les appliquer.
            {mediaPool.length > 0 && (
              <> Vous pouvez ajuster les médias de chaque post via le bouton&nbsp;+.</>
            )}
          </p>

          {proposedEdits.map((edit) => {
            // Retrouver le post original pour afficher la comparaison avant/après
            const original = posts.find((p) => p.id === edit.postId)
            if (!original) return null

            const config = PLATFORM_CONFIG[original.platform as keyof typeof PLATFORM_CONFIG]

            // Détecter si la date a changé
            const origDateStr = original.scheduledFor
              ? new Date(original.scheduledFor).toISOString()
              : null
            const dateChanged = origDateStr !== edit.scheduledFor

            // Items du pool non encore inclus dans ce post (disponibles pour ajout)
            const availablePoolItems = mediaPool.filter(
              (m) => !edit.mediaUrls.includes(m.url),
            )

            return (
              <div
                key={edit.postId}
                className="rounded-lg border border-border bg-card p-3 space-y-2"
              >
                {/* En-tête : icône plateforme + nom */}
                <div className="flex items-center gap-2">
                  <div
                    className="flex size-6 shrink-0 items-center justify-center rounded"
                    style={{ backgroundColor: config?.bgColor ?? '#f5f5f5' }}
                  >
                    {config ? (
                      <img src={config.iconPath} alt={config.label} className="size-4 object-contain" />
                    ) : (
                      <span className="text-[9px] font-bold text-muted-foreground uppercase">
                        {original.platform.slice(0, 2)}
                      </span>
                    )}
                  </div>
                  <span className="text-xs font-semibold">
                    {config?.label ?? original.platform}
                  </span>
                </div>

                {/* Comparaison texte avant / après */}
                <div className="space-y-1.5">
                  {/* Avant */}
                  <div className="rounded bg-muted/40 px-2.5 py-1.5">
                    <p className="text-[10px] font-medium text-muted-foreground mb-0.5">Avant</p>
                    <p className="text-xs text-foreground/70 leading-relaxed">
                      {truncate(original.text)}
                    </p>
                  </div>
                  {/* Après */}
                  <div className="rounded bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 px-2.5 py-1.5">
                    <p className="text-[10px] font-medium text-green-700 dark:text-green-400 mb-0.5">Après</p>
                    <p className="text-xs text-foreground leading-relaxed">
                      {truncate(edit.text)}
                    </p>
                  </div>
                </div>

                {/* Comparaison médias avant / après (visible si médias présents ou pool disponible) */}
                {(original.mediaUrls.length > 0 || edit.mediaUrls.length > 0 || mediaPool.length > 0) && (
                  <div className="space-y-1 pt-1 border-t border-border/50">
                    {/* Ligne "Avant" : médias du post original, lecture seule */}
                    <MediaRow
                      label="Avant"
                      urls={original.mediaUrls}
                      dimmed
                    />

                    {/* Ligne "Après" : médias proposés par l'IA, éditables */}
                    <MediaRow
                      label="Après"
                      urls={edit.mediaUrls}
                      onRemove={(url) => handleRemoveMedia(edit.postId, url)}
                      poolItems={availablePoolItems}
                      onAddFromPool={(item) => handleAddMediaFromPool(edit.postId, item)}
                    />
                  </div>
                )}

                {/* Comparaison date (uniquement si elle a changé) */}
                {dateChanged && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1">
                    <span className="text-muted-foreground/60 line-through">
                      {formatDate(original.scheduledFor)}
                    </span>
                    <span>→</span>
                    <span className="font-medium text-foreground">
                      {formatDate(edit.scheduledFor)}
                    </span>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Erreur */}
        {error && (
          <div className="rounded-lg bg-destructive/10 px-3.5 py-2.5 text-sm text-destructive shrink-0">
            {error}
          </div>
        )}

        {/* Footer : Revenir / Appliquer */}
        <div className="flex items-center justify-between gap-3 border-t border-border pt-4 shrink-0">
          <button
            type="button"
            onClick={() => { setPhase('input'); setError(null) }}
            disabled={isApplying}
            className="flex items-center gap-1.5 text-sm text-muted-foreground underline-offset-4 hover:underline disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ArrowLeft className="size-3.5" />
            Revenir
          </button>

          <Button
            onClick={() => void handleApply()}
            disabled={isApplying}
            className="gap-2"
          >
            {isApplying ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Application en cours...
              </>
            ) : (
              <>
                <CheckCircle className="size-4" />
                Appliquer à {proposedEdits.length} post{proposedEdits.length !== 1 ? 's' : ''}
              </>
            )}
          </Button>
        </div>
      </div>
    )
  }

  // ── Phase 1 : saisie de l'instruction + pool de médias ────────────────────

  return (
    <div className="flex h-full flex-col gap-4">
      {/* Zone scrollable */}
      <div className="min-h-0 flex-1 overflow-y-auto space-y-4 pr-1">

        {/* Résumé des posts sélectionnés */}
        <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2.5">
          {/* Icônes des plateformes uniques (max 4 affichées, reste en "+N") */}
          <div className="flex items-center gap-1 shrink-0">
            {uniquePlatforms.slice(0, 4).map((platform) => {
              const cfg = PLATFORM_CONFIG[platform as keyof typeof PLATFORM_CONFIG]
              return (
                <div
                  key={platform}
                  className="flex size-5 items-center justify-center rounded"
                  style={{ backgroundColor: cfg?.bgColor ?? '#f5f5f5' }}
                >
                  {cfg ? (
                    <img src={cfg.iconPath} alt={cfg.label} className="size-3.5 object-contain" />
                  ) : (
                    <span className="text-[8px] font-bold uppercase text-muted-foreground">
                      {platform.slice(0, 1)}
                    </span>
                  )}
                </div>
              )
            })}
            {uniquePlatforms.length > 4 && (
              <span className="text-xs text-muted-foreground">+{uniquePlatforms.length - 4}</span>
            )}
          </div>

          {/* Compteur de posts */}
          <span className="text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">{posts.length}</span>
            {' '}post{posts.length !== 1 ? 's' : ''} sélectionné{posts.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* ── Pool de médias partagés (optionnel) ─────────────────────────── */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">
              Médias à distribuer
              {mediaPool.length > 0 && (
                <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                  ({mediaPool.length})
                </span>
              )}
              <span className="ml-1.5 text-xs font-normal text-muted-foreground/60">
                — optionnel
              </span>
            </span>

            {/* Input file caché — déclenché par le bouton "Ajouter" */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              multiple
              className="hidden"
              onChange={(e) => void handleFileInputChange(e)}
            />

            <div className="flex items-center gap-1.5">
              {/* Bouton "Galerie" — ouvre le MediaPicker (réutiliser des médias existants) */}
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isDisabled}
                onClick={() => setPickerOpen(true)}
                className="gap-1.5 text-xs"
              >
                <LayoutGrid className="size-3.5" />
                Galerie
              </Button>

              {/* Bouton "Ajouter" — upload direct depuis l'appareil */}
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isDisabled}
                onClick={() => fileInputRef.current?.click()}
                className="gap-1.5 text-xs"
              >
                <ImagePlus className="size-3.5" />
                Ajouter
              </Button>
            </div>
          </div>

          {/* Zone drag & drop */}
          <div
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={(e) => void handleDrop(e)}
            className={[
              'min-h-[64px] rounded-lg border-2 border-dashed transition-colors duration-150',
              isDraggingOver
                ? 'border-primary bg-primary/5'
                : 'border-border/50 bg-transparent',
            ].join(' ')}
          >
            {/* Fichiers en cours d'upload (barres de progression) */}
            {uploadingFiles.length > 0 && (
              <div className="space-y-1.5 p-2">
                {uploadingFiles.map((f) => (
                  <div
                    key={f.id}
                    className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs text-foreground">{f.file.name}</p>
                      {f.error ? (
                        <p className="text-xs text-destructive">{f.error}</p>
                      ) : (
                        <div className="mt-1 h-1 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-primary transition-all duration-300"
                            style={{ width: `${f.progress}%` }}
                          />
                        </div>
                      )}
                    </div>
                    {!f.error && (
                      <Loader2 className="size-3.5 shrink-0 animate-spin text-muted-foreground" />
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Vignettes du pool avec bouton ✕ de suppression */}
            {mediaPool.length > 0 && (
              <div className="flex flex-wrap gap-2 p-2">
                {mediaPool.map((media) => (
                  <div
                    key={media.url}
                    className="relative size-14 overflow-hidden rounded border border-border bg-muted"
                  >
                    {media.type === 'photo' ? (
                      <img
                        src={media.url}
                        alt={media.filename}
                        className="size-full object-cover"
                      />
                    ) : (
                      <div className="flex size-full items-center justify-center">
                        <span className="text-[9px] font-bold uppercase text-muted-foreground">Vidéo</span>
                      </div>
                    )}

                    {/* Bouton ✕ — retirer du pool partagé */}
                    <button
                      type="button"
                      onClick={() =>
                        setMediaPool((prev) => prev.filter((m) => m.url !== media.url))
                      }
                      disabled={isDisabled}
                      aria-label={`Supprimer ${media.filename} du pool`}
                      className="absolute right-0.5 top-0.5 flex size-4 items-center justify-center rounded-full bg-black/70 text-white transition-opacity hover:bg-black/90 disabled:pointer-events-none"
                    >
                      <X className="size-2.5" />
                    </button>
                  </div>
                ))}

                {/* Indicateur visuel de drop actif quand le pool n'est pas vide */}
                {isDraggingOver && (
                  <div className="flex size-14 items-center justify-center rounded border-2 border-dashed border-primary bg-primary/10">
                    <span className="text-[10px] font-medium text-primary">+</span>
                  </div>
                )}
              </div>
            )}

            {/* Zone vide — invite de drop */}
            {mediaPool.length === 0 && uploadingFiles.length === 0 && (
              <div className="flex flex-col items-center justify-center gap-1 py-4 text-center">
                {isDraggingOver ? (
                  <p className="text-sm font-medium text-primary">Déposez vos fichiers ici</p>
                ) : (
                  <p className="text-xs text-muted-foreground/60">
                    Glissez-déposez des images/vidéos ou utilisez les boutons ci-dessus
                  </p>
                )}
              </div>
            )}
          </div>

          <p className="text-xs text-muted-foreground/60">
            Ces médias seront transmis à Claude. Il pourra les distribuer entre les posts si votre instruction le demande.
          </p>
        </div>

        {/* Zone d'instruction */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label htmlFor="bulk-instruction" className="text-sm font-medium text-foreground">
              Instruction de modification
            </label>

            {/* Bouton dictée vocale */}
            {isSupported && (
              <button
                type="button"
                onClick={isListening ? stopListening : startListening}
                disabled={isGenerating}
                aria-label={isListening ? 'Arrêter la dictée vocale' : 'Démarrer la dictée vocale'}
                className={[
                  'flex size-7 items-center justify-center rounded-full transition-all',
                  isListening
                    ? 'animate-pulse bg-red-100 text-red-500 hover:bg-red-200'
                    : 'bg-violet-100 text-violet-600 hover:bg-violet-200',
                  isGenerating ? 'cursor-not-allowed opacity-50' : '',
                ].join(' ')}
              >
                {isListening ? <MicOff className="size-3.5" /> : <Mic className="size-3.5" />}
              </button>
            )}
          </div>

          <Textarea
            id="bulk-instruction"
            placeholder="Ex: Ajoute #promo2026 à chaque post · Ajoute le média du pool aux posts Instagram · Reprogramme tout pour demain 9h"
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            disabled={isDisabled}
            rows={4}
            className="resize-none text-sm field-sizing-fixed"
          />

          <p className="text-xs text-muted-foreground">
            {isListening ? (
              <span className="font-medium text-red-500">● En cours d&apos;écoute… (parlez maintenant)</span>
            ) : (
              "L'instruction sera appliquée à chaque post individuellement."
            )}
          </p>
        </div>

        {/* Erreur */}
        {error && (
          <div className="rounded-lg bg-destructive/10 px-3.5 py-2.5 text-sm text-destructive">
            <p>{error}</p>
            {canRetry && (
              <button
                type="button"
                onClick={() => void handleGenerate()}
                className="mt-2 text-xs font-medium underline underline-offset-2 hover:no-underline"
              >
                Réessayer
              </button>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between gap-3 border-t border-border pt-4 shrink-0">
        <button
          type="button"
          onClick={onClose}
          disabled={isDisabled}
          className="text-sm text-muted-foreground underline-offset-4 hover:underline disabled:cursor-not-allowed disabled:opacity-50"
        >
          Annuler
        </button>

        <Button
          onClick={() => void handleGenerate()}
          disabled={isDisabled || !instruction.trim() || uploadingFiles.length > 0}
          className="gap-2"
        >
          {isGenerating ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Génération en cours...
            </>
          ) : (
            <>
              <Sparkles className="size-4" />
              Générer les modifications
            </>
          )}
        </Button>
      </div>

      {/* ── Dialog sélection galerie ─────────────────────────────────────────── */}
      {/* Portail Radix — rendu dans document.body, non affecté par le scroll wrapper */}
      <MediaPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        selectedUrls={mediaPool.map((m) => m.url)}
        onConfirm={(urls) => {
          // Fusionner les nouvelles URLs avec le pool existant (sans doublons)
          const newItems = urls
            .filter((url) => !mediaPool.some((m) => m.url === url))
            .map((url) => ({
              url,
              type: isVideoUrl(url) ? ('video' as const) : ('photo' as const),
              filename: decodeURIComponent(url.split('/').pop()?.split('?')[0] ?? 'fichier'),
            }))
          setMediaPool((prev) => [...prev, ...newItems])
          setPickerOpen(false)
        }}
      />
    </div>
  )
}
