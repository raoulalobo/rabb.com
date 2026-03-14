/**
 * @file modules/biolink/components/BioPageEditor/FontPicker.tsx
 * @module biolink
 * @description Sélecteur de police de caractères pour l'éditeur Bio Link.
 *   Affiche les 8 polices Google Fonts disponibles sous forme de grille cliquable.
 *   Chaque bouton affiche le nom de la police rendu DANS cette police,
 *   permettant à l'utilisateur de voir un aperçu instantané du rendu typographique.
 *   Les feuilles de style Google Fonts sont injectées via des balises <link> dans le <head>.
 *
 * @example
 *   <FontPicker
 *     selected="poppins"
 *     onChange={(font) => setFontFamily(font)}
 *   />
 */

'use client'

import { BIO_FONTS, type BioFontName } from '@/modules/biolink/schemas/biolink.schema'
import { BIO_FONT_CONFIG } from '@/modules/biolink/themes'
import { cn } from '@/lib/utils'

// ─── Props ────────────────────────────────────────────────────────────────────

interface FontPickerProps {
  /** Clé de la police actuellement sélectionnée (ex: "poppins", "inter") */
  selected: string
  /** Callback déclenché au clic sur une police */
  onChange: (font: string) => void
}

// ─── Composant ────────────────────────────────────────────────────────────────

/**
 * Grille de sélection de police pour la BioPage.
 * Affiche 8 boutons (2 colonnes × 4 lignes), chacun rendu dans sa propre police.
 * La police sélectionnée reçoit un anneau visuel (ring-2 ring-primary).
 *
 * @param selected - Clé de la police active
 * @param onChange - Setter de la police
 * @returns Grille de 8 boutons avec aperçu typographique
 */
export function FontPicker({ selected, onChange }: FontPickerProps): React.JSX.Element {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-foreground">Police</h3>

      {/* ── Injection des CSS Google Fonts pour le rendu d'aperçu ─────── */}
      {/* eslint-disable-next-line @next/next/no-head-element -- Liens CSS nécessaires pour l'aperçu des polices */}
      {BIO_FONTS.map((fontKey) => {
        const config = BIO_FONT_CONFIG[fontKey]
        return (
          <link
            key={fontKey}
            rel="stylesheet"
            href={config.googleUrl}
            // Préchargement différé pour ne pas bloquer le rendu principal
          />
        )
      })}

      {/* ── Grille 2 colonnes × 4 lignes des 8 polices ────────────────── */}
      <div className="grid grid-cols-2 gap-2">
        {BIO_FONTS.map((fontKey) => {
          const config = BIO_FONT_CONFIG[fontKey]
          const isSelected = selected === fontKey

          return (
            <button
              key={fontKey}
              type="button"
              onClick={() => onChange(fontKey)}
              className={cn(
                // Bouton de sélection avec aperçu du nom dans sa propre police
                'flex items-center justify-center rounded-lg border-2 p-2 sm:p-3 transition-all text-sm',
                isSelected
                  ? 'border-primary ring-2 ring-primary/20'
                  : 'border-border hover:border-primary/50'
              )}
              // Applique la police pour que le nom s'affiche dans son propre style
              style={{ fontFamily: config.family }}
            >
              {config.name}
            </button>
          )
        })}
      </div>
    </div>
  )
}
