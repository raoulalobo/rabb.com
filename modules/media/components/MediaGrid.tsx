/**
 * @file modules/media/components/MediaGrid.tsx
 * @module media
 * @description Grille de médias de la galerie avec infinite scroll et upload intégré.
 *
 *   Fonctionnalités :
 *   - Affiche les médias en grille responsive (2 cols mobile, 3 tablet, 4 desktop)
 *   - Infinite scroll via IntersectionObserver sur un sentinel en bas de grille
 *   - Bouton "Importer" → MediaUploader → upload via /api/gallery/upload-url → saveMedia()
 *   - Suppression via MediaCard → deleteMedia() Server Action
 *   - Mise à jour d'URL après édition Filerobot (via MediaCard → onMediaUpdated)
 *   - État vide : zone d'upload invitant à importer des fichiers
 *
 * @example
 *   <MediaGrid
 *     initialItems={firstPage.items}
 *     initialNextCursor={firstPage.nextCursor}
 *   />
 */

'use client'

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'

import { listMedia, saveMedia, deleteMedia } from '@/modules/media/actions/media.action'
import type { MediaItem } from '@/modules/media/types'
import { MediaCard } from './MediaCard'
import { MediaUploader } from './MediaUploader'
import type { UploadingFile } from '@/modules/posts/types'

// ─── Props ────────────────────────────────────────────────────────────────────

interface MediaGridProps {
  /** Première page de médias chargée côté serveur (SSR) */
  initialItems: MediaItem[]
  /** Curseur vers la page suivante, null si c'est la dernière page */
  initialNextCursor: string | null
}

// ─── Composant ────────────────────────────────────────────────────────────────

/**
 * Grille de médias avec infinite scroll, upload et suppression.
 */
export function MediaGrid({
  initialItems,
  initialNextCursor,
}: MediaGridProps): React.JSX.Element {
  const uploadIdPrefix = useId()

  /** Liste complète des médias (fusionnée au fil des pages) */
  const [items, setItems] = useState<MediaItem[]>(initialItems)
  /** Curseur vers la page suivante (null = plus de pages) */
  const [nextCursor, setNextCursor] = useState<string | null>(initialNextCursor)
  /** Chargement de la page suivante en cours */
  const [isLoadingMore, setIsLoadingMore] = useState(false)

  /** Fichiers en cours d'upload avec progression */
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([])

  /** Référence sur le sentinel (élément vide en bas de grille pour l'IntersectionObserver) */
  const sentinelRef = useRef<HTMLDivElement>(null)

  // ─── Infinite scroll (IntersectionObserver) ──────────────────────────────

  /**
   * Charge la page suivante quand le sentinel entre dans le viewport.
   * N'agit pas si un chargement est déjà en cours ou s'il n'y a plus de pages.
   */
  const loadNextPage = useCallback(async (): Promise<void> => {
    if (isLoadingMore || !nextCursor) return

    setIsLoadingMore(true)
    const { data, error } = await listMedia(nextCursor)

    if (error || !data) {
      console.error('[MediaGrid] Erreur chargement page suivante :', error)
      setIsLoadingMore(false)
      return
    }

    // Fusionner les nouveaux items en évitant les doublons (par id)
    setItems((prev) => {
      const existingIds = new Set(prev.map((i) => i.id))
      const newItems = data.items.filter((i) => !existingIds.has(i.id))
      return [...prev, ...newItems]
    })
    setNextCursor(data.nextCursor)
    setIsLoadingMore(false)
  }, [isLoadingMore, nextCursor])

  /** Observe le sentinel pour déclencher le chargement de la page suivante */
  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        // Déclenche loadNextPage quand le sentinel devient visible
        if (entry?.isIntersecting && nextCursor && !isLoadingMore) {
          void loadNextPage()
        }
      },
      { threshold: 0.1 },
    )

    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [loadNextPage, nextCursor, isLoadingMore])

  // ─── Upload ───────────────────────────────────────────────────────────────

  /**
   * Upload un fichier vers Supabase Storage via presigned URL, puis sauvegarde les
   * métadonnées en DB via saveMedia().
   *
   * @param file - Fichier sélectionné via MediaUploader
   */
  const handleUploadFile = useCallback(
    async (file: File): Promise<void> => {
      const uploadId = `${uploadIdPrefix}-${Date.now()}-${Math.random()}`

      setUploadingFiles((prev) => [
        ...prev,
        { id: uploadId, file, progress: 0 },
      ])

      try {
        // ── 1. Obtenir le presigned URL pour la galerie ──────────────────
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

        // ── 2. Upload direct vers Supabase avec progression ───────────────
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

        // ── 3. Sauvegarder les métadonnées en DB ──────────────────────────
        const { data: newMedia, error: saveError } = await saveMedia({
          url: publicUrl,
          filename: file.name,
          mimeType: file.type,
          size: file.size,
        })

        if (saveError || !newMedia) {
          throw new Error(saveError ?? 'Erreur lors de la sauvegarde')
        }

        // Ajouter le nouveau média en tête de liste (les plus récents d'abord)
        setItems((prev) => [newMedia, ...prev])
      } catch (err) {
        console.error('[MediaGrid] Erreur upload :', err)
        // Afficher l'erreur dans la barre de progression
        setUploadingFiles((prev) =>
          prev.map((f) => (f.id === uploadId ? { ...f, error: 'Upload échoué' } : f)),
        )
        setTimeout(
          () => setUploadingFiles((prev) => prev.filter((f) => f.id !== uploadId)),
          3000,
        )
        return
      }

      // Retirer le fichier de la liste des uploads en cours
      setUploadingFiles((prev) => prev.filter((f) => f.id !== uploadId))
    },
    [uploadIdPrefix],
  )

  /**
   * Déclenche l'upload de tous les fichiers sélectionnés par MediaUploader.
   *
   * @param files - Fichiers filtrés par MediaUploader (image/* + video/* uniquement)
   */
  const handleFilesSelected = useCallback(
    async (files: File[]): Promise<void> => {
      for (const file of files) {
        await handleUploadFile(file)
      }
    },
    [handleUploadFile],
  )

  // ─── Suppression ─────────────────────────────────────────────────────────

  /**
   * Supprime un média de la liste et de la DB.
   *
   * @param id - ID du média à supprimer
   */
  const handleDelete = useCallback(async (id: string): Promise<void> => {
    const { error } = await deleteMedia(id)
    if (error) {
      console.error('[MediaGrid] Erreur suppression :', error)
      return
    }
    // Retirer le média de la liste locale
    setItems((prev) => prev.filter((i) => i.id !== id))
  }, [])

  /**
   * Met à jour l'URL d'un média dans la liste locale après édition Filerobot.
   *
   * @param oldUrl - Ancienne URL du média
   * @param newUrl - Nouvelle URL du fichier édité re-uploadé
   */
  const handleMediaUpdated = useCallback(
    (oldUrl: string, newUrl: string): void => {
      setItems((prev) =>
        prev.map((i) => (i.url === oldUrl ? { ...i, url: newUrl } : i)),
      )
    },
    [],
  )

  // ─── Rendu ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* ── Zone d'upload ─────────────────────────────────────────────────── */}
      <MediaUploader
        onFilesSelected={(files) => void handleFilesSelected(files)}
        disabled={uploadingFiles.length > 0}
      />

      {/* ── Fichiers en cours d'upload ─────────────────────────────────────── */}
      {uploadingFiles.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Import en cours
          </h3>
          <div className="space-y-1.5">
            {uploadingFiles.map((f) => (
              <div
                key={f.id}
                className="flex items-center gap-3 rounded-lg border border-border bg-background px-3 py-2"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-foreground">{f.file.name}</p>
                  {f.error ? (
                    <p className="mt-0.5 text-xs text-destructive">{f.error}</p>
                  ) : (
                    <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary transition-all duration-300"
                        style={{ width: `${f.progress}%` }}
                      />
                    </div>
                  )}
                </div>
                {!f.error && (
                  <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Grille de médias ─────────────────────────────────────────────── */}
      {items.length > 0 ? (
        <div>
          <h3 className="mb-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">
            {items.length} média{items.length > 1 ? 's' : ''}
          </h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {items.map((item) => (
              <MediaCard
                key={item.id}
                item={item}
                onDelete={() => handleDelete(item.id)}
                onMediaUpdated={(newUrl) => handleMediaUpdated(item.url, newUrl)}
              />
            ))}
          </div>
        </div>
      ) : (
        // État vide (aucun média et aucun upload en cours)
        uploadingFiles.length === 0 && (
          <div className="rounded-lg border border-dashed border-border bg-muted/20 py-12 text-center">
            <p className="text-sm text-muted-foreground">
              Votre galerie est vide
            </p>
            <p className="mt-1 text-xs text-muted-foreground/60">
              Importez des images ou vidéos pour les réutiliser dans vos posts
            </p>
          </div>
        )
      )}

      {/* ── Sentinel pour l'infinite scroll ──────────────────────────────── */}
      <div ref={sentinelRef} className="h-1" aria-hidden="true" />

      {/* Indicateur de chargement de la page suivante */}
      {isLoadingMore && (
        <div className="flex justify-center py-4">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      )}
    </div>
  )
}
