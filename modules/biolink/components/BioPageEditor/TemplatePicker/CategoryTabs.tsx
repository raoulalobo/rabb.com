/**
 * @file modules/biolink/components/BioPageEditor/TemplatePicker/CategoryTabs.tsx
 * @module biolink
 * @description Barre de catégories scrollable horizontalement pour filtrer les templates.
 *   Affiche un bouton "Tous" suivi des 15 catégories avec leur icône Lucide.
 *   Le bouton actif a un fond primary et un texte blanc.
 *
 * @example
 *   <CategoryTabs
 *     activeCategory={null}
 *     onCategoryChange={setActiveCategory}
 *   />
 */

'use client'

import {
  Blend,
  Brush,
  ChefHat,
  Code,
  Crown,
  Dumbbell,
  Gamepad2,
  LayoutGrid,
  Leaf,
  Minus,
  Moon,
  Music,
  Palette,
  Radio,
  Shirt,
  Zap,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import { TEMPLATE_CATEGORIES } from '@/modules/biolink/templates/categories'
import type { TemplateCategory } from '@/modules/biolink/templates/types'

// ─── Map icône nom → composant Lucide ───────────────────────────────────────

/** Correspondance entre le nom d'icône stocké et le composant React Lucide */
const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Minus,
  Zap,
  Moon,
  Leaf,
  Palette,
  Blend,
  Radio,
  Crown,
  Brush,
  Code,
  Gamepad2,
  ChefHat,
  Music,
  Shirt,
  Dumbbell,
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface CategoryTabsProps {
  /** Catégorie active (null = "Tous") */
  activeCategory: TemplateCategory | null
  /** Callback de changement de catégorie */
  onCategoryChange: (category: TemplateCategory | null) => void
}

// ─── Composant ────────────────────────────────────────────────────────────────

/**
 * Barre de catégories scrollable pour filtrer les templates bio link.
 * Affiche "Tous" + les 15 catégories avec icône Lucide et nom FR.
 *
 * @param activeCategory   - Catégorie sélectionnée (null = toutes)
 * @param onCategoryChange - Setter de catégorie
 * @returns Barre scrollable de pills cliquables
 */
export function CategoryTabs({
  activeCategory,
  onCategoryChange,
}: CategoryTabsProps): React.JSX.Element {
  return (
    <div className="flex gap-1 sm:gap-1.5 overflow-x-auto pb-1 scrollbar-none">
      {/* Bouton "Tous" */}
      <button
        type="button"
        onClick={() => onCategoryChange(null)}
        className={cn(
          'flex shrink-0 items-center gap-1.5 rounded-full px-2 py-1 sm:px-3 sm:py-1.5 text-xs font-medium transition-colors',
          activeCategory === null
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted text-muted-foreground hover:bg-muted/80'
        )}
      >
        <LayoutGrid className="size-3.5" />
        Tous
      </button>

      {/* Boutons de catégorie */}
      {TEMPLATE_CATEGORIES.map((cat) => {
        const Icon = ICON_MAP[cat.icon]
        const isActive = activeCategory === cat.id

        return (
          <button
            key={cat.id}
            type="button"
            onClick={() => onCategoryChange(cat.id)}
            title={cat.description}
            className={cn(
              'flex shrink-0 items-center gap-1.5 rounded-full px-2 py-1 sm:px-3 sm:py-1.5 text-xs font-medium transition-colors',
              isActive
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            )}
          >
            {Icon && <Icon className="size-3.5" />}
            {cat.name}
          </button>
        )
      })}
    </div>
  )
}
