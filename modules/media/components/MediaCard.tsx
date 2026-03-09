/**
 * @file modules/media/components/MediaCard.tsx
 * @module media
 * @description Carte d'un média dans la galerie (image ou vidéo).
 *
 *   Affiche :
 *   - Image : miniature en ratio 4:3 avec `object-cover`
 *   - Vidéo : fond gris + badge "Vidéo"
 *   - Overlay au survol : nom de fichier, taille, bouton ✏️ (images uniquement), bouton 🗑️
 *
 *   En mode sélection (isSelectMode=true) :
 *   - Affiche une checkbox en haut à gauche
 *   - Un clic sur la carte bascule la sélection (onToggleSelect)
 *
 *   Le bouton 🗑️ demande une confirmation inline avant de déclencher onDelete().
 *   Le bouton ✏️ ouvre l'ImageEditorDialog (images seulement, masqué pour les vidéos).
 *
 * @example
 *   <MediaCard
 *     item={mediaItem}
 *     isSelectMode={false}
 *     isSelected={false}
 *     onToggleSelect={() => toggleSelection(mediaItem.id)}
 *     onDelete={async () => { await deleteMedia(mediaItem.id) }}
 *     onMediaUpdated={(newUrl) => updateUrl(mediaItem.id, newUrl)}
 *   />
 */

'use client'

import { Pencil, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'

import { Checkbox } from '@/components/ui/checkbox'
import { isVideoUrl, formatFileSize } from '@/modules/posts/utils/media.utils'
import type { MediaItem } from '@/modules/media/types'
import { ImageEditorDialog } from './ImageEditorDialog'
import { saveMedia } from '@/modules/media/actions/media.action'

// ─── Props ────────────────────────────────────────────────────────────────────

interface MediaCardProps {
  /** Données du média à afficher */
  item: MediaItem
  /**
   * Mode sélection multiple actif.
   * Quand true, affiche une checkbox en haut à gauche et désactive les autres actions.
   */
  isSelectMode?: boolean
  /** Indique si ce média est sélectionné (uniquement pertinent si isSelectMode=true) */
  isSelected?: boolean
  /**
   * Callback de bascule de sélection.
   * Appelé lors d'un clic en mode sélection.
   */
  onToggleSelect?: () => void
  /**
   * Callback appelé après confirmation de suppression.
   * La suppression physique (Storage + DB) est gérée par le parent (MediaLibraryContent).
   */
  onDelete: () => Promise<void>
  /**
   * Callback appelé après édition et re-upload de l'image.
   * Le parent met à jour la liste avec la nouvelle URL.
   */
  onMediaUpdated: (newUrl: string) => void
}

// ─── Composant ────────────────────────────────────────────────────────────────

/**
 * Carte d'un média dans la galerie avec overlay actions au survol.
 * Supporte le mode sélection multiple via checkbox.
 */
export function MediaCard({
  item,
  isSelectMode = false,
  isSelected = false,
  onToggleSelect,
  onDelete,
  onMediaUpdated,
}: MediaCardProps): React.JSX.Element {
  /** Indique si l'overlay de suppression (confirmation) est visible */
  const [confirmDelete, setConfirmDelete] = useState(false)
  /** Indique si la suppression est en cours */
  const [isDeleting, setIsDeleting] = useState(false)
  /** Contrôle l'ouverture de l'éditeur d'image Filerobot */
  const [editorOpen, setEditorOpen] = useState(false)

  // Détecte le type depuis l'URL (extension) car mimeType stocké en DB peut être "video/*"
  const isVideo = isVideoUrl(item.url) || item.mimeType.startsWith('video/')

  /**
   * Déclenche la suppression après confirmation.
   * Désactive le bouton pendant l'opération.
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
   * Callback après édition de l'image dans Filerobot.
   * Met à jour l'entrée DB avec la nouvelle URL et notifie le parent.
   *
   * @param newUrl - URL publique Supabase du fichier édité re-uploadé
   */
  const handleEditorSave = async (newUrl: string): Promise<void> => {
    // Mettre à jour les métadonnées en DB (nouvelle URL, même filename/mimeType/size)
    await saveMedia({
      url: newUrl,
      filename: item.filename,
      mimeType: item.mimeType,
      size: item.size,
    })
    onMediaUpdated(newUrl)
    setEditorOpen(false)
  }

  /**
   * Gère le clic sur la carte.
   * En mode sélection : bascule la sélection.
   * Sinon : pas d'action au clic sur la carte elle-même.
   */
  const handleCardClick = (): void => {
    if (isSelectMode && onToggleSelect) {
      onToggleSelect()
    }
  }

  return (
    <>
      {/* ── Carte ──────────────────────────────────────────────────────────── */}
      <div
        role={isSelectMode ? 'button' : undefined}
        tabIndex={isSelectMode ? 0 : undefined}
        onClick={handleCardClick}
        onKeyDown={isSelectMode ? (e) => e.key === 'Enter' && handleCardClick() : undefined}
        className={cn(
          'group relative aspect-[4/3] overflow-hidden rounded-lg border bg-muted',
          isSelectMode ? 'cursor-pointer' : '',
          isSelected
            ? 'border-primary ring-2 ring-primary'
            : 'border-border',
        )}
      >
        {/* ── Contenu principal (image ou placeholder vidéo) ─────────────── */}
        {isVideo ? (
          // Vidéo : fond avec badge centré
          <div className="flex size-full flex-col items-center justify-center gap-1.5 bg-muted">
            <div className="rounded-md bg-muted-foreground/20 px-2 py-0.5">
              <span className="text-xs font-medium text-muted-foreground">Vidéo</span>
            </div>
          </div>
        ) : (
          // Image : miniature pleine taille
          <img
            src={item.url}
            alt={item.filename}
            className="size-full object-cover transition-transform duration-200 group-hover:scale-105"
            loading="lazy"
          />
        )}

        {/* ── Checkbox (mode sélection) ──────────────────────────────────── */}
        {isSelectMode && (
          <div className="absolute left-2 top-2 z-10">
            <Checkbox
              checked={isSelected}
              onCheckedChange={() => onToggleSelect?.()}
              // Stoppe la propagation pour éviter le double-clic (checkbox + carte)
              onClick={(e) => e.stopPropagation()}
              className="size-4 border-white bg-white/80 shadow"
              aria-label={`Sélectionner ${item.filename}`}
            />
          </div>
        )}

        {/* ── Overlay au survol (masqué en mode sélection) ──────────────── */}
        {!isSelectMode && (
          <div className="absolute inset-0 flex flex-col justify-between bg-black/0 p-1.5 opacity-0 transition-all duration-150 group-hover:bg-black/40 group-hover:opacity-100">

            {/* Boutons d'action (haut de la carte) */}
            <div className="flex items-start justify-between gap-1">
              {/* ✏️ Bouton édition — images uniquement */}
              {!isVideo && !confirmDelete && (
                <button
                  type="button"
                  onClick={() => setEditorOpen(true)}
                  aria-label={`Éditer ${item.filename}`}
                  className="flex size-6 items-center justify-center rounded-full bg-black/60 text-white transition-colors hover:bg-black/80"
                >
                  <Pencil className="size-3" />
                </button>
              )}
              {/* Spacer si pas de bouton édition (vidéo) */}
              {isVideo && <span />}

              {/* 🗑️ Bouton suppression (confirmation inline) */}
              {confirmDelete ? (
                // Confirmation : deux boutons Oui/Non
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={isDeleting}
                    aria-label="Confirmer la suppression"
                    className="rounded bg-destructive px-1.5 py-0.5 text-[10px] font-medium text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
                  >
                    {isDeleting ? '…' : 'Oui'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    aria-label="Annuler la suppression"
                    className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-foreground hover:bg-muted/80"
                  >
                    Non
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  aria-label={`Supprimer ${item.filename}`}
                  className="flex size-6 items-center justify-center rounded-full bg-black/60 text-white transition-colors hover:bg-destructive/90"
                >
                  <Trash2 className="size-3" />
                </button>
              )}
            </div>

            {/* Métadonnées (bas de la carte) */}
            {!confirmDelete && (
              <div className="space-y-0.5">
                <p className="truncate text-[10px] font-medium text-white drop-shadow">
                  {item.filename}
                </p>
                <p className="text-[10px] text-white/70">
                  {formatFileSize(item.size)}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

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
