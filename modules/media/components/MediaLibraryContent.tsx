/**
 * @file modules/media/components/MediaLibraryContent.tsx
 * @module media
 * @description Orchestrateur principal de la Media Library (Client Component).
 *
 *   Remplace MediaGrid comme composant racine de la page /gallery.
 *   Gère l'état complet de la bibliothèque :
 *   - Chargement initial des dossiers, tags et médias
 *   - Filtres actifs (type, tag, dossier, tri)
 *   - Mode de vue (grid | list)
 *   - Mode sélection multiple avec actions bulk
 *   - Upload de nouveaux fichiers
 *
 *   Composition :
 *   - MediaFolderTabs (navigation dossiers)
 *   - MediaUploader (zone drag-and-drop)
 *   - MediaFiltersBar (filtres + vue + tri)
 *   - MediaListView (vue tableau)
 *   - MediaGrid-like grille (vue grille via MediaCard)
 *
 *   L'infinite scroll est géré via IntersectionObserver sur un sentinel en bas de liste.
 *   Quand un filtre change, la liste est rechargée depuis le début (reset du cursor).
 *
 * @example
 *   // Utilisé dans app/(dashboard)/gallery/page.tsx
 *   <MediaLibraryContent initialItems={items} initialNextCursor={cursor} />
 */

'use client'

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { Loader2, Trash2, FolderInput } from 'lucide-react'

import {
  listMedia,
  saveMedia,
  deleteMedia,
  listFolders,
  listTags,
} from '@/modules/media/actions/media.action'
import type {
  MediaItem,
  MediaFolder,
  MediaTag,
  MediaSortBy,
  MediaTypeFilter,
  MediaViewMode,
} from '@/modules/media/types'

import { Button } from '@/components/ui/button'
import { MediaCard } from './MediaCard'
import { MediaUploader } from './MediaUploader'
import { MediaFolderTabs } from './MediaFolderTabs'
import { MediaFiltersBar } from './MediaFiltersBar'
import { MediaListView } from './MediaListView'
import type { UploadingFile } from '@/modules/posts/types'

// ─── Props ────────────────────────────────────────────────────────────────────

interface MediaLibraryContentProps {
  /** Première page de médias chargée côté serveur (SSR) */
  initialItems: MediaItem[]
  /** Curseur vers la page suivante, null si c'est la dernière page */
  initialNextCursor: string | null
}

// ─── Composant ────────────────────────────────────────────────────────────────

/**
 * Orchestrateur complet de la Media Library.
 * Gère tous les états de la bibliothèque (filtres, dossiers, tags, vue, sélection).
 */
export function MediaLibraryContent({
  initialItems,
  initialNextCursor,
}: MediaLibraryContentProps): React.JSX.Element {
  const uploadIdPrefix = useId()

  // ─── États de la liste ────────────────────────────────────────────────────

  /** Liste complète des médias affichés */
  const [items, setItems] = useState<MediaItem[]>(initialItems)
  /** Curseur vers la page suivante (null = plus de pages) */
  const [nextCursor, setNextCursor] = useState<string | null>(initialNextCursor)
  /** Chargement de la page suivante en cours */
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  /** Rechargement suite à un changement de filtre */
  const [isReloading, setIsReloading] = useState(false)

  // ─── États dossiers et tags ───────────────────────────────────────────────

  /** Liste des dossiers de l'utilisateur */
  const [folders, setFolders] = useState<MediaFolder[]>([])
  /** Liste des tags de l'utilisateur */
  const [tags, setTags] = useState<MediaTag[]>([])

  // ─── États des filtres ─────────────────────────────────────────────────────

  /** Dossier sélectionné (undefined = tous) */
  const [selectedFolderId, setSelectedFolderId] = useState<string | undefined>(undefined)
  /** Filtre type : all | image | video */
  const [typeFilter, setTypeFilter] = useState<MediaTypeFilter>('all')
  /** Tag filtré (undefined = aucun) */
  const [selectedTagId, setSelectedTagId] = useState<string | undefined>(undefined)
  /** Critère de tri */
  const [sortBy, setSortBy] = useState<MediaSortBy>('newest')

  // ─── États de la vue ──────────────────────────────────────────────────────

  /** Mode de vue : grid | list */
  const [viewMode, setViewMode] = useState<MediaViewMode>('grid')

  // ─── États de sélection multiple ─────────────────────────────────────────

  /** Mode sélection multiple actif */
  const [isSelectMode, setIsSelectMode] = useState(false)
  /** IDs des médias sélectionnés */
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // ─── État upload ──────────────────────────────────────────────────────────

  /** Fichiers en cours d'upload avec progression */
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([])

  /** Référence sur le sentinel pour l'IntersectionObserver (infinite scroll) */
  const sentinelRef = useRef<HTMLDivElement>(null)

  // ─── Chargement initial dossiers + tags ───────────────────────────────────

  useEffect(() => {
    // Charger dossiers et tags en parallèle au montage
    void Promise.all([
      listFolders().then(({ data }) => {
        if (data) setFolders(data)
      }),
      listTags().then(({ data }) => {
        if (data) setTags(data)
      }),
    ])
  }, [])

  // ─── Rechargement sur changement de filtres ───────────────────────────────

  /**
   * Recharge la liste depuis le début quand un filtre change.
   * Réinitialise le cursor et les items actuels.
   */
  const reloadWithFilters = useCallback(async (params: {
    folderId?: string
    type: MediaTypeFilter
    tagId?: string
    sort: MediaSortBy
  }): Promise<void> => {
    setIsReloading(true)
    setItems([])
    setNextCursor(null)

    const { data, error } = await listMedia({
      folderId: params.folderId,
      type: params.type,
      tagId: params.tagId,
      sortBy: params.sort,
    })

    setIsReloading(false)

    if (error || !data) {
      console.error('[MediaLibraryContent] Erreur rechargement :', error)
      return
    }

    setItems(data.items)
    setNextCursor(data.nextCursor)
  }, [])

  // Déclencher le rechargement à chaque changement de filtre
  useEffect(() => {
    void reloadWithFilters({
      folderId: selectedFolderId,
      type: typeFilter,
      tagId: selectedTagId,
      sort: sortBy,
    })
    // Réinitialiser la sélection au changement de filtre
    setSelectedIds(new Set())
    setIsSelectMode(false)
  }, [selectedFolderId, typeFilter, selectedTagId, sortBy, reloadWithFilters])

  // ─── Infinite scroll (IntersectionObserver) ──────────────────────────────

  /**
   * Charge la page suivante quand le sentinel entre dans le viewport.
   */
  const loadNextPage = useCallback(async (): Promise<void> => {
    if (isLoadingMore || !nextCursor) return

    setIsLoadingMore(true)
    const { data, error } = await listMedia({
      cursor: nextCursor,
      folderId: selectedFolderId,
      type: typeFilter,
      tagId: selectedTagId,
      sortBy,
    })

    if (error || !data) {
      console.error('[MediaLibraryContent] Erreur page suivante :', error)
      setIsLoadingMore(false)
      return
    }

    // Fusionner en évitant les doublons
    setItems((prev) => {
      const existingIds = new Set(prev.map((i) => i.id))
      return [...prev, ...data.items.filter((i) => !existingIds.has(i.id))]
    })
    setNextCursor(data.nextCursor)
    setIsLoadingMore(false)
  }, [isLoadingMore, nextCursor, selectedFolderId, typeFilter, selectedTagId, sortBy])

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return

    const observer = new IntersectionObserver(
      ([entry]) => {
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
   * Upload un fichier vers Supabase Storage via presigned URL, puis sauvegarde
   * les métadonnées en DB via saveMedia().
   *
   * @param file - Fichier sélectionné via MediaUploader
   */
  const handleUploadFile = useCallback(
    async (file: File): Promise<void> => {
      const uploadId = `${uploadIdPrefix}-${Date.now()}-${Math.random()}`

      setUploadingFiles((prev) => [...prev, { id: uploadId, file, progress: 0 }])

      try {
        // ── 1. Obtenir le presigned URL ────────────────────────────────────
        const urlRes = await fetch('/api/gallery/upload-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename: file.name, mimeType: file.type, size: file.size }),
        })

        if (!urlRes.ok) throw new Error("Impossible d'obtenir l'URL d'upload")

        const { signedUrl, publicUrl } = (await urlRes.json()) as {
          signedUrl: string
          publicUrl: string
        }

        // ── 2. Upload direct vers Supabase avec progression ────────────────
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
          xhr.addEventListener('error', () => reject(new Error("Erreur réseau lors de l'upload")))

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

        if (saveError || !newMedia) throw new Error(saveError ?? 'Erreur sauvegarde')

        // Ajouter en tête de liste (filtres actifs peuvent l'exclure, mais on l'affiche quand même)
        setItems((prev) => [newMedia, ...prev])
      } catch (err) {
        console.error('[MediaLibraryContent] Erreur upload :', err)
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

  // ─── Suppression ──────────────────────────────────────────────────────────

  /**
   * Supprime un média de la liste et de la DB.
   *
   * @param id - ID du média à supprimer
   */
  const handleDelete = useCallback(async (id: string): Promise<void> => {
    const { error } = await deleteMedia(id)
    if (error) {
      console.error('[MediaLibraryContent] Erreur suppression :', error)
      return
    }
    setItems((prev) => prev.filter((i) => i.id !== id))
    // Retirer de la sélection si présent
    setSelectedIds((prev) => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
  }, [])

  /**
   * Supprime tous les médias sélectionnés (mode bulk).
   */
  const handleBulkDelete = useCallback(async (): Promise<void> => {
    for (const id of selectedIds) {
      await handleDelete(id)
    }
    setIsSelectMode(false)
    setSelectedIds(new Set())
  }, [selectedIds, handleDelete])

  // ─── Mise à jour URL après édition ────────────────────────────────────────

  /**
   * Met à jour l'URL d'un média dans la liste locale après édition Filerobot.
   *
   * @param id     - ID du média mis à jour
   * @param newUrl - Nouvelle URL publique après re-upload
   */
  const handleMediaUpdated = useCallback((id: string, newUrl: string): void => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, url: newUrl } : i)))
  }, [])

  // ─── Toggle sélection ────────────────────────────────────────────────────

  /**
   * Bascule la sélection d'un média (ajoute/retire de selectedIds).
   *
   * @param id - ID du média à basculer
   */
  const handleToggleSelect = useCallback((id: string): void => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }, [])

  // ─── Rendu ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* ── Tabs dossiers ─────────────────────────────────────────────────── */}
      <MediaFolderTabs
        folders={folders}
        selectedFolderId={selectedFolderId}
        onSelect={setSelectedFolderId}
        onFolderCreated={(folder) => setFolders((prev) => [...prev, folder])}
      />

      {/* ── Zone d'upload ─────────────────────────────────────────────────── */}
      <MediaUploader
        onFilesSelected={(files) => void handleFilesSelected(files)}
        disabled={uploadingFiles.length > 0}
      />

      {/* ── Fichiers en cours d'upload ─────────────────────────────────────── */}
      {uploadingFiles.length > 0 && (
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
              {!f.error && <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />}
            </div>
          ))}
        </div>
      )}

      {/* ── Barre de filtres ─────────────────────────────────────────────── */}
      <MediaFiltersBar
        total={items.length}
        typeFilter={typeFilter}
        onTypeFilter={(type) => setTypeFilter(type)}
        tags={tags}
        selectedTagId={selectedTagId}
        onTagSelect={(tagId) => setSelectedTagId(tagId)}
        sortBy={sortBy}
        onSortBy={(sort) => setSortBy(sort)}
        viewMode={viewMode}
        onViewMode={setViewMode}
        isSelectMode={isSelectMode}
        onToggleSelectMode={() => {
          setIsSelectMode((prev) => !prev)
          setSelectedIds(new Set())
        }}
      />

      {/* ── Barre d'actions bulk (mode sélection) ────────────────────────── */}
      {isSelectMode && selectedIds.size > 0 && (
        <div className="sticky bottom-4 z-10 flex items-center gap-3 rounded-lg border border-border bg-muted/50 px-4 py-2.5 shadow-lg">
          <span className="text-sm font-medium">
            {selectedIds.size} sélectionné{selectedIds.size > 1 ? 's' : ''}
          </span>
          <div className="flex-1" />
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={() => void handleBulkDelete()}
            className="gap-1.5"
          >
            <Trash2 className="size-3.5" />
            Supprimer la sélection
          </Button>
        </div>
      )}

      {/* ── Contenu principal (liste ou grille) ───────────────────────────── */}
      {isReloading ? (
        // Skeleton de rechargement (6 lignes ou 8 cartes selon la vue)
        <div className="flex min-h-[200px] items-center justify-center">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : items.length === 0 && uploadingFiles.length === 0 ? (
        // État vide
        <div className="flex min-h-[200px] items-center justify-center rounded-lg border border-dashed border-border bg-muted/20">
          <div className="text-center">
            <FolderInput className="mx-auto mb-2 size-8 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">Aucun média trouvé</p>
            <p className="mt-1 text-xs text-muted-foreground/60">
              Importez des fichiers ou modifiez les filtres
            </p>
          </div>
        </div>
      ) : viewMode === 'list' ? (
        // Vue liste (tableau)
        <MediaListView
          items={items}
          isSelectMode={isSelectMode}
          selectedIds={selectedIds}
          onToggleSelect={handleToggleSelect}
          onDelete={handleDelete}
          onMediaUpdated={handleMediaUpdated}
        />
      ) : (
        // Vue grille (MediaCard)
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((item) => (
            <MediaCard
              key={item.id}
              item={item}
              isSelectMode={isSelectMode}
              isSelected={selectedIds.has(item.id)}
              onToggleSelect={() => handleToggleSelect(item.id)}
              onDelete={() => handleDelete(item.id)}
              onMediaUpdated={(newUrl) => handleMediaUpdated(item.id, newUrl)}
            />
          ))}
        </div>
      )}

      {/* ── Sentinel pour l'infinite scroll ──────────────────────────────── */}
      <div ref={sentinelRef} className="h-1" aria-hidden="true" />

      {/* Indicateur de chargement page suivante */}
      {isLoadingMore && (
        <div className="flex justify-center py-4">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      )}
    </div>
  )
}
