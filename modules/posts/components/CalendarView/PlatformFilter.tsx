/**
 * @file modules/posts/components/CalendarView/PlatformFilter.tsx
 * @module posts
 * @description Filtre multi-sélection par réseau social pour la vue Calendrier.
 *   Affiche un Popover contenant la liste des plateformes disponibles avec
 *   leur icône et couleur de marque. La sélection est persistée dans l'état
 *   parent via le callback `onChange`.
 *
 * @example
 *   <PlatformFilter
 *     selectedPlatforms={selectedPlatforms}
 *     availablePlatforms={Object.keys(PLATFORM_CONFIG)}
 *     onChange={setSelectedPlatforms}
 *   />
 */

'use client'

import { Globe } from 'lucide-react'
import Image from 'next/image'

import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { PLATFORM_CONFIG } from '@/modules/platforms/constants'

// ─── Props ────────────────────────────────────────────────────────────────────

interface PlatformFilterProps {
  /** Plateformes actuellement sélectionnées (vide = tout afficher) */
  selectedPlatforms: string[]
  /** Liste des plateformes disponibles à afficher dans le filtre */
  availablePlatforms: string[]
  /** Callback déclenché à chaque changement de sélection */
  onChange: (platforms: string[]) => void
}

// ─── Composant ────────────────────────────────────────────────────────────────

/**
 * Popover de filtre multi-sélection par plateforme sociale.
 * Affiche un badge compteur sur le bouton déclencheur si au moins une
 * plateforme est sélectionnée. Chaque item est un bouton toggle.
 *
 * @param selectedPlatforms   - Plateformes actuellement filtrées
 * @param availablePlatforms  - Plateformes disponibles dans le filtre
 * @param onChange            - Callback changement de sélection
 */
export function PlatformFilter({
  selectedPlatforms,
  availablePlatforms,
  onChange,
}: PlatformFilterProps): React.JSX.Element {
  /**
   * Bascule la sélection d'une plateforme.
   * Si déjà sélectionnée → retirer ; sinon → ajouter.
   *
   * @param platform - Identifiant de la plateforme à basculer
   */
  const togglePlatform = (platform: string): void => {
    const isSelected = selectedPlatforms.includes(platform)
    onChange(
      isSelected
        ? selectedPlatforms.filter((p) => p !== platform)
        : [...selectedPlatforms, platform],
    )
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Globe className="size-3.5" />
          <span className="hidden sm:inline">Réseaux</span>
          {/* Badge compteur — visible uniquement si au moins 1 plateforme active */}
          {selectedPlatforms.length > 0 && (
            <span className="ml-0.5 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-semibold leading-none text-primary-foreground">
              {selectedPlatforms.length}
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent align="start" className="w-56 p-4">
        <p className="mb-3 text-sm font-medium text-foreground">Filtrer par réseau</p>

        {/* Liste des plateformes disponibles */}
        <div className="flex flex-col gap-2">
          {availablePlatforms.map((platform) => {
            const config = PLATFORM_CONFIG[platform as keyof typeof PLATFORM_CONFIG]
            // Ignorer les plateformes sans configuration connue
            if (!config) return null

            const isSelected = selectedPlatforms.includes(platform)

            return (
              <button
                key={platform}
                type="button"
                onClick={() => togglePlatform(platform)}
                aria-pressed={isSelected}
                aria-label={`${isSelected ? 'Retirer le filtre' : 'Filtrer par'} ${config.label}`}
                className={[
                  'flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-all duration-150',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer',
                  isSelected
                    ? 'border-blue-400 bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                    : 'border-border bg-background text-muted-foreground hover:bg-accent/50 hover:text-foreground',
                ].join(' ')}
              >
                {/* Icône de la plateforme */}
                <Image
                  src={config.iconPath}
                  alt={config.label}
                  width={14}
                  height={14}
                  className="shrink-0"
                />
                {config.label}
              </button>
            )
          })}
        </div>

        {/* Bouton "Effacer" (plateformes uniquement) */}
        {selectedPlatforms.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="mt-3 w-full text-muted-foreground hover:text-foreground"
            onClick={() => onChange([])}
          >
            Effacer les filtres
          </Button>
        )}
      </PopoverContent>
    </Popover>
  )
}
