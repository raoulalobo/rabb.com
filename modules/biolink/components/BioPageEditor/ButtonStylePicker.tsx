/**
 * @file modules/biolink/components/BioPageEditor/ButtonStylePicker.tsx
 * @module biolink
 * @description Sélecteur de style de bouton pour l'éditeur Bio Link.
 *   Permet de configurer deux aspects indépendants des boutons de liens :
 *   - La **forme** (border-radius) : arrondi, pilule ou carré
 *   - La **variante** (style visuel) : rempli, contour ou ombre
 *   Chaque option affiche un mini-aperçu rectangulaire pour visualiser l'effet.
 *
 * @example
 *   <ButtonStylePicker
 *     shape="rounded-lg"
 *     variant="filled"
 *     onShapeChange={(s) => setShape(s)}
 *     onVariantChange={(v) => setVariant(v)}
 *   />
 */

'use client'

import { BIO_BUTTON_SHAPES, BIO_BUTTON_VARIANTS, type BioButtonShape, type BioButtonVariant } from '@/modules/biolink/schemas/biolink.schema'
import { cn } from '@/lib/utils'

// ─── Props ────────────────────────────────────────────────────────────────────

interface ButtonStylePickerProps {
  /** Forme du bouton actuellement sélectionnée */
  shape: string
  /** Variante visuelle du bouton actuellement sélectionnée */
  variant: string
  /** Callback de changement de forme */
  onShapeChange: (s: string) => void
  /** Callback de changement de variante */
  onVariantChange: (v: string) => void
}

// ─── Labels en français pour chaque forme ─────────────────────────────────────

/** Correspondance entre la clé de forme et le label affiché */
const SHAPE_LABELS: Record<BioButtonShape, string> = {
  'rounded-lg': 'Arrondi',
  'rounded-full': 'Pilule',
  'rounded-none': 'Carré',
}

/** Correspondance entre la clé de variante et le label affiché */
const VARIANT_LABELS: Record<BioButtonVariant, string> = {
  filled: 'Rempli',
  outline: 'Contour',
  shadow: 'Ombre',
}

// ─── Composant ────────────────────────────────────────────────────────────────

/**
 * Sélecteur de style de bouton avec deux sections :
 * - "Forme" : 3 boutons avec mini-aperçu du border-radius
 * - "Style" : 3 boutons labellisés (Rempli, Contour, Ombre)
 *
 * @param shape           - Forme active
 * @param variant         - Variante active
 * @param onShapeChange   - Setter de la forme
 * @param onVariantChange - Setter de la variante
 * @returns Deux sections de sélection (forme + variante)
 */
export function ButtonStylePicker({
  shape,
  variant,
  onShapeChange,
  onVariantChange,
}: ButtonStylePickerProps): React.JSX.Element {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-foreground">Style des boutons</h3>

      {/* ── Section Forme : 3 boutons avec mini-rectangle d'aperçu ──── */}
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">Forme</p>
        <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
          {BIO_BUTTON_SHAPES.map((shapeKey) => {
            const isSelected = shape === shapeKey

            return (
              <button
                key={shapeKey}
                type="button"
                onClick={() => onShapeChange(shapeKey)}
                className={cn(
                  // Conteneur de chaque option de forme
                  'flex flex-col items-center gap-1 rounded-lg border-2 p-2 sm:gap-1.5 sm:p-3 transition-all',
                  isSelected
                    ? 'border-primary ring-2 ring-primary/20'
                    : 'border-border hover:border-primary/50'
                )}
              >
                {/* Mini-rectangle d'aperçu montrant le border-radius appliqué */}
                <div
                  className={cn(
                    'h-4 w-full bg-muted-foreground/30',
                    // Applique le border-radius correspondant à la forme
                    shapeKey
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

      {/* ── Section Style : 3 boutons labellisés ──────────────────────── */}
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">Style</p>
        <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
          {BIO_BUTTON_VARIANTS.map((variantKey) => {
            const isSelected = variant === variantKey

            return (
              <button
                key={variantKey}
                type="button"
                onClick={() => onVariantChange(variantKey)}
                className={cn(
                  // Bouton de sélection de la variante visuelle
                  'flex flex-col items-center gap-1 rounded-lg border-2 p-2 sm:gap-1.5 sm:p-3 transition-all',
                  isSelected
                    ? 'border-primary ring-2 ring-primary/20'
                    : 'border-border hover:border-primary/50'
                )}
              >
                {/* Mini-rectangle d'aperçu illustrant la variante */}
                <div
                  className={cn(
                    'h-4 w-full rounded',
                    // Style visuel différent selon la variante
                    variantKey === 'filled' && 'bg-muted-foreground/40',
                    variantKey === 'outline' && 'border-2 border-muted-foreground/40 bg-transparent',
                    variantKey === 'shadow' && 'bg-muted-foreground/20 shadow-md'
                  )}
                />
                <span className="text-[10px] font-medium text-muted-foreground">
                  {VARIANT_LABELS[variantKey]}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
