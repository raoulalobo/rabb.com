/**
 * @file modules/media/components/MediaPicker.tsx
 * @module media
 * @description Dialog de sélection de médias depuis la galerie.
 *
 *   Utilisé dans AgentModalCreate et AgentModalEdit pour choisir des médias
 *   existants sans avoir à les ré-uploader.
 *
 *   Fonctionnalités :
 *   - Charge la galerie de l'utilisateur au montage via listMedia()
 *   - Affiche les médias en grille avec cases à cocher (sélection multiple)
 *   - Pré-coche les URLs déjà dans le pool (selectedUrls)
 *   - Permet d'uploader de nouveaux médias inline (MediaUploader)
 *   - Bouton "Confirmer (N)" → appelle onConfirm(selectedUrls)
 *   - État vide : invite à importer des fichiers
 *
 * @example
 *   <MediaPicker
 *     open={pickerOpen}
 *     onOpenChange={setPickerOpen}
 *     selectedUrls={mediaPool.map(m => m.url)}
 *     onConfirm={(urls) => {
 *       const newItems = urls.filter(url => !mediaPool.some(m => m.url === url))
 *       setMediaPool(prev => [...prev, ...newItems.map(urlToPoolMedia)])
 *     }}
 *   />
 */

'use client'

import { useCallback, useEffect, useId, useState } from 'react'
import { Check, Loader2, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { listMedia, saveMedia } from '@/modules/media/actions/media.action'
import type { MediaItem } from '@/modules/media/types'
import { isVideoUrl, formatFileSize } from '@/modules/posts/utils/media.utils'
import { MediaUploader } from './MediaUploader'
import type { UploadingFile } from '@/modules/posts/types'

// ─── Props ────────────────────────────────────────────────────────────────────

interface MediaPickerProps {
  /** Contrôle l'ouverture du dialog */
  open: boolean
  /** Callback pour ouvrir/fermer le dialog */
  onOpenChange: (open: boolean) => void
  /**
   * URLs déjà dans le pool (pour pré-cocher les médias déjà sélectionnés).
   * Ex: `mediaPool.map(m => m.url)`
   */
  selectedUrls: string[]
  /**
   * Callback appelé avec les URLs sélectionnées lors du clic "Confirmer".
   * Le parent gère la fusion avec le pool existant (sans doublons).
   */
  onConfirm: (urls: string[]) => void
}

// ─── Composant ────────────────────────────────────────────────────────────────

/**
 * Dialog de sélection de médias depuis la galerie de l'utilisateur.
 */
export function MediaPicker({
  open,
  onOpenChange,
  selectedUrls,
  onConfirm,
}: MediaPickerProps): React.JSX.Element | null {
  const uploadIdPrefix = useId()

  /** Médias chargés depuis la galerie */
  const [items, setItems] = useState<MediaItem[]>([])
  /** Chargement initial de la galerie */
  const [isLoading, setIsLoading] = useState(false)
  /** URLs sélectionnées (cases cochées) */
  const [selected, setSelected] = useState<Set<string>>(new Set(selectedUrls))
  /** Fichiers en cours d'upload dans le picker */
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([])

  // ── Chargement de la galerie au montage du dialog ────────────────────────

  useEffect(() => {
    if (!open) return

    // Pré-sélectionner les URLs déjà dans le pool
    setSelected(new Set(selectedUrls))

    // Charger la galerie
    setIsLoading(true)
    void listMedia().then(({ data, error }) => {
      if (error || !data) {
        console.error('[MediaPicker] Erreur chargement galerie :', error)
        setIsLoading(false)
        return
      }
      setItems(data.items)
      setIsLoading(false)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // ── Sélection / désélection ──────────────────────────────────────────────

  /**
   * Bascule la sélection d'un média (coché ↔ décoché).
   *
   * @param url - URL publique du média
   */
  const toggleSelect = useCallback((url: string): void => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(url)) {
        next.delete(url)
      } else {
        next.add(url)
      }
      return next
    })
  }, [])

  // ── Upload inline dans le picker ─────────────────────────────────────────

  /**
   * Upload un fichier depuis le picker vers la galerie.
   * Sauvegarde les métadonnées en DB et ajoute à la liste locale.
   *
   * @param file - Fichier image/vidéo sélectionné via MediaUploader
   */
  const handleUploadFile = useCallback(
    async (file: File): Promise<void> => {
      const uploadId = `${uploadIdPrefix}-${Date.now()}-${Math.random()}`

      setUploadingFiles((prev) => [
        ...prev,
        { id: uploadId, file, progress: 0 },
      ])

      try {
        // 1. Presigned URL galerie
        const urlRes = await fetch('/api/gallery/upload-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filename: file.name,
            mimeType: file.type,
            size: file.size,
          }),
        })

        if (!urlRes.ok) throw new Error("Impossible d'obtenir l'URL d'upload")

        const { signedUrl, publicUrl } = (await urlRes.json()) as {
          signedUrl: string
          publicUrl: string
        }

        // 2. Upload vers Supabase avec progression
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

          xhr.addEventListener('load', () =>
            xhr.status >= 200 && xhr.status < 300
              ? resolve()
              : reject(new Error(`Upload échoué : ${xhr.status}`)),
          )
          xhr.addEventListener('error', () =>
            reject(new Error("Erreur réseau lors de l'upload")),
          )

          xhr.open('PUT', signedUrl)
          xhr.setRequestHeader('Content-Type', file.type)
          xhr.send(file)
        })

        // 3. Sauvegarder en DB
        const { data: newMedia, error: saveError } = await saveMedia({
          url: publicUrl,
          filename: file.name,
          mimeType: file.type,
          size: file.size,
        })

        if (saveError || !newMedia) {
          throw new Error(saveError ?? 'Erreur lors de la sauvegarde')
        }

        // 4. Ajouter à la grille du picker + pré-sélectionner automatiquement
        setItems((prev) => [newMedia, ...prev])
        setSelected((prev) => new Set([...prev, publicUrl]))
      } catch (err) {
        console.error('[MediaPicker] Erreur upload :', err)
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
    },
    [uploadIdPrefix],
  )

  const handleFilesSelected = useCallback(
    async (files: File[]): Promise<void> => {
      for (const file of files) {
        await handleUploadFile(file)
      }
    },
    [handleUploadFile],
  )

  // ── Confirmation ─────────────────────────────────────────────────────────

  const handleConfirm = (): void => {
    onConfirm(Array.from(selected))
    onOpenChange(false)
  }

  // ── Rendu ────────────────────────────────────────────────────────────────

  if (!open) return null

  const selectedCount = selected.size

  return (
    // Overlay plein écran avec z-index élevé
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      {/* ── En-tête ───────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold">Galerie de médias</h2>
          {selectedCount > 0 && (
            <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">
              {selectedCount} sélectionné{selectedCount > 1 ? 's' : ''}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Bouton Fermer */}
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="Fermer la galerie"
            className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>

      {/* ── Zone de scroll ────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Zone d'upload inline */}
        <MediaUploader
          onFilesSelected={(files) => void handleFilesSelected(files)}
          disabled={uploadingFiles.length > 0}
          placeholder="Glissez des médias ici pour les importer dans la galerie"
        />

        {/* Fichiers en cours d'upload */}
        {uploadingFiles.length > 0 && (
          <div className="space-y-1.5">
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

        {/* ── Chargement initial ─────────────────────────────────────────── */}
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : items.length === 0 ? (
          // État vide
          <div className="rounded-lg border border-dashed border-border bg-muted/20 py-10 text-center">
            <p className="text-sm text-muted-foreground">
              Galerie vide — importez des fichiers ci-dessus
            </p>
          </div>
        ) : (
          // ── Grille de sélection ─────────────────────────────────────────
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {items.map((item) => {
              const isChecked = selected.has(item.url)
              const isVideo = isVideoUrl(item.url) || item.mimeType.startsWith('video/')

              return (
                // Carte cliquable avec case à cocher
                <button
                  key={item.id}
                  type="button"
                  onClick={() => toggleSelect(item.url)}
                  className={[
                    'group relative aspect-[4/3] overflow-hidden rounded-lg border-2 transition-all',
                    isChecked
                      ? 'border-primary ring-2 ring-primary/30'
                      : 'border-transparent hover:border-border',
                  ].join(' ')}
                >
                  {/* Contenu */}
                  {isVideo ? (
                    <div className="flex size-full flex-col items-center justify-center bg-muted">
                      <span className="rounded-md bg-muted-foreground/20 px-2 py-0.5 text-xs font-medium text-muted-foreground">
                        Vidéo
                      </span>
                    </div>
                  ) : (
                    <img
                      src={item.url}
                      alt={item.filename}
                      className="size-full object-cover"
                      loading="lazy"
                    />
                  )}

                  {/* Overlay métadonnées (bas de la carte) */}
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-1.5 pb-1 pt-4">
                    <p className="truncate text-[10px] text-white">{item.filename}</p>
                    <p className="text-[10px] text-white/60">{formatFileSize(item.size)}</p>
                  </div>

                  {/* Case à cocher (coin haut-droit) */}
                  <div
                    className={[
                      'absolute right-1.5 top-1.5 flex size-5 items-center justify-center rounded-full border-2 transition-all',
                      isChecked
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-white/70 bg-black/40 text-transparent',
                    ].join(' ')}
                  >
                    <Check className="size-3" strokeWidth={3} />
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Pied de page avec bouton Confirmer ───────────────────────────── */}
      <div className="border-t bg-background px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="text-sm text-muted-foreground underline-offset-4 hover:underline"
          >
            Annuler
          </button>

          <Button
            onClick={handleConfirm}
            disabled={selectedCount === 0}
            className="gap-2"
          >
            <Check className="size-4" />
            Confirmer ({selectedCount})
          </Button>
        </div>
      </div>
    </div>
  )
}
