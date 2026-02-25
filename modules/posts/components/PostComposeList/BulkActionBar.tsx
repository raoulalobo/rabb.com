/**
 * @file modules/posts/components/PostComposeList/BulkActionBar.tsx
 * @module posts
 * @description Barre d'actions groupées flottante, affichée en bas d'écran
 *   lorsqu'au moins un post est sélectionné dans la liste /compose.
 *
 *   Contenu :
 *   - Compteur : "N sélectionné(s)"
 *   - Bouton "Tout sélectionner" (sélectionne tous les posts DRAFT/SCHEDULED chargés)
 *   - Bouton "Supprimer (N)" avec confirmation visuelle (destructive)
 *   - Bouton "✕" pour désélectionner tout et quitter le mode sélection
 *
 *   Animation :
 *   - Slide-in depuis le bas quand count > 0
 *   - Slide-out (translate-y-4 + opacity-0) quand count = 0
 *   - pointer-events-none quand invisible pour ne pas bloquer les clics derrière
 *
 * @example
 *   <BulkActionBar
 *     count={selectedIds.size}
 *     totalDeletable={3}
 *     onDelete={handleBulkDelete}
 *     onSelectAll={handleSelectAll}
 *     onClear={handleClearSelection}
 *     isDeleting={isBulkDeleting}
 *   />
 */

'use client'

import { Loader2, Trash2, X } from 'lucide-react'

import { Button } from '@/components/ui/button'

// ─── Props ────────────────────────────────────────────────────────────────────

interface BulkActionBarProps {
  /** Nombre de posts actuellement sélectionnés */
  count: number
  /**
   * Nombre total de posts sélectionnables parmi les posts chargés
   * (DRAFT + SCHEDULED uniquement — PUBLISHED et FAILED ne peuvent pas être supprimés).
   * Utilisé pour afficher "Tout sélectionner (N)".
   */
  totalDeletable: number
  /** Déclenche la suppression en masse de tous les posts sélectionnés */
  onDelete: () => void
  /** Sélectionne tous les posts DRAFT/SCHEDULED chargés */
  onSelectAll: () => void
  /** Désélectionne tout et quitte le mode sélection */
  onClear: () => void
  /** true pendant l'appel API de suppression groupée */
  isDeleting: boolean
}

// ─── Composant ────────────────────────────────────────────────────────────────

/**
 * Barre d'actions groupées positionnée en bas d'écran (fixed).
 * Apparaît avec une animation slide-up dès qu'au moins un post est sélectionné.
 *
 * @param count           - Posts sélectionnés
 * @param totalDeletable  - Posts éligibles à la sélection totale
 * @param onDelete        - Handler suppression groupée
 * @param onSelectAll     - Handler "Tout sélectionner"
 * @param onClear         - Handler désélection + sortie du mode sélection
 * @param isDeleting      - Indicateur de chargement pendant la suppression
 */
export function BulkActionBar({
  count,
  totalDeletable,
  onDelete,
  onSelectAll,
  onClear,
  isDeleting,
}: BulkActionBarProps): React.JSX.Element {
  const isVisible = count > 0
  const allSelected = count >= totalDeletable && totalDeletable > 0

  return (
    /*
     * fixed bottom-6 left-1/2 -translate-x-1/2 : centré horizontalement en bas
     * z-50 : au-dessus de la liste et de la toolbar sticky
     * transition-all : anime opacity + translate simultanément
     * pointer-events-none quand invisible : les clics passent à travers
     */
    <div
      className={[
        'fixed bottom-6 left-1/2 z-50 -translate-x-1/2',
        'flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1.5 shadow-lg',
        'transition-all duration-200',
        isVisible
          ? 'translate-y-0 opacity-100 pointer-events-auto'
          : 'translate-y-4 opacity-0 pointer-events-none',
      ].join(' ')}
      role="toolbar"
      aria-label="Actions groupées"
    >
      {/* ── Compteur ────────────────────────────────────────────────────── */}
      <span className="text-sm font-medium tabular-nums whitespace-nowrap px-1">
        {count} sélectionné{count > 1 ? 's' : ''}
      </span>

      {/* Séparateur vertical */}
      <div className="h-4 w-px shrink-0 bg-border" aria-hidden />

      {/* ── Tout sélectionner / Désélectionner tout ──────────────────────── */}
      <Button
        variant="ghost"
        size="sm"
        className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground whitespace-nowrap"
        onClick={allSelected ? onClear : onSelectAll}
        disabled={isDeleting}
      >
        {allSelected
          ? 'Désélectionner tout'
          : `Tout sélectionner (${totalDeletable})`}
      </Button>

      {/* Séparateur vertical */}
      <div className="h-4 w-px shrink-0 bg-border" aria-hidden />

      {/* ── Supprimer (N) ────────────────────────────────────────────────── */}
      <Button
        variant="destructive"
        size="sm"
        className="h-7 gap-1.5 px-3 text-xs"
        onClick={onDelete}
        disabled={isDeleting || count === 0}
      >
        {isDeleting ? (
          <Loader2 className="size-3 animate-spin" />
        ) : (
          <Trash2 className="size-3" />
        )}
        Supprimer ({count})
      </Button>

      {/* ── Annuler / Fermer ─────────────────────────────────────────────── */}
      <button
        type="button"
        onClick={onClear}
        disabled={isDeleting}
        aria-label="Annuler la sélection"
        title="Annuler la sélection"
        className={[
          'flex size-7 items-center justify-center rounded-full',
          'text-muted-foreground hover:bg-muted hover:text-foreground',
          'transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        ].join(' ')}
      >
        <X className="size-3.5" />
      </button>
    </div>
  )
}
