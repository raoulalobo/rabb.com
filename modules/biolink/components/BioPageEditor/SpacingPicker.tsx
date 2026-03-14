/**
 * @file modules/biolink/components/BioPageEditor/SpacingPicker.tsx
 * @module biolink
 * @description Sélecteur d'espacement entre les liens pour l'éditeur Bio Link.
 *   Affiche 3 options (Compact, Normal, Aéré) sous forme de boutons cliquables.
 *   Chaque bouton contient un mini-aperçu avec 3 barres horizontales dont
 *   l'espacement illustre visuellement l'option choisie.
 *
 * @example
 *   <SpacingPicker
 *     selected="normal"
 *     onChange={(spacing) => setLinkSpacing(spacing)}
 *   />
 */

'use client'

import { BIO_LINK_SPACINGS, type BioLinkSpacing } from '@/modules/biolink/schemas/biolink.schema'
import { cn } from '@/lib/utils'

// ─── Props ────────────────────────────────────────────────────────────────────

interface SpacingPickerProps {
  /** Clé de l'espacement actuellement sélectionné */
  selected: string
  /** Callback déclenché au clic sur un espacement */
  onChange: (s: string) => void
}

// ─── Labels et classes de gap pour chaque espacement ──────────────────────────

/** Label en français pour chaque option d'espacement */
const SPACING_LABELS: Record<BioLinkSpacing, string> = {
  compact: 'Compact',
  normal: 'Normal',
  airy: 'Aéré',
}

/** Classes Tailwind de gap appliquées au mini-aperçu (3 barres) */
const SPACING_GAP_CLASSES: Record<BioLinkSpacing, string> = {
  compact: 'gap-0.5',
  normal: 'gap-1.5',
  airy: 'gap-3',
}

// ─── Composant ────────────────────────────────────────────────────────────────

/**
 * Sélecteur d'espacement pour les liens de la BioPage.
 * 3 boutons avec mini-aperçu illustrant visuellement la densité.
 *
 * @param selected - Clé de l'espacement actif
 * @param onChange - Setter de l'espacement
 * @returns Grille de 3 boutons avec aperçu de densité
 */
export function SpacingPicker({ selected, onChange }: SpacingPickerProps): React.JSX.Element {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-foreground">Espacement</h3>

      {/* ── 3 boutons de sélection d'espacement ───────────────────────── */}
      <div className="grid grid-cols-3 gap-2">
        {BIO_LINK_SPACINGS.map((spacingKey) => {
          const isSelected = selected === spacingKey

          return (
            <button
              key={spacingKey}
              type="button"
              onClick={() => onChange(spacingKey)}
              className={cn(
                // Conteneur cliquable avec bordure de sélection
                'flex flex-col items-center gap-2 rounded-lg border-2 p-3 transition-all',
                isSelected
                  ? 'border-primary ring-2 ring-primary/20'
                  : 'border-border hover:border-primary/50'
              )}
            >
              {/* Mini-aperçu : 3 barres horizontales espacées selon l'option */}
              <div className={cn('flex w-full flex-col items-center', SPACING_GAP_CLASSES[spacingKey])}>
                {Array.from({ length: 3 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-1.5 w-3/4 rounded-full bg-muted-foreground/30"
                  />
                ))}
              </div>
              <span className="text-[10px] font-medium text-muted-foreground">
                {SPACING_LABELS[spacingKey]}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
