/**
 * @file modules/biolink/components/BioPageEditor/AvatarShapePicker.tsx
 * @module biolink
 * @description Sélecteur de forme d'avatar pour l'éditeur Bio Link.
 *   Affiche 3 boutons représentant les formes possibles de l'avatar :
 *   cercle, carré arrondi et carré. Chaque bouton contient un mini-aperçu
 *   visuel de la forme correspondante (un petit div stylé).
 *
 * @example
 *   <AvatarShapePicker
 *     selected="circle"
 *     onChange={(shape) => setAvatarShape(shape)}
 *   />
 */

'use client'

import { BIO_AVATAR_SHAPES, type BioAvatarShape } from '@/modules/biolink/schemas/biolink.schema'
import { cn } from '@/lib/utils'

// ─── Props ────────────────────────────────────────────────────────────────────

interface AvatarShapePickerProps {
  /** Forme d'avatar actuellement sélectionnée */
  selected: string
  /** Callback déclenché au clic sur une forme */
  onChange: (s: string) => void
}

// ─── Labels et classes d'aperçu pour chaque forme ─────────────────────────────

/** Label en français pour chaque forme d'avatar */
const SHAPE_LABELS: Record<BioAvatarShape, string> = {
  circle: 'Cercle',
  'rounded-square': 'Arrondi',
  square: 'Carré',
}

/** Classes Tailwind du mini-aperçu pour chaque forme d'avatar */
const SHAPE_PREVIEW_CLASSES: Record<BioAvatarShape, string> = {
  circle: 'rounded-full',
  'rounded-square': 'rounded-xl',
  square: 'rounded-none',
}

// ─── Composant ────────────────────────────────────────────────────────────────

/**
 * Sélecteur de forme d'avatar pour la BioPage.
 * Affiche 3 boutons disposés en ligne, chacun avec un mini-aperçu
 * illustrant la forme (cercle, carré arrondi, carré).
 *
 * @param selected - Clé de la forme active
 * @param onChange - Setter de la forme
 * @returns Ligne de 3 boutons avec aperçu de forme
 */
export function AvatarShapePicker({ selected, onChange }: AvatarShapePickerProps): React.JSX.Element {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-foreground">Forme de l'avatar</h3>

      {/* ── 3 boutons de sélection de forme ────────────────────────────── */}
      <div className="grid grid-cols-3 gap-2">
        {BIO_AVATAR_SHAPES.map((shapeKey) => {
          const isSelected = selected === shapeKey

          return (
            <button
              key={shapeKey}
              type="button"
              onClick={() => onChange(shapeKey)}
              className={cn(
                // Conteneur cliquable avec bordure de sélection
                'flex flex-col items-center gap-2 rounded-lg border-2 p-3 transition-all',
                isSelected
                  ? 'border-primary ring-2 ring-primary/20'
                  : 'border-border hover:border-primary/50'
              )}
            >
              {/* Mini-aperçu de la forme : div 32×32 avec fond gris */}
              <div
                className={cn(
                  'size-8 bg-muted-foreground/30',
                  // Applique le border-radius correspondant à la forme
                  SHAPE_PREVIEW_CLASSES[shapeKey]
                )}
              />
              <span className="text-[10px] font-medium text-muted-foreground">
                {SHAPE_LABELS[shapeKey]}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
