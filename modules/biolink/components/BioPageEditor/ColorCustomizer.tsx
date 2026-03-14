/**
 * @file modules/biolink/components/BioPageEditor/ColorCustomizer.tsx
 * @module biolink
 * @description Section de l'éditeur Bio Link pour personnaliser les couleurs
 *   du titre, de la bio et des liens, indépendamment du thème.
 *   Chaque couleur est optionnelle : null = couleur héritée du thème.
 *   Un bouton "reset" permet de revenir à la couleur par défaut du thème.
 *
 * @example
 *   <ColorCustomizer
 *     titleColor="#ff0000"
 *     bioColor={null}
 *     linkColor="#00ff00"
 *     onTitleColorChange={setTitleColor}
 *     onBioColorChange={setBioColor}
 *     onLinkColorChange={setLinkColor}
 *   />
 */

'use client'

import { RotateCcw } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'

// ─── Props ────────────────────────────────────────────────────────────────────

interface ColorCustomizerProps {
  /** Couleur hex du titre (null = couleur du thème) */
  titleColor: string | null
  /** Couleur hex de la bio (null = couleur du thème) */
  bioColor: string | null
  /** Couleur hex du texte des liens (null = couleur du thème) */
  linkColor: string | null
  /** Callback quand la couleur du titre change */
  onTitleColorChange: (color: string | null) => void
  /** Callback quand la couleur de la bio change */
  onBioColorChange: (color: string | null) => void
  /** Callback quand la couleur des liens change */
  onLinkColorChange: (color: string | null) => void
}

// ─── Sous-composant : ligne color picker ──────────────────────────────────────

/**
 * Ligne individuelle avec un label, un input color et un bouton reset.
 *
 * @param label    - Libellé affiché (ex: "Titre", "Bio", "Liens")
 * @param color    - Couleur hex actuelle (null = thème par défaut)
 * @param onChange - Callback de changement de couleur
 */
function ColorPickerRow({
  label,
  color,
  onChange,
}: {
  label: string
  color: string | null
  onChange: (color: string | null) => void
}): React.JSX.Element {
  return (
    <div className="flex items-center gap-2 sm:gap-3 min-w-0">
      {/* Label descriptif */}
      <Label className="w-16 text-sm shrink-0">{label}</Label>

      {/* Input color natif — affiche la couleur actuelle ou #000000 par défaut */}
      <input
        type="color"
        value={color ?? '#000000'}
        onChange={(e) => onChange(e.target.value)}
        className="size-8 cursor-pointer rounded border border-input bg-transparent p-0.5"
        title={`Couleur du ${label.toLowerCase()}`}
      />

      {/* Indicateur : couleur personnalisée ou thème par défaut */}
      <span className="text-xs text-muted-foreground flex-1">
        {color ? color.toUpperCase() : 'Thème'}
      </span>

      {/* Bouton reset : remet la couleur à null (hérite du thème) */}
      {color && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7 shrink-0"
          onClick={() => onChange(null)}
          title="Réinitialiser (couleur du thème)"
        >
          <RotateCcw className="size-3.5" />
        </Button>
      )}
    </div>
  )
}

// ─── Composant principal ──────────────────────────────────────────────────────

/**
 * Section de personnalisation des couleurs dans l'éditeur Bio Link.
 * Affiche 3 color pickers (titre, bio, liens) avec bouton reset individuel.
 *
 * @param titleColor         - Couleur actuelle du titre
 * @param bioColor           - Couleur actuelle de la bio
 * @param linkColor          - Couleur actuelle des liens
 * @param onTitleColorChange - Setter couleur du titre
 * @param onBioColorChange   - Setter couleur de la bio
 * @param onLinkColorChange  - Setter couleur des liens
 * @returns Section avec 3 lignes de color pickers
 */
export function ColorCustomizer({
  titleColor,
  bioColor,
  linkColor,
  onTitleColorChange,
  onBioColorChange,
  onLinkColorChange,
}: ColorCustomizerProps): React.JSX.Element {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground">Couleurs du texte</h3>
        <p className="text-xs text-muted-foreground">
          Personnalisez les couleurs indépendamment du thème. Laissez vide pour utiliser les couleurs du thème.
        </p>
      </div>

      <div className="space-y-3">
        <ColorPickerRow
          label="Titre"
          color={titleColor}
          onChange={onTitleColorChange}
        />
        <ColorPickerRow
          label="Bio"
          color={bioColor}
          onChange={onBioColorChange}
        />
        <ColorPickerRow
          label="Liens"
          color={linkColor}
          onChange={onLinkColorChange}
        />
      </div>
    </div>
  )
}
