/**
 * @file modules/media/components/MediaFiltersBar.tsx
 * @module media
 * @description Barre de filtres et contrôles de la Media Library.
 *
 *   Expose :
 *   - Filtre type : boutons toggle "Tous | Images | Vidéos"
 *   - Filtre tag  : badges cliquables colorés (un clic = filtre, re-clic = reset)
 *   - Count total : "N assets"
 *   - Bouton "Sélectionner" : active le mode sélection multiple
 *   - Dropdown tri : Newest / Oldest / Name / Size
 *   - Toggle vue  : Grid | List (icônes)
 *
 *   Tous les états sont contrôlés depuis le parent (MediaLibraryContent).
 *
 *   Utilisé dans : MediaLibraryContent
 *
 * @example
 *   <MediaFiltersBar
 *     total={42}
 *     typeFilter="all"
 *     onTypeFilter={setTypeFilter}
 *     tags={tags}
 *     selectedTagId={selectedTagId}
 *     onTagSelect={setSelectedTagId}
 *     sortBy="newest"
 *     onSortBy={setSortBy}
 *     viewMode="grid"
 *     onViewMode={setViewMode}
 *     isSelectMode={false}
 *     onToggleSelectMode={() => setIsSelectMode((p) => !p)}
 *   />
 */

'use client'

import { LayoutGrid, List, ChevronDown, MousePointer2 } from 'lucide-react'
import { cn } from '@/lib/utils'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { MediaSortBy, MediaTag, MediaTypeFilter, MediaViewMode } from '@/modules/media/types'

// ─── Labels de tri ────────────────────────────────────────────────────────────

/** Labels lisibles des options de tri */
const SORT_LABELS: Record<MediaSortBy, string> = {
  newest: 'Plus récent',
  oldest: 'Plus ancien',
  name:   'Nom A–Z',
  size:   'Taille (desc)',
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface MediaFiltersBarProps {
  /** Nombre total de médias correspondant aux filtres actifs */
  total: number
  /** Filtre type actif */
  typeFilter: MediaTypeFilter
  /** Callback changement de filtre type */
  onTypeFilter: (type: MediaTypeFilter) => void
  /** Liste des tags disponibles */
  tags: MediaTag[]
  /** ID du tag filtré (undefined = aucun filtre) */
  selectedTagId: string | undefined
  /** Callback sélection/désélection d'un tag */
  onTagSelect: (tagId: string | undefined) => void
  /** Critère de tri actif */
  sortBy: MediaSortBy
  /** Callback changement de tri */
  onSortBy: (sortBy: MediaSortBy) => void
  /** Mode de vue actif */
  viewMode: MediaViewMode
  /** Callback changement de vue */
  onViewMode: (mode: MediaViewMode) => void
  /** Indique si le mode sélection multiple est actif */
  isSelectMode: boolean
  /** Callback toggle du mode sélection */
  onToggleSelectMode: () => void
}

// ─── Composant ────────────────────────────────────────────────────────────────

/**
 * Barre de filtres, tri et contrôles de vue pour la Media Library.
 */
export function MediaFiltersBar({
  total,
  typeFilter,
  onTypeFilter,
  tags,
  selectedTagId,
  onTagSelect,
  sortBy,
  onSortBy,
  viewMode,
  onViewMode,
  isSelectMode,
  onToggleSelectMode,
}: MediaFiltersBarProps): React.JSX.Element {
  return (
    <div className="flex flex-wrap items-center gap-3 py-2">
      {/* ── Filtre type ──────────────────────────────────────────────────── */}
      <div className="flex items-center rounded-md border border-border bg-muted/40 p-0.5">
        {(['all', 'image', 'video'] as MediaTypeFilter[]).map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => onTypeFilter(type)}
            className={cn(
              'rounded px-2.5 py-1 text-xs font-medium transition-colors',
              typeFilter === type
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {type === 'all' ? 'Tous' : type === 'image' ? 'Images' : 'Vidéos'}
          </button>
        ))}
      </div>

      {/* ── Badges de filtres par tag ────────────────────────────────────── */}
      {tags.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {tags.map((tag) => {
            const isActive = selectedTagId === tag.id
            return (
              <button
                key={tag.id}
                type="button"
                onClick={() => onTagSelect(isActive ? undefined : tag.id)}
                className={cn(
                  'flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium transition-all',
                  isActive
                    ? 'shadow-sm'
                    : 'border-border bg-transparent text-muted-foreground hover:border-current',
                )}
                style={isActive ? { borderColor: tag.color, color: tag.color } : undefined}
              >
                {/* Pastille de couleur */}
                <span
                  className="size-1.5 rounded-full"
                  style={{ backgroundColor: tag.color }}
                />
                {tag.name}
              </button>
            )
          })}
        </div>
      )}

      {/* ── Spacer ───────────────────────────────────────────────────────── */}
      <div className="flex-1" />

      {/* ── Count total ─────────────────────────────────────────────────── */}
      <span className="shrink-0 text-xs text-muted-foreground">
        {total} asset{total !== 1 ? 's' : ''}
      </span>

      {/* ── Bouton mode sélection ────────────────────────────────────────── */}
      <Button
        type="button"
        variant={isSelectMode ? 'default' : 'outline'}
        size="sm"
        onClick={onToggleSelectMode}
        className="gap-1.5 text-xs"
      >
        <MousePointer2 className="size-3.5" />
        {isSelectMode ? 'Annuler' : 'Sélectionner'}
      </Button>

      {/* ── Dropdown tri ────────────────────────────────────────────────── */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs">
            {SORT_LABELS[sortBy]}
            <ChevronDown className="size-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuRadioGroup
            value={sortBy}
            onValueChange={(v) => onSortBy(v as MediaSortBy)}
          >
            {(Object.entries(SORT_LABELS) as [MediaSortBy, string][]).map(([key, label]) => (
              <DropdownMenuRadioItem key={key} value={key}>
                {label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* ── Toggle vue grid / list ───────────────────────────────────────── */}
      <div className="flex items-center rounded-md border border-border bg-muted/40 p-0.5">
        <button
          type="button"
          onClick={() => onViewMode('grid')}
          aria-label="Vue grille"
          className={cn(
            'rounded p-1.5 transition-colors',
            viewMode === 'grid'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <LayoutGrid className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={() => onViewMode('list')}
          aria-label="Vue liste"
          className={cn(
            'rounded p-1.5 transition-colors',
            viewMode === 'list'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <List className="size-3.5" />
        </button>
      </div>
    </div>
  )
}
