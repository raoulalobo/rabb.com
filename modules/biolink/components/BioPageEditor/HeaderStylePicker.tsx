/**
 * @file modules/biolink/components/BioPageEditor/HeaderStylePicker.tsx
 * @module biolink
 * @description Sélecteur de style de mise en page (headerStyle) pour l'éditeur Bio Link.
 *   Affiche une grille horizontale scrollable de 5 mini-aperçus schématiques
 *   représentant chaque layout disponible (classic, hero, banner, minimal, card).
 *   Chaque aperçu montre la structure du layout en blocs gris stylisés.
 *
 * @example
 *   <HeaderStylePicker selected="classic" onChange={(style) => setHeaderStyle(style)} />
 */

'use client'

import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

interface HeaderStylePickerProps {
  /** Style actuellement sélectionné */
  selected: string
  /** Callback appelé quand l'utilisateur sélectionne un style */
  onChange: (style: string) => void
}

/** Définition d'un style avec son aperçu schématique */
interface StyleOption {
  /** Identifiant technique (valeur stockée en DB) */
  id: string
  /** Nom affiché en français sous l'aperçu */
  label: string
  /** Composant d'aperçu schématique (blocs gris) */
  preview: React.JSX.Element
}

// ─── Aperçus schématiques des 5 layouts ────────────────────────────────────────

/**
 * Aperçu "Classique" : petit cercle avatar + 2 lignes texte + 3 barres de liens.
 * Structure verticale simple, centrée.
 */
const ClassicPreview = (
  <div className="flex flex-col items-center gap-1.5 p-2">
    {/* Avatar */}
    <div className="size-4 rounded-full bg-current/20" />
    {/* Titre */}
    <div className="h-1.5 w-10 rounded-full bg-current/20" />
    {/* Bio */}
    <div className="h-1 w-8 rounded-full bg-current/10" />
    {/* 3 barres de liens */}
    <div className="w-full space-y-1 mt-1">
      <div className="h-2.5 w-full rounded bg-current/15" />
      <div className="h-2.5 w-full rounded bg-current/15" />
      <div className="h-2.5 w-full rounded bg-current/15" />
    </div>
  </div>
)

/**
 * Aperçu "Hero" : grand rectangle image + cercle avatar en overlay + barres en bas.
 * La zone image occupe ~40% de la hauteur.
 */
const HeroPreview = (
  <div className="flex flex-col items-center gap-0 p-0 overflow-hidden rounded">
    {/* Zone hero (image/gradient) */}
    <div className="w-full h-12 bg-current/15 relative flex items-end justify-center">
      {/* Avatar en overlay */}
      <div className="size-5 rounded-full bg-current/30 border-2 border-white/50 translate-y-2" />
    </div>
    {/* Contenu sous le hero */}
    <div className="w-full p-2 pt-3 space-y-1">
      <div className="h-1.5 w-10 rounded-full bg-current/20 mx-auto" />
      <div className="h-2.5 w-full rounded bg-current/15" />
      <div className="h-2.5 w-full rounded bg-current/15" />
    </div>
  </div>
)

/**
 * Aperçu "Bannière" : rectangle image en haut + carte chevauchante + barres.
 * La carte flottante a un effet d'ombre.
 */
const BannerPreview = (
  <div className="flex flex-col items-center gap-0 p-0 overflow-hidden rounded">
    {/* Image bannière */}
    <div className="w-full h-8 bg-current/15" />
    {/* Carte flottante chevauchante */}
    <div className="w-[85%] bg-white dark:bg-gray-800 rounded-lg shadow-sm -mt-3 p-2 relative z-10 space-y-1">
      <div className="size-4 rounded-full bg-current/20 mx-auto -mt-3" />
      <div className="h-1.5 w-10 rounded-full bg-current/20 mx-auto" />
      <div className="h-1 w-7 rounded-full bg-current/10 mx-auto" />
    </div>
    {/* Liens */}
    <div className="w-full p-2 pt-1.5 space-y-1">
      <div className="h-2.5 w-full rounded bg-current/15" />
      <div className="h-2.5 w-full rounded bg-current/15" />
    </div>
  </div>
)

/**
 * Aperçu "Minimal" : grande ligne titre + petite ligne bio + barres immédiates.
 * Pas de cercle avatar.
 */
const MinimalPreview = (
  <div className="flex flex-col items-center gap-1 p-2">
    {/* Titre en grand */}
    <div className="h-2.5 w-14 rounded-full bg-current/25" />
    {/* Bio subtile */}
    <div className="h-1 w-10 rounded-full bg-current/10" />
    {/* Liens immédiats */}
    <div className="w-full space-y-1 mt-1">
      <div className="h-2.5 w-full rounded bg-current/15" />
      <div className="h-2.5 w-full rounded bg-current/15" />
      <div className="h-2.5 w-full rounded bg-current/15" />
    </div>
    {/* Social en bas */}
    <div className="flex gap-1 mt-1">
      <div className="size-2 rounded-full bg-current/15" />
      <div className="size-2 rounded-full bg-current/15" />
      <div className="size-2 rounded-full bg-current/15" />
    </div>
  </div>
)

/**
 * Aperçu "Carte" : fond gris + carte blanche centrée avec cercle + barres.
 * La carte a un effet glassmorphism stylisé.
 */
const CardPreview = (
  <div className="flex items-center justify-center p-1.5 bg-current/10 rounded h-full">
    {/* Carte glassmorphism */}
    <div className="w-[90%] bg-white dark:bg-gray-800 rounded-lg shadow-sm p-2 space-y-1">
      <div className="size-4 rounded-full bg-current/20 mx-auto" />
      <div className="h-1.5 w-10 rounded-full bg-current/20 mx-auto" />
      <div className="h-1 w-7 rounded-full bg-current/10 mx-auto" />
      <div className="h-2 w-full rounded bg-current/15" />
      <div className="h-2 w-full rounded bg-current/15" />
      <div className="h-2 w-full rounded bg-current/15" />
    </div>
  </div>
)

// ─── Options de style ─────────────────────────────────────────────────────────

/** Les 5 styles de layout disponibles avec leurs aperçus */
const STYLE_OPTIONS: StyleOption[] = [
  { id: 'classic', label: 'Classique', preview: ClassicPreview },
  { id: 'hero', label: 'Hero', preview: HeroPreview },
  { id: 'banner', label: 'Bannière', preview: BannerPreview },
  { id: 'minimal', label: 'Minimal', preview: MinimalPreview },
  { id: 'card', label: 'Carte', preview: CardPreview },
]

// ─── Composant ────────────────────────────────────────────────────────────────

/**
 * Sélecteur de style de mise en page pour l'éditeur.
 * Grille horizontale scrollable de 5 mini-aperçus schématiques.
 * Le style sélectionné est mis en évidence par un ring-2 ring-primary.
 *
 * @param selected - Style actuellement sélectionné
 * @param onChange - Callback de changement de style
 * @returns Grille de sélection avec aperçus schématiques
 */
export function HeaderStylePicker({ selected, onChange }: HeaderStylePickerProps): React.JSX.Element {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-foreground">Mise en page</h3>
      <p className="text-xs text-muted-foreground">
        Choisissez la structure de votre page. Chaque style réorganise le contenu différemment.
      </p>

      {/* Grille horizontale scrollable */}
      <div className="flex gap-2 sm:gap-3 overflow-x-auto pb-2 scrollbar-none">
        {STYLE_OPTIONS.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => onChange(option.id)}
            className={cn(
              'flex-shrink-0 w-[80px] sm:w-[100px] rounded-xl border-2 transition-all cursor-pointer',
              'hover:border-primary/50',
              selected === option.id
                ? 'border-primary ring-2 ring-primary/20'
                : 'border-border'
            )}
          >
            {/* Aperçu schématique (~100×120px) */}
            <div className="h-[100px] overflow-hidden rounded-t-[10px]">
              {option.preview}
            </div>
            {/* Label FR */}
            <div className="px-1 py-1.5 text-center">
              <span className={cn(
                'text-[11px] font-medium',
                selected === option.id ? 'text-primary' : 'text-muted-foreground'
              )}>
                {option.label}
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
