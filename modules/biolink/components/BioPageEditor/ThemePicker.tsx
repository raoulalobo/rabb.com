/**
 * @file modules/biolink/components/BioPageEditor/ThemePicker.tsx
 * @module biolink
 * @description Sélecteur de thème visuel pour l'éditeur Bio Link.
 *   Affiche les 5 thèmes disponibles sous forme de pastilles cliquables.
 *   Le thème sélectionné est appliqué immédiatement dans le LivePreview
 *   via le store Zustand (sans sauvegarde tant que l'user ne clique pas "Enregistrer").
 *
 * @example
 *   <ThemePicker
 *     selectedTheme="dark"
 *     accentColor="#6366f1"
 *     onThemeChange={setTheme}
 *     onAccentColorChange={setAccentColor}
 *   />
 */

'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { BIO_THEMES, type BioThemeName } from '@/modules/biolink/schemas/biolink.schema'
import { BIOLINK_THEMES } from '@/modules/biolink/themes'

import { cn } from '@/lib/utils'

// ─── Props ────────────────────────────────────────────────────────────────────

interface ThemePickerProps {
  /** Thème actuellement sélectionné */
  selectedTheme: BioThemeName
  /** Couleur d'accent actuelle (hex) */
  accentColor: string
  /** Callback de changement de thème */
  onThemeChange: (theme: BioThemeName) => void
  /** Callback de changement de couleur d'accent */
  onAccentColorChange: (color: string) => void
}

// ─── Composant ────────────────────────────────────────────────────────────────

/**
 * Sélecteur de thème pour la BioPage.
 * Affiche une grille de pastilles (5 thèmes) + un color picker pour la couleur d'accent.
 *
 * @param selectedTheme     - Thème sélectionné
 * @param accentColor       - Couleur d'accent hex
 * @param onThemeChange     - Setter du thème
 * @param onAccentColorChange - Setter de la couleur
 * @returns Grille de sélection de thème + color picker
 */
export function ThemePicker({
  selectedTheme,
  accentColor,
  onThemeChange,
  onAccentColorChange,
}: ThemePickerProps): React.JSX.Element {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-foreground">Thème</h3>

      {/* ── Grille des 5 thèmes ──────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        {BIO_THEMES.map((themeKey) => {
          const theme = BIOLINK_THEMES[themeKey]
          const isSelected = selectedTheme === themeKey

          return (
            <button
              key={themeKey}
              type="button"
              onClick={() => onThemeChange(themeKey)}
              className={cn(
                // Pastille miniature représentant le thème
                'flex flex-col items-center gap-1.5 rounded-lg border-2 p-2 transition-all',
                isSelected
                  ? 'border-primary ring-2 ring-primary/20'
                  : 'border-border hover:border-primary/50'
              )}
            >
              {/* Mini preview du thème : rectangle avec le fond + 2 barres */}
              <div
                className={cn(
                  'h-10 w-full rounded-md flex flex-col items-center justify-center gap-1 p-1',
                  theme.container
                )}
              >
                {/* Mini barres simulant des liens */}
                <div className={cn('h-1.5 w-3/4 rounded-full', theme.link)} />
                <div className={cn('h-1.5 w-3/4 rounded-full', theme.link)} />
              </div>
              <span className="text-[10px] font-medium text-muted-foreground">
                {theme.name}
              </span>
            </button>
          )
        })}
      </div>

      {/* ── Couleur d'accent ──────────────────────────────────────────── */}
      <div className="space-y-2">
        <Label htmlFor="bio-accent-color">Couleur d'accent</Label>
        <div className="flex items-center gap-2">
          <input
            id="bio-accent-color"
            type="color"
            value={accentColor}
            onChange={(e) => onAccentColorChange(e.target.value)}
            className="h-9 w-9 cursor-pointer rounded-md border border-border p-0.5"
          />
          <Input
            value={accentColor}
            onChange={(e) => {
              // Accepter uniquement les valeurs hex valides
              const val = e.target.value
              if (/^#[0-9a-fA-F]{0,6}$/.test(val)) {
                onAccentColorChange(val)
              }
            }}
            placeholder="#6366f1"
            className="w-28"
            maxLength={7}
          />
        </div>
      </div>
    </div>
  )
}
