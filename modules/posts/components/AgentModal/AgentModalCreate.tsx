/**
 * @file modules/posts/components/AgentModal/AgentModalCreate.tsx
 * @module posts
 * @description Zone de création de posts via l'agent IA.
 *
 *   Gère :
 *   1. Upload de médias — bouton "Ajouter" OU glisser-déposer (drag & drop)
 *   2. Dictée vocale — bouton micro → Web Speech API → texte inséré dans l'instruction
 *   3. Saisie de l'instruction en texte libre
 *   4. Appel à POST /api/agent/create-posts → N posts DRAFT créés en DB
 *   5. Affichage du résumé des posts créés avant fermeture
 *
 *   Dictée vocale : useSpeechRecognition (natif navigateur, aucun appel serveur).
 *   Le bouton micro est masqué si `isSupported === false` (ex: Firefox sans flag).
 *
 * @example
 *   <AgentModalCreate
 *     onPostsCreated={(posts) => { setPosts((prev) => [...posts, ...prev]) }}
 *     onClose={() => setOpen(false)}
 *   />
 */

'use client'

import { ImagePlus, LayoutGrid, Loader2, Mic, MicOff, Pencil, Sparkles, X } from 'lucide-react'
import { useCallback, useId, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { PLATFORM_CONFIG } from '@/modules/platforms/constants'
import { ImageEditorDialog } from '@/modules/media/components/ImageEditorDialog'
import { MediaPicker } from '@/modules/media/components/MediaPicker'
import { useSpeechRecognition } from '@/modules/posts/hooks/useSpeechRecognition'
import { isVideoUrl } from '@/modules/posts/utils/media.utils'
import { useAppStore } from '@/store/app.store'
import type { Post, PoolMedia, UploadingFile } from '@/modules/posts/types'

// ─── Props ────────────────────────────────────────────────────────────────────

interface AgentModalCreateProps {
  /** Callback appelé après la création réussie des posts */
  onPostsCreated: (posts: Post[]) => void
  /** Callback pour fermer la modale */
  onClose: () => void
}

// ─── Composant ────────────────────────────────────────────────────────────────

/**
 * Zone de création de posts via une instruction libre.
 * Supporte : upload via bouton, drag & drop de fichiers, et dictée vocale.
 */
export function AgentModalCreate({ onPostsCreated, onClose }: AgentModalCreateProps): React.JSX.Element {
  const uploadIdPrefix = useId()
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── État de l'instruction ─────────────────────────────────────────────────
  const [instruction, setInstruction] = useState('')

  // ── État des médias ────────────────────────────────────────────────────────
  /** Médias uploadés avec succès, disponibles pour l'agent */
  const [mediaPool, setMediaPool] = useState<PoolMedia[]>([])
  /** Fichiers en cours d'upload (avec progression) */
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([])

  // ── Galerie / éditeur ──────────────────────────────────────────────────────
  /** Contrôle l'ouverture du MediaPicker (sélection depuis la galerie) */
  const [pickerOpen, setPickerOpen] = useState(false)
  /**
   * Média en cours d'édition dans Filerobot.
   * null = aucun éditeur ouvert.
   */
  const [editingMedia, setEditingMedia] = useState<PoolMedia | null>(null)

  // ── États de chargement / erreur ───────────────────────────────────────────
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ── Posts créés (étape de résumé) ─────────────────────────────────────────
  const [createdPosts, setCreatedPosts] = useState<Post[] | null>(null)

  // ── Drag & Drop ─────────────────────────────────────────────────────────────
  /** Compteur d'entrées DnD (pour gérer les enfants sans faux dragLeave) */
  const dragCounterRef = useRef(0)
  const [isDraggingOver, setIsDraggingOver] = useState(false)

  // ── Dictée vocale (Web Speech API — natif, aucun appel serveur) ──────────
  // Préférence utilisateur : délai de silence avant arrêt automatique du micro
  const speechSilenceTimeoutMs = useAppStore((s) => s.speechSilenceTimeoutMs)

  const { isListening, startListening, stopListening, isSupported } = useSpeechRecognition({
    silenceTimeoutMs: speechSilenceTimeoutMs,
    /**
     * Appende le texte transcrit à l'instruction existante.
     * Sépare par un espace si l'instruction n'est pas vide.
     */
    onResult: (text) => {
      setInstruction((prev) => (prev.trim() ? `${prev.trim()} ${text}` : text))
    },
  })

  // ── Upload d'un fichier ────────────────────────────────────────────────────

  /**
   * Upload un fichier vers Supabase Storage via presigned URL.
   * Ajoute le fichier au pool avec suivi de progression (0→100).
   *
   * @param file - Fichier image ou vidéo sélectionné / déposé
   */
  const handleUploadFile = useCallback(async (file: File): Promise<void> => {
    const uploadId = `${uploadIdPrefix}-${Date.now()}-${Math.random()}`

    // Valider le type MIME (images et vidéos uniquement)
    if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
      setError(`Fichier ignoré : "${file.name}" — seules les images et vidéos sont acceptées.`)
      return
    }

    setUploadingFiles((prev) => [...prev, { id: uploadId, file, progress: 0 }])

    try {
      // 1. Obtenir le presigned URL depuis l'API
      const urlRes = await fetch('/api/posts/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: file.name, mimeType: file.type, size: file.size }),
      })

      if (!urlRes.ok) throw new Error('Impossible d\'obtenir l\'URL d\'upload')
      const { signedUrl, publicUrl } = (await urlRes.json()) as { signedUrl: string; publicUrl: string }

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
          xhr.status >= 200 && xhr.status < 300
            ? resolve()
            : reject(new Error(`Upload échoué : ${xhr.status}`))
        })
        xhr.addEventListener('error', () => reject(new Error('Erreur réseau lors de l\'upload')))

        xhr.open('PUT', signedUrl)
        xhr.setRequestHeader('Content-Type', file.type)
        xhr.send(file)
      })

      // 3. Ajouter au pool avec son type détecté
      const mediaType: PoolMedia['type'] = file.type.startsWith('video/') ? 'video' : 'photo'
      setMediaPool((prev) => [...prev, { url: publicUrl, type: mediaType, filename: file.name }])
    } catch (err) {
      console.error('[AgentModalCreate] Erreur upload :', err)
      setUploadingFiles((prev) =>
        prev.map((f) => (f.id === uploadId ? { ...f, error: 'Upload échoué' } : f)),
      )
      setTimeout(() => setUploadingFiles((prev) => prev.filter((f) => f.id !== uploadId)), 3000)
      return
    }

    setUploadingFiles((prev) => prev.filter((f) => f.id !== uploadId))
  }, [uploadIdPrefix])

  /**
   * Gère la sélection de fichiers via l'input file caché.
   */
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

  /**
   * dragEnter : incrémenter le compteur pour ignorer les faux dragLeave
   * causés par les éléments enfants de la zone de drop.
   */
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    dragCounterRef.current += 1
    if (dragCounterRef.current === 1) setIsDraggingOver(true)
  }, [])

  /**
   * dragLeave : décrémenter le compteur ; masquer le style DnD
   * seulement quand le curseur quitte vraiment la zone (compteur = 0).
   */
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    dragCounterRef.current -= 1
    if (dragCounterRef.current === 0) setIsDraggingOver(false)
  }, [])

  /** dragOver : nécessaire pour autoriser le drop (preventDefault) */
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
  }, [])

  /**
   * drop : extraire les fichiers déposés et les uploader.
   * Filtre les fichiers non-image/vidéo silencieusement.
   */
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

  // ── Génération des posts ────────────────────────────────────────────────────

  /**
   * Appelle POST /api/agent/create-posts avec l'instruction et le pool de médias.
   */
  const handleGenerate = async (): Promise<void> => {
    if (!instruction.trim() || isGenerating || uploadingFiles.length > 0) return

    setError(null)
    setIsGenerating(true)

    try {
      const res = await fetch('/api/agent/create-posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instruction: instruction.trim(), mediaPool }),
      })

      const data = (await res.json()) as { posts?: Post[]; error?: string }

      if (!res.ok || !data.posts) {
        throw new Error(data.error ?? `Erreur ${res.status}`)
      }

      setCreatedPosts(data.posts)
      onPostsCreated(data.posts)
    } catch (err) {
      console.error('[AgentModalCreate] Erreur génération :', err)
      setError(err instanceof Error ? err.message : 'Erreur lors de la génération. Veuillez réessayer.')
    } finally {
      setIsGenerating(false)
    }
  }

  // ── Rendu — étape résumé ──────────────────────────────────────────────────

  if (createdPosts !== null) {
    return (
      <div className="space-y-4">
        {/* En-tête succès */}
        <div className="flex items-center gap-2 text-green-600">
          <div className="flex size-6 items-center justify-center rounded-full bg-green-100">
            <Sparkles className="size-3.5" />
          </div>
          <p className="text-sm font-medium">
            {createdPosts.length} post{createdPosts.length > 1 ? 's' : ''} créé
            {createdPosts.length > 1 ? 's' : ''} avec succès
          </p>
        </div>

        {/* Liste des posts créés */}
        <div className="space-y-2">
          {createdPosts.map((post) => {
            const config = PLATFORM_CONFIG[post.platform as keyof typeof PLATFORM_CONFIG]
            return (
              <div
                key={post.id}
                className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 p-3"
              >
                {config && (
                  <img
                    src={config.iconPath}
                    alt={config.label}
                    className="mt-0.5 size-4 shrink-0 object-contain"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-muted-foreground">
                    {config?.label ?? post.platform}
                  </p>
                  <p className="mt-0.5 line-clamp-2 text-sm text-foreground">{post.text}</p>
                </div>
              </div>
            )
          })}
        </div>

        <div className="flex justify-end">
          <Button onClick={onClose} className="w-full sm:w-auto">
            Voir mes brouillons
          </Button>
        </div>
      </div>
    )
  }

  // ── Rendu — étape principale ──────────────────────────────────────────────

  // Web Speech API : pas d'état 'transcribing' (résultat instantané)
  const isDisabled = isGenerating || isListening

  return (
    <div className="space-y-4">

      {/* ── Zone d'instruction ─────────────────────────────────────────────── */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label htmlFor="agent-instruction" className="text-sm font-medium text-foreground">
            Instruction
          </label>

          {/* Bouton dictée vocale — masqué si Web Speech API non supportée (ex: Firefox) */}
          {isSupported && (
            <MicButton
              isListening={isListening}
              disabled={isGenerating}
              onStart={startListening}
              onStop={stopListening}
            />
          )}
        </div>

        <Textarea
          id="agent-instruction"
          placeholder="Ex: Poste mes 2 photos sur TikTok et Instagram demain matin 9h avec un texte dynamique et des hashtags"
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          disabled={isDisabled}
          rows={4}
          className="resize-none text-sm"
        />

        <p className="text-xs text-muted-foreground">
          {/* Web Speech API : résultat instantané, pas d'état 'transcribing' */}
          {isListening ? (
            <span className="font-medium text-red-500">● En cours d&apos;écoute… (parlez maintenant)</span>
          ) : (
            'Mentionnez les plateformes, la date/heure et le ton souhaité.'
          )}
        </p>
      </div>

      {/* ── Zone médias (avec Drag & Drop) ────────────────────────────────── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-foreground">Médias</span>

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
            {/* Bouton "Galerie" — ouvre le MediaPicker pour réutiliser des médias */}
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

        {/* Zone de drop */}
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

          {/* Médias uploadés dans le pool */}
          {mediaPool.length > 0 && (
            <div className="flex flex-wrap gap-2 p-2">
              {mediaPool.map((media) => (
                <div
                  key={media.url}
                  className="relative size-16 overflow-hidden rounded-lg border border-border bg-muted"
                >
                  {media.type === 'photo' ? (
                    <img src={media.url} alt={media.filename} className="size-full object-cover" />
                  ) : (
                    <div className="flex size-full items-center justify-center">
                      <span className="text-xs text-muted-foreground">Vidéo</span>
                    </div>
                  )}
                  {/* ✏️ Bouton édition — coin haut-gauche, images seulement */}
                  {media.type === 'photo' && (
                    <button
                      type="button"
                      onClick={() => setEditingMedia(media)}
                      disabled={isDisabled}
                      aria-label={`Éditer ${media.filename}`}
                      className="absolute left-0.5 top-0.5 flex size-4 items-center justify-center rounded-full bg-black/60 text-white transition-opacity hover:bg-black/80 disabled:pointer-events-none"
                    >
                      <Pencil className="size-2.5" />
                    </button>
                  )}
                  {/* ✗ Bouton suppression — coin haut-droit */}
                  <button
                    type="button"
                    onClick={() => setMediaPool((prev) => prev.filter((m) => m.url !== media.url))}
                    disabled={isDisabled}
                    className="absolute right-0.5 top-0.5 flex size-4 items-center justify-center rounded-full bg-black/60 text-white transition-opacity hover:bg-black/80 disabled:pointer-events-none"
                    aria-label={`Retirer ${media.filename}`}
                  >
                    <X className="size-2.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Message d'invite quand la zone est vide */}
          {mediaPool.length === 0 && uploadingFiles.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-1 py-4 text-center">
              {isDraggingOver ? (
                <p className="text-sm font-medium text-primary">Déposez vos fichiers ici</p>
              ) : (
                <>
                  <p className="text-xs text-muted-foreground">
                    Glissez-déposez des images ou vidéos ici
                  </p>
                  <p className="text-xs text-muted-foreground/60">
                    ou utilisez le bouton &quot;Ajouter des médias&quot;
                  </p>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Erreur ─────────────────────────────────────────────────────────── */}
      {error && (
        <div className="rounded-lg bg-destructive/10 px-3.5 py-2.5 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* ── Actions ────────────────────────────────────────────────────────── */}
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
              Générer les posts
            </>
          )}
        </Button>
      </div>

      {/* ── Dialog sélection galerie ────────────────────────────────────────── */}
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

      {/* ── Dialog éditeur d'image Filerobot (une seule instance pour tout le pool) ── */}
      {editingMedia && (
        <ImageEditorDialog
          sourceUrl={editingMedia.url}
          open={!!editingMedia}
          onOpenChange={(open) => { if (!open) setEditingMedia(null) }}
          onSave={async (newUrl) => {
            // Remplacer l'ancienne URL dans le pool par la nouvelle (image éditée)
            setMediaPool((prev) =>
              prev.map((m) =>
                m.url === editingMedia.url ? { ...m, url: newUrl } : m,
              ),
            )
            setEditingMedia(null)
          }}
        />
      )}
    </div>
  )
}

// ─── Sous-composant : bouton micro ────────────────────────────────────────────

/**
 * Bouton de dictée vocale adapté à l'interface useSpeechRecognition.
 * Avec Web Speech API, pas d'état intermédiaire "transcribing" (résultat instantané).
 *
 * - `isListening: false` → icône Mic, bouton fantôme, clic = démarrer
 * - `isListening: true`  → icône MicOff rouge + pulse, clic = arrêter
 *
 * @param isListening - `true` si la reconnaissance est active
 * @param disabled    - Désactivé quand la génération est en cours
 * @param onStart     - Démarre la dictée vocale
 * @param onStop      - Arrête la dictée vocale manuellement
 */
function MicButton({
  isListening,
  disabled,
  onStart,
  onStop,
}: {
  isListening: boolean
  disabled: boolean
  onStart: () => void
  onStop: () => void
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={isListening ? onStop : onStart}
      disabled={disabled}
      aria-label={isListening ? "Arrêter la dictée vocale" : 'Démarrer la dictée vocale'}
      className={[
        'flex size-7 items-center justify-center rounded-full transition-all',
        isListening
          ? 'animate-pulse bg-red-100 text-red-500 hover:bg-red-200'
          : 'bg-violet-100 text-violet-600 hover:bg-violet-200',
        disabled ? 'cursor-not-allowed opacity-50' : '',
      ].join(' ')}
    >
      {/* Mic = prêt, MicOff = écoute active */}
      {isListening ? (
        <MicOff className="size-3.5" />
      ) : (
        <Mic className="size-3.5" />
      )}
    </button>
  )
}
