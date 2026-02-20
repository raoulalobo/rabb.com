/**
 * @file modules/platforms/components/PlatformPicker.tsx
 * @module platforms
 * @description Sélecteur de plateformes pour le PostComposer.
 *   Affiche uniquement les plateformes CONNECTÉES de l'utilisateur.
 *   Permet la sélection multiple (publier sur plusieurs réseaux en même temps).
 *
 *   Design : badges cliquables avec logo + nom, couleur de marque quand sélectionné.
 *
 * @example
 *   const [selected, setSelected] = useState<Platform[]>([])
 *   <PlatformPicker
 *     selected={selected}
 *     onChange={setSelected}
 *   />
 */

'use client'

import { Check } from 'lucide-react'

import type { LatePlatform } from '@/lib/late'
import { PLATFORM_CONFIG } from '@/modules/platforms/constants'
import { usePlatforms } from '@/modules/platforms/hooks/usePlatforms'

import { PlatformCardSkeleton } from './PlatformCardSkeleton'
import { PlatformIcon } from './PlatformIcon'

// ─── Props ────────────────────────────────────────────────────────────────────

interface PlatformPickerProps {
  /** Plateformes actuellement sélectionnées */
  selected: LatePlatform[]
  /** Callback déclenché à chaque changement de sélection */
  onChange: (platforms: LatePlatform[]) => void
  /** Désactiver toutes les interactions (ex: pendant la publication) */
  disabled?: boolean
}

// ─── Composant ────────────────────────────────────────────────────────────────

/**
 * Sélecteur de plateformes connectées pour le PostComposer.
 * Affiche seulement les plateformes que l'utilisateur a connectées.
 * Si aucune plateforme n'est connectée, affiche un message incitatif.
 *
 * @param selected - IDs des plateformes sélectionnées
 * @param onChange - Callback avec la nouvelle liste de sélection
 * @param disabled - Désactivation globale du sélecteur
 */
export function PlatformPicker({
  selected,
  onChange,
  disabled = false,
}: PlatformPickerProps): React.JSX.Element {
  const { platforms, isLoading } = usePlatforms()

  if (isLoading) {
    return <PlatformCardSkeleton count={2} />
  }

  if (platforms.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Aucune plateforme connectée.{' '}
        <a href="/settings" className="font-medium text-primary hover:underline">
          Connecte tes réseaux
        </a>{' '}
        pour commencer à publier.
      </p>
    )
  }

  /**
   * Toggle la sélection d'une plateforme.
   * Ajoute si non sélectionnée, retire si déjà sélectionnée.
   */
  const toggle = (platform: LatePlatform): void => {
    if (disabled) return

    const isSelected = selected.includes(platform)
    onChange(
      isSelected
        ? selected.filter((p) => p !== platform)
        : [...selected, platform],
    )
  }

  return (
    <div className="flex flex-wrap gap-2">
      {platforms.map((account) => {
        const platform = account.platform as LatePlatform
        const config = PLATFORM_CONFIG[platform]
        const isSelected = selected.includes(platform)

        return (
          <button
            key={account.id}
            type="button"
            onClick={() => toggle(platform)}
            disabled={disabled}
            className={[
              'flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-all duration-150',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
              isSelected
                ? 'shadow-sm'
                : 'border-border bg-background text-muted-foreground hover:border-border/80 hover:text-foreground',
            ].join(' ')}
            style={
              isSelected
                ? {
                    borderColor: config.color,
                    backgroundColor: config.bgColor,
                    color: config.color,
                  }
                : undefined
            }
            aria-pressed={isSelected}
            aria-label={`${isSelected ? 'Désélectionner' : 'Sélectionner'} ${config.label}`}
          >
            <PlatformIcon platform={platform} className="size-3.5" />
            <span>{config.label}</span>
            {/* Compte connecté affiché en plus petit */}
            <span className="opacity-60">{account.accountName}</span>
            {/* Coche si sélectionné */}
            {isSelected && <Check className="size-3 ml-0.5" />}
          </button>
        )
      })}
    </div>
  )
}
