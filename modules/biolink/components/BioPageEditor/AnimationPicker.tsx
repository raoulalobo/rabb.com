/**
 * @file modules/biolink/components/BioPageEditor/AnimationPicker.tsx
 * @module biolink
 * @description Sélecteur d'animation au survol pour l'éditeur Bio Link.
 *   Affiche 4 options d'animation (Aucune, Agrandir, Lueur, Glisser).
 *   Chaque bouton démontre l'animation directement sur lui-même au hover,
 *   permettant à l'utilisateur de tester l'effet avant de le sélectionner.
 *
 * @example
 *   <AnimationPicker
 *     selected="scale"
 *     onChange={(anim) => setHoverAnimation(anim)}
 *   />
 */

'use client'

import { BIO_HOVER_ANIMATIONS, type BioHoverAnimation } from '@/modules/biolink/schemas/biolink.schema'
import { cn } from '@/lib/utils'

// ─── Props ────────────────────────────────────────────────────────────────────

interface AnimationPickerProps {
  /** Clé de l'animation actuellement sélectionnée */
  selected: string
  /** Callback déclenché au clic sur une animation */
  onChange: (s: string) => void
}

// ─── Labels et classes d'animation pour chaque option ─────────────────────────

/** Label en français pour chaque animation au survol */
const ANIMATION_LABELS: Record<BioHoverAnimation, string> = {
  none: 'Aucune',
  scale: 'Agrandir',
  glow: 'Lueur',
  slide: 'Glisser',
}

/**
 * Classes Tailwind d'animation hover appliquées au bouton lui-même.
 * L'utilisateur peut survoler le bouton pour voir l'effet en action.
 */
const ANIMATION_HOVER_CLASSES: Record<BioHoverAnimation, string> = {
  none: '',
  scale: 'hover:scale-105 transition-transform',
  glow: 'hover:shadow-[0_0_20px_rgba(99,102,241,0.4)] transition-shadow',
  slide: 'hover:translate-x-1 transition-transform',
}

// ─── Composant ────────────────────────────────────────────────────────────────

/**
 * Sélecteur d'animation au survol pour les liens de la BioPage.
 * 4 boutons dont chacun applique l'animation hover correspondante sur lui-même,
 * servant de démonstration interactive.
 *
 * @param selected - Clé de l'animation active
 * @param onChange - Setter de l'animation
 * @returns Grille de 4 boutons avec démonstration hover
 */
export function AnimationPicker({ selected, onChange }: AnimationPickerProps): React.JSX.Element {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-foreground">Animation au survol</h3>

      {/* ── 4 boutons avec animation hover démo ───────────────────────── */}
      <div className="grid grid-cols-2 gap-2">
        {BIO_HOVER_ANIMATIONS.map((animKey) => {
          const isSelected = selected === animKey

          return (
            <button
              key={animKey}
              type="button"
              onClick={() => onChange(animKey)}
              className={cn(
                // Conteneur cliquable avec bordure de sélection
                'flex items-center justify-center rounded-lg border-2 p-3 text-sm font-medium',
                isSelected
                  ? 'border-primary ring-2 ring-primary/20'
                  : 'border-border hover:border-primary/50',
                // Applique l'animation hover correspondante sur le bouton lui-même
                // afin que l'utilisateur puisse tester l'effet en survolant
                ANIMATION_HOVER_CLASSES[animKey]
              )}
            >
              {ANIMATION_LABELS[animKey]}
            </button>
          )
        })}
      </div>

      <p className="text-xs text-muted-foreground">
        Survolez chaque option pour voir l'effet
      </p>
    </div>
  )
}
