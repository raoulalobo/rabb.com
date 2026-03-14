/**
 * @file modules/biolink/components/BioPageEditor/LinkItem.tsx
 * @module biolink
 * @description Carte d'un lien individuel dans la liste de l'éditeur Bio Link.
 *   Intègre dnd-kit (useSortable) pour le drag & drop de réordonnement.
 *   Affiche le titre, l'URL, l'icône, le nombre de clics et les actions (éditer, supprimer, toggle).
 *
 * @example
 *   <LinkItem
 *     link={link}
 *     onEdit={() => openLinkDialog(link.id)}
 *     onDelete={() => handleDeleteLink(link.id)}
 *     onToggle={() => handleToggle(link.id)}
 *   />
 */

'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Eye, EyeOff, GripVertical, MousePointerClick, Pencil, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import type { BioLink } from '@/modules/biolink/types'

// ─── Props ────────────────────────────────────────────────────────────────────

interface LinkItemProps {
  /** Données du lien à afficher */
  link: BioLink
  /** Callback d'édition (ouvre le dialog pré-rempli) */
  onEdit: () => void
  /** Callback de suppression */
  onDelete: () => void
  /** Callback de toggle visibilité (actif/inactif) */
  onToggle: () => void
}

// ─── Composant ────────────────────────────────────────────────────────────────

/**
 * Carte d'un lien dans l'éditeur Bio Link avec support drag & drop.
 * Utilise `useSortable` de dnd-kit pour le réordonnement par glisser-déposer.
 * La poignée (GripVertical) est le déclencheur du drag via `listeners`.
 *
 * @param link     - Données du BioLink
 * @param onEdit   - Ouvre le dialog d'édition
 * @param onDelete - Supprime le lien
 * @param onToggle - Bascule la visibilité
 * @returns Carte compacte draggable avec actions rapides
 */
export function LinkItem({ link, onEdit, onDelete, onToggle }: LinkItemProps): React.JSX.Element {
  // Hook dnd-kit : rend l'item sortable par son id
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: link.id })

  // Styles de transformation appliqués pendant le drag
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    // Pendant le drag : opacité réduite + z-index élevé
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : 'auto' as number | 'auto',
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 rounded-lg border bg-card p-3 transition-colors hover:bg-accent/5 min-w-0"
    >
      {/* ── Poignée de drag (dnd-kit listeners) ──────────────────────── */}
      <button
        type="button"
        className="cursor-grab touch-none text-muted-foreground hover:text-foreground active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-4 shrink-0" />
      </button>

      {/* ── Icône (emoji) ─────────────────────────────────────────────── */}
      {link.icon && (
        <span className="text-lg shrink-0">{link.icon}</span>
      )}

      {/* ── Contenu (titre + URL + clics) ─────────────────────────────── */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">
          {link.title}
        </p>
        <p className="text-xs text-muted-foreground truncate">
          {link.url}
        </p>
      </div>

      {/* ── Badge clics ───────────────────────────────────────────────── */}
      {link.clicks > 0 && (
        <span className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
          <MousePointerClick className="size-3" />
          {link.clicks}
        </span>
      )}

      {/* ── Actions ───────────────────────────────────────────────────── */}
      <div className="flex items-center gap-0.5 shrink-0">
        {/* Toggle visibilité */}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onToggle}
          title={link.isActive ? 'Masquer' : 'Afficher'}
          className="size-8 text-muted-foreground"
        >
          {link.isActive ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
        </Button>

        {/* Éditer */}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onEdit}
          title="Modifier"
          className="size-8 text-muted-foreground"
        >
          <Pencil className="size-3.5" />
        </Button>

        {/* Supprimer */}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onDelete}
          title="Supprimer"
          className="size-8 text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>
    </div>
  )
}
