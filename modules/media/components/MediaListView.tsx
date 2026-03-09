/**
 * @file modules/media/components/MediaListView.tsx
 * @module media
 * @description Vue "Liste" de la Media Library — tableau avec colonnes.
 *
 *   Colonnes affichées :
 *   - [Checkbox]  : visible uniquement en mode sélection (isSelectMode)
 *   - Name        : miniature 32×32 + nom du fichier (lien externe)
 *   - Dossier     : icône + nom, ou "—" si aucun dossier
 *   - Tags        : badges colorés
 *   - Type        : "Image" ou "Vidéo"
 *   - Taille      : formatFileSize()
 *   - Date        : DD/MM/YYYY
 *   - ↗           : lien externe vers l'URL publique
 *
 *   Actions par ligne :
 *   - Clic sur le nom ou ↗ : ouvre l'URL dans un nouvel onglet
 *   - Bouton ✏️ : ouvre ImageEditorDialog (images seulement)
 *   - Bouton 🗑️ : supprime le média (avec confirmation inline)
 *
 *   Utilisé dans : MediaLibraryContent (quand viewMode === 'list')
 *
 * @example
 *   <MediaListView
 *     items={items}
 *     isSelectMode={false}
 *     selectedIds={new Set()}
 *     onToggleSelect={(id) => { ... }}
 *     onDelete={async (id) => { await deleteMedia(id) }}
 *     onMediaUpdated={(id, newUrl) => { ... }}
 *   />
 */

'use client'

import { useState } from 'react'
import { Pencil, Trash2, ExternalLink, FolderOpen, Video, Image as ImageIcon } from 'lucide-react'

import { Checkbox } from '@/components/ui/checkbox'
import { isVideoUrl, formatFileSize } from '@/modules/posts/utils/media.utils'
import { ImageEditorDialog } from './ImageEditorDialog'
import { saveMedia } from '@/modules/media/actions/media.action'
import type { MediaItem } from '@/modules/media/types'

// ─── Props ────────────────────────────────────────────────────────────────────

interface MediaListViewProps {
  /** Liste des médias à afficher en tableau */
  items: MediaItem[]
  /** Mode sélection multiple actif */
  isSelectMode: boolean
  /** IDs des médias sélectionnés */
  selectedIds: Set<string>
  /**
   * Callback toggle de sélection d'un item.
   * @param id - ID du média à basculer
   */
  onToggleSelect: (id: string) => void
  /**
   * Callback de suppression d'un média.
   * Gère la suppression Storage + DB (via deleteMedia action).
   *
   * @param id - ID du média à supprimer
   */
  onDelete: (id: string) => Promise<void>
  /**
   * Callback après édition d'une image.
   * Met à jour l'URL dans la liste parent.
   *
   * @param id     - ID du média mis à jour
   * @param newUrl - Nouvelle URL publique après re-upload
   */
  onMediaUpdated: (id: string, newUrl: string) => void
}

// ─── Composant ────────────────────────────────────────────────────────────────

/**
 * Vue liste (tableau) des médias de la galerie.
 */
export function MediaListView({
  items,
  isSelectMode,
  selectedIds,
  onToggleSelect,
  onDelete,
  onMediaUpdated,
}: MediaListViewProps): React.JSX.Element {
  if (items.length === 0) {
    return (
      <div className="flex min-h-[200px] items-center justify-center rounded-lg border border-dashed border-border">
        <p className="text-sm text-muted-foreground">
          Aucun média ne correspond aux filtres sélectionnés.
        </p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/50">
            {/* Colonne checkbox en mode sélection */}
            {isSelectMode && (
              <th className="w-10 px-3 py-2.5 text-left" />
            )}
            <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">Nom</th>
            <th className="hidden px-3 py-2.5 text-left font-medium text-muted-foreground md:table-cell">
              Dossier
            </th>
            <th className="hidden px-3 py-2.5 text-left font-medium text-muted-foreground lg:table-cell">
              Tags
            </th>
            <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">Type</th>
            <th className="hidden px-3 py-2.5 text-left font-medium text-muted-foreground sm:table-cell">
              Taille
            </th>
            <th className="hidden px-3 py-2.5 text-left font-medium text-muted-foreground md:table-cell">
              Date
            </th>
            {/* Colonne actions */}
            <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">Actions</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <MediaListRow
              key={item.id}
              item={item}
              isSelectMode={isSelectMode}
              isSelected={selectedIds.has(item.id)}
              onToggleSelect={() => onToggleSelect(item.id)}
              onDelete={() => onDelete(item.id)}
              onMediaUpdated={(newUrl) => onMediaUpdated(item.id, newUrl)}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Sous-composant MediaListRow ──────────────────────────────────────────────

interface MediaListRowProps {
  item: MediaItem
  isSelectMode: boolean
  isSelected: boolean
  onToggleSelect: () => void
  onDelete: () => Promise<void>
  onMediaUpdated: (newUrl: string) => void
}

/**
 * Ligne d'un média dans la vue liste.
 * Gère l'état local de confirmation de suppression et d'édition.
 */
function MediaListRow({
  item,
  isSelectMode,
  isSelected,
  onToggleSelect,
  onDelete,
  onMediaUpdated,
}: MediaListRowProps): React.JSX.Element {
  /** État de confirmation de suppression inline */
  const [confirmDelete, setConfirmDelete] = useState(false)
  /** Suppression en cours */
  const [isDeleting, setIsDeleting] = useState(false)
  /** Éditeur d'image ouvert */
  const [editorOpen, setEditorOpen] = useState(false)

  // Détecter si c'est une vidéo (URL + mimeType)
  const isVideo = isVideoUrl(item.url) || item.mimeType.startsWith('video/')

  /**
   * Formate une date en DD/MM/YYYY.
   *
   * @param date - Date à formater
   * @returns Chaîne "JJ/MM/AAAA"
   */
  const formatDate = (date: Date): string => {
    const d = new Date(date)
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }

  /**
   * Déclenche la suppression après confirmation.
   */
  const handleDelete = async (): Promise<void> => {
    setIsDeleting(true)
    try {
      await onDelete()
    } finally {
      setIsDeleting(false)
      setConfirmDelete(false)
    }
  }

  /**
   * Callback après édition — met à jour l'URL en DB et notifie le parent.
   *
   * @param newUrl - Nouvelle URL publique après re-upload
   */
  const handleEditorSave = async (newUrl: string): Promise<void> => {
    await saveMedia({
      url: newUrl,
      filename: item.filename,
      mimeType: item.mimeType,
      size: item.size,
    })
    onMediaUpdated(newUrl)
    setEditorOpen(false)
  }

  return (
    <>
      <tr className="group border-b border-border/60 transition-colors last:border-0 hover:bg-muted/30">
        {/* ── Checkbox ──────────────────────────────────────────────────── */}
        {isSelectMode && (
          <td className="px-3 py-2.5">
            <Checkbox
              checked={isSelected}
              onCheckedChange={onToggleSelect}
              aria-label={`Sélectionner ${item.filename}`}
            />
          </td>
        )}

        {/* ── Nom (miniature + filename) ────────────────────────────────── */}
        <td className="px-3 py-2.5">
          <div className="flex items-center gap-2.5">
            {/* Miniature 32×32 */}
            <div className="size-8 shrink-0 overflow-hidden rounded border border-border bg-muted">
              {isVideo ? (
                <div className="flex size-full items-center justify-center">
                  <Video className="size-3.5 text-muted-foreground" />
                </div>
              ) : (
                <img
                  src={item.url}
                  alt={item.filename}
                  className="size-full object-cover"
                  loading="lazy"
                />
              )}
            </div>
            {/* Nom fichier (tronqué) */}
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="max-w-[180px] truncate text-sm font-medium hover:underline md:max-w-[240px]"
              title={item.filename}
            >
              {item.filename}
            </a>
          </div>
        </td>

        {/* ── Dossier ───────────────────────────────────────────────────── */}
        <td className="hidden px-3 py-2.5 text-muted-foreground md:table-cell">
          {item.folder ? (
            <div className="flex items-center gap-1.5 text-xs">
              <FolderOpen className="size-3.5 text-muted-foreground" />
              <span>{item.folder.name}</span>
            </div>
          ) : (
            <span className="text-xs">—</span>
          )}
        </td>

        {/* ── Tags ──────────────────────────────────────────────────────── */}
        <td className="hidden px-3 py-2.5 lg:table-cell">
          {item.tags.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {item.tags.map((tag) => (
                <span
                  key={tag.id}
                  className="rounded-full border px-1.5 py-0 text-[10px] font-medium"
                  style={{ borderColor: tag.color, color: tag.color }}
                >
                  {tag.name}
                </span>
              ))}
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          )}
        </td>

        {/* ── Type ──────────────────────────────────────────────────────── */}
        <td className="px-3 py-2.5">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            {isVideo ? (
              <><Video className="size-3" /> Vidéo</>
            ) : (
              <><ImageIcon className="size-3" /> Image</>
            )}
          </div>
        </td>

        {/* ── Taille ───────────────────────────────────────────────────── */}
        <td className="hidden px-3 py-2.5 text-xs text-muted-foreground sm:table-cell">
          {formatFileSize(item.size)}
        </td>

        {/* ── Date ──────────────────────────────────────────────────────── */}
        <td className="hidden px-3 py-2.5 text-xs text-muted-foreground md:table-cell">
          {formatDate(item.createdAt)}
        </td>

        {/* ── Actions ───────────────────────────────────────────────────── */}
        <td className="px-3 py-2.5 text-right">
          <div className="flex items-center justify-end gap-1">
            {confirmDelete ? (
              // Confirmation suppression inline
              <>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="rounded bg-destructive px-1.5 py-0.5 text-[10px] font-medium text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
                >
                  {isDeleting ? '…' : 'Confirmer'}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-foreground hover:bg-muted/80"
                >
                  Annuler
                </button>
              </>
            ) : (
              <>
                {/* Lien externe */}
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Ouvrir dans un nouvel onglet"
                  className="rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
                >
                  <ExternalLink className="size-3.5" />
                </a>
                {/* Édition (images seulement) */}
                {!isVideo && (
                  <button
                    type="button"
                    onClick={() => setEditorOpen(true)}
                    aria-label={`Éditer ${item.filename}`}
                    className="rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
                  >
                    <Pencil className="size-3.5" />
                  </button>
                )}
                {/* Suppression */}
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  aria-label={`Supprimer ${item.filename}`}
                  className="rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </>
            )}
          </div>
        </td>
      </tr>

      {/* ── Éditeur d'image Filerobot ─────────────────────────────────────── */}
      {!isVideo && (
        <ImageEditorDialog
          sourceUrl={item.url}
          open={editorOpen}
          onOpenChange={setEditorOpen}
          onSave={handleEditorSave}
        />
      )}
    </>
  )
}
