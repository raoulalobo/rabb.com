/**
 * @file modules/posts/components/AgentModal/AgentModalEdit.tsx
 * @module posts
 * @description Zone d'édition d'un post existant via une instruction libre.
 *
 *   Permet :
 *   - Saisir une instruction de modification (texte ou dictée vocale)
 *   - Ajouter de nouveaux médias via bouton ou glisser-déposer (drag & drop)
 *   - Supprimer des médias existants (croix sur chaque vignette)
 *   - Appeler POST /api/agent/edit-post → post mis à jour en DB
 *
 *   Le pool de médias est initialisé avec les URLs actuelles du post.
 *   L'agent reçoit le pool final (ajouts + suppressions) et met à jour le post.
 *
 * @example
 *   <AgentModalEdit
 *     post={selectedPost}
 *     onPostUpdated={(updatedPost) => { updatePostInList(updatedPost) }}
 *     onClose={() => setOpen(false)}
 *   />
 */

'use client'

import { CheckCircle, ImagePlus, Loader2, Mic, MicOff, Pencil, X } from 'lucide-react'
import { useCallback, useId, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { PLATFORM_CONFIG } from '@/modules/platforms/constants'
import { useVoiceRecorder } from '@/modules/posts/hooks/useVoiceRecorder'
import type { Post, PoolMedia, UploadingFile } from '@/modules/posts/types'

// ─── Props ────────────────────────────────────────────────────────────────────

interface AgentModalEditProps {
  /** Post à modifier */
  post: Post
  /** Callback appelé après la mise à jour réussie du post */
  onPostUpdated: (post: Post) => void
  /** Callback pour fermer la modale */
  onClose: () => void
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Détermine si une URL pointe vers une vidéo selon son extension.
 * Utilisé pour initialiser le type des médias existants du post.
 */
function isVideoUrl(url: string): boolean {
  return /\.(mp4|mov|avi|webm|mkv|m4v|ogv)$/i.test(url.split('?')[0])
}

// ─── Composant ────────────────────────────────────────────────────────────────

/**
 * Zone d'édition d'un post via instruction libre ou dictée vocale.
 * Affiche le post actuel avec gestion complète des médias (ajout DnD + suppression).
 */
export function AgentModalEdit({ post, onPostUpdated, onClose }: AgentModalEditProps): React.JSX.Element {
  const uploadIdPrefix = useId()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [instruction, setInstruction] = useState('')
  const [isUpdating, setIsUpdating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isSuccess, setIsSuccess] = useState(false)

  // ── Pool de médias — initialisé depuis les URLs actuelles du post ───────────
  const [mediaPool, setMediaPool] = useState<PoolMedia[]>(() =>
    post.mediaUrls.map((url) => ({
      url,
      // Détecter le type depuis l'extension de l'URL
      type: isVideoUrl(url) ? 'video' : 'photo',
      // Nom de fichier extrait de l'URL (dernier segment avant le ?)
      filename: decodeURIComponent(url.split('/').pop()?.split('?')[0] ?? 'fichier'),
    })),
  )

  /** Fichiers en cours d'upload (avec progression) */
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([])

  // ── Drag & Drop ─────────────────────────────────────────────────────────────
  /** Compteur d'entrées DnD (pour gérer les faux dragLeave causés par les enfants) */
  const dragCounterRef = useRef(0)
  const [isDraggingOver, setIsDraggingOver] = useState(false)

  // Config visuelle de la plateforme
  const config = PLATFORM_CONFIG[post.platform as keyof typeof PLATFORM_CONFIG]

  // ── Dictée vocale ─────────────────────────────────────────────────────────
  const { status: micStatus, startRecording, stopRecording } = useVoiceRecorder({
    /** Appende le texte transcrit à l'instruction existante */
    onTranscription: (text) => {
      setInstruction((prev) => (prev.trim() ? `${prev.trim()} ${text}` : text))
    },
    onError: (msg) => setError(msg),
  })

  const isMicBusy = micStatus !== 'idle'
  const isDisabled = isUpdating || isMicBusy

  // ── Upload d'un fichier ────────────────────────────────────────────────────

  /**
   * Upload un fichier vers Supabase Storage via presigned URL.
   * Ajoute le fichier au pool avec suivi de progression (0→100).
   *
   * @param file - Fichier image ou vidéo sélectionné / déposé
   */
  const handleUploadFile = useCallback(async (file: File): Promise<void> => {
    const uploadId = `${uploadIdPrefix}-${Date.now()}-${Math.random()}`

    // Valider le type MIME
    if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
      setError(`Fichier ignoré : "${file.name}" — seules les images et vidéos sont acceptées.`)
      return
    }

    setUploadingFiles((prev) => [...prev, { id: uploadId, file, progress: 0 }])

    try {
      // 1. Obtenir le presigned URL
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

      // 2. Upload direct vers Supabase (avec suivi de progression)
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

      // 3. Ajouter au pool
      const mediaType: PoolMedia['type'] = file.type.startsWith('video/') ? 'video' : 'photo'
      setMediaPool((prev) => [...prev, { url: publicUrl, type: mediaType, filename: file.name }])
    } catch (err) {
      console.error('[AgentModalEdit] Erreur upload :', err)
      setUploadingFiles((prev) =>
        prev.map((f) => (f.id === uploadId ? { ...f, error: 'Upload échoué' } : f)),
      )
      setTimeout(
        () => setUploadingFiles((prev) => prev.filter((f) => f.id !== uploadId)),
        3000,
      )
      return
    }

    setUploadingFiles((prev) => prev.filter((f) => f.id !== uploadId))
  }, [uploadIdPrefix])

  /** Gère la sélection via l'input file caché */
  const handleFileInputChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
      const files = Array.from(e.target.files ?? [])
      for (const file of files) {
        await handleUploadFile(file)
      }
      if (fileInputRef.current) fileInputRef.current.value = ''
    },
    [handleUploadFile],
  )

  // ── Drag & Drop handlers ──────────────────────────────────────────────────

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

  // ── Mise à jour du post ────────────────────────────────────────────────────

  /**
   * Appelle POST /api/agent/edit-post avec l'instruction et le pool de médias final.
   * L'agent reçoit les médias à conserver (pool actuel après ajouts/suppressions).
   */
  const handleUpdate = async (): Promise<void> => {
    if (!instruction.trim() || isUpdating) return

    setError(null)
    setIsUpdating(true)

    try {
      const res = await fetch('/api/agent/edit-post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          postId: post.id,
          instruction: instruction.trim(),
          // Passer le pool final (médias conservés + nouveaux ajouts)
          mediaPool,
        }),
      })

      const data = (await res.json()) as { post?: Post; error?: string }

      if (!res.ok || !data.post) {
        throw new Error(data.error ?? `Erreur ${res.status}`)
      }

      onPostUpdated(data.post)
      setIsSuccess(true)
    } catch (err) {
      console.error('[AgentModalEdit] Erreur mise à jour :', err)
      setError(
        err instanceof Error ? err.message : 'Erreur lors de la mise à jour. Veuillez réessayer.',
      )
    } finally {
      setIsUpdating(false)
    }
  }

  // ── Étape de succès ────────────────────────────────────────────────────────

  if (isSuccess) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-green-600">
          <CheckCircle className="size-5" />
          <p className="text-sm font-medium">Post mis à jour avec succès</p>
        </div>
        <Button onClick={onClose} className="w-full">
          Fermer
        </Button>
      </div>
    )
  }

  // ── Rendu principal ───────────────────────────────────────────────────────

  return (
    <div className="space-y-4">

      {/* En-tête plateforme */}
      <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2">
        {config && (
          <img src={config.iconPath} alt={config.label} className="size-4 object-contain" />
        )}
        <span className="text-xs font-medium text-muted-foreground">
          {config?.label ?? post.platform}
        </span>
        {/* Aperçu du texte actuel */}
        <p className="ml-2 line-clamp-1 min-w-0 flex-1 text-xs text-foreground/70">
          {post.text}
        </p>
      </div>

      {/* ── Zone médias (lecture + édition + DnD) ─────────────────────────── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-foreground">
            Médias
            {mediaPool.length > 0 && (
              <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                ({mediaPool.length})
              </span>
            )}
          </span>

          {/* Input file caché */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*"
            multiple
            className="hidden"
            onChange={(e) => void handleFileInputChange(e)}
          />
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

        {/* Zone de drop */}
        <div
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={(e) => void handleDrop(e)}
          className={[
            'min-h-[72px] rounded-lg border-2 border-dashed transition-colors duration-150',
            isDraggingOver
              ? 'border-primary bg-primary/5'
              : 'border-border/50 bg-transparent',
          ].join(' ')}
        >
          {/* Fichiers en cours d'upload */}
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

          {/* Vignettes du pool (médias existants + nouveaux) */}
          {mediaPool.length > 0 && (
            <div className="flex flex-wrap gap-2 p-2">
              {mediaPool.map((media) => (
                <div
                  key={media.url}
                  className="relative size-16 overflow-hidden rounded-lg border border-border bg-muted"
                >
                  {media.type === 'photo' ? (
                    <img
                      src={media.url}
                      alt={media.filename}
                      className="size-full object-cover"
                    />
                  ) : (
                    <div className="flex size-full flex-col items-center justify-center gap-0.5">
                      <span className="text-[10px] font-medium text-muted-foreground">Vidéo</span>
                    </div>
                  )}
                  {/* Bouton suppression */}
                  <button
                    type="button"
                    onClick={() =>
                      setMediaPool((prev) => prev.filter((m) => m.url !== media.url))
                    }
                    disabled={isDisabled}
                    className="absolute right-0.5 top-0.5 flex size-4 items-center justify-center rounded-full bg-black/60 text-white transition-opacity hover:bg-black/80 disabled:pointer-events-none"
                    aria-label={`Supprimer ${media.filename}`}
                  >
                    <X className="size-2.5" />
                  </button>
                </div>
              ))}

              {/* Message de survol DnD quand des médias sont déjà présents */}
              {isDraggingOver && (
                <div className="flex size-16 items-center justify-center rounded-lg border-2 border-dashed border-primary bg-primary/10">
                  <span className="text-[10px] font-medium text-primary">+</span>
                </div>
              )}
            </div>
          )}

          {/* Zone vide — invite de drop */}
          {mediaPool.length === 0 && uploadingFiles.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-1 py-5 text-center">
              {isDraggingOver ? (
                <p className="text-sm font-medium text-primary">Déposez vos fichiers ici</p>
              ) : (
                <>
                  <p className="text-xs text-muted-foreground">
                    Aucun média — glissez-déposez des images ou vidéos
                  </p>
                  <p className="text-xs text-muted-foreground/60">
                    ou utilisez le bouton &quot;Ajouter&quot;
                  </p>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Zone d'instruction ─────────────────────────────────────────────── */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label htmlFor="edit-instruction" className="text-sm font-medium text-foreground">
            Instruction de modification
          </label>

          {/* Bouton dictée vocale */}
          <button
            type="button"
            onClick={micStatus === 'recording' ? stopRecording : () => void startRecording()}
            disabled={isUpdating || micStatus === 'transcribing'}
            aria-label={
              micStatus === 'recording'
                ? "Arrêter l'enregistrement"
                : micStatus === 'transcribing'
                  ? 'Transcription en cours…'
                  : 'Démarrer la dictée vocale'
            }
            className={[
              'flex size-7 items-center justify-center rounded-full transition-all',
              micStatus === 'recording'
                ? 'animate-pulse bg-red-100 text-red-500 hover:bg-red-200'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              isUpdating || micStatus === 'transcribing'
                ? 'cursor-not-allowed opacity-50'
                : '',
            ].join(' ')}
          >
            {micStatus === 'transcribing' ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : micStatus === 'recording' ? (
              <MicOff className="size-3.5" />
            ) : (
              <Mic className="size-3.5" />
            )}
          </button>
        </div>

        <Textarea
          id="edit-instruction"
          placeholder="Ex: Rends le texte plus engageant, supprime les hashtags, garde seulement la première photo"
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          disabled={isDisabled}
          rows={3}
          className="resize-none text-sm"
        />

        <p className="text-xs text-muted-foreground">
          {micStatus === 'recording' && (
            <span className="font-medium text-red-500">● Enregistrement en cours…</span>
          )}
          {micStatus === 'transcribing' && 'Transcription en cours…'}
          {micStatus === 'idle' &&
            'Décrivez ce que vous souhaitez modifier (texte, médias, ton…).'}
        </p>
      </div>

      {/* Erreur */}
      {error && (
        <div className="rounded-lg bg-destructive/10 px-3.5 py-2.5 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
        <button
          type="button"
          onClick={onClose}
          disabled={isDisabled}
          className="text-sm text-muted-foreground underline-offset-4 hover:underline disabled:cursor-not-allowed disabled:opacity-50"
        >
          Annuler
        </button>

        <Button
          onClick={() => void handleUpdate()}
          disabled={isDisabled || !instruction.trim() || uploadingFiles.length > 0}
          className="gap-2"
        >
          {isUpdating ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Modification en cours...
            </>
          ) : (
            <>
              <Pencil className="size-4" />
              Modifier le post
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
