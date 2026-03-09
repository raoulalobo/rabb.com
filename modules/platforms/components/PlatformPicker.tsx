/**
 * @file modules/platforms/components/PlatformPicker.tsx
 * @module platforms
 * @description Sélecteur de plateformes pour le PostComposer.
 *   Affiche uniquement les plateformes CONNECTÉES de l'utilisateur.
 *   Permet la sélection multiple (publier sur plusieurs réseaux en même temps).
 *
 *   Design : cercles avatar (44px) avec photo de profil du compte + mini logo
 *   réseau en overlay bas-droite. Grayscale → couleur quand sélectionné.
 *   Tooltip natif au survol. Fallback : cercle coloré avec initiale du compte.
 *
 * @example
 *   const [selected, setSelected] = useState<Platform[]>([])
 *   <PlatformPicker
 *     selected={selected}
 *     onChange={setSelected}
 *   />
 */

'use client'

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
    /* gap-2.5 légèrement réduit pour les cercles vs les anciens badges */
    <div className="flex flex-wrap gap-2.5">
      {platforms.map((account) => {
        const platform = account.platform as LatePlatform
        const config = PLATFORM_CONFIG[platform]
        const isSelected = selected.includes(platform)

        /* Initiale de secours (sans le '@') pour le fallback avatar */
        const initial = account.accountName.replace('@', '').charAt(0).toUpperCase()

        return (
          <button
            key={account.id}
            type="button"
            onClick={() => toggle(platform)}
            disabled={disabled}
            /* Tooltip natif navigateur : "TikTok — raoulalobo" */
            title={`${config.label} — ${account.accountName}`}
            aria-pressed={isSelected}
            aria-label={`${isSelected ? 'Désélectionner' : 'Sélectionner'} ${config.label} (${account.accountName})`}
            className={[
              'relative size-11 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-all duration-150',
              disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
            ].join(' ')}
          >
            {/* ── Photo de profil ──────────────────────────────────────────────── */}
            {account.avatarUrl ? (
              /* grayscale quand non sélectionné, couleur normale quand sélectionné */
              <img
                src={account.avatarUrl}
                alt={account.accountName}
                referrerPolicy="no-referrer"
                className={[
                  'size-full rounded-full object-cover transition-all duration-200',
                  isSelected ? '' : 'grayscale',
                ].join(' ')}
              />
            ) : (
              /* Fallback initiale : gris neutre si non sélectionné, couleur de marque si sélectionné */
              isSelected ? (
                <span
                  className="flex size-full items-center justify-center rounded-full text-sm font-semibold text-white transition-all duration-200"
                  style={{ backgroundColor: config.color }}
                >
                  {initial}
                </span>
              ) : (
                <span className="flex size-full items-center justify-center rounded-full bg-muted text-sm font-semibold text-muted-foreground transition-all duration-200">
                  {initial}
                </span>
              )
            )}

            {/* ── Mini logo réseau — badge 16px absolu en bas à droite ─────────── */}
            <span className="absolute bottom-0 right-0 flex size-4 items-center justify-center rounded-full bg-background ring-1 ring-border">
              <PlatformIcon platform={platform} className="size-2.5" />
            </span>

          </button>
        )
      })}
    </div>
  )
}
