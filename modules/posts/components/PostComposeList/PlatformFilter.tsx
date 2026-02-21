/**
 * @file modules/posts/components/PostComposeList/PlatformFilter.tsx
 * @module posts
 * @description Filtre multi-select par plateforme pour la page /compose.
 *
 *   Affiche un bouton "Filtrer" qui ouvre un Popover shadcn/ui.
 *   L'utilisateur peut cocher une ou plusieurs plateformes simultanément
 *   (logique OR inclusif) — une sélection vide = tout afficher.
 *
 *   Réutilise le pattern toggle-badge de PlatformPicker (icône + couleur de marque)
 *   et le composant PlatformIcon pour les icônes SVG.
 *
 * @example
 *   const [selected, setSelected] = useState<string[]>([])
 *   const available = ['instagram', 'tiktok', 'youtube']
 *
 *   <PlatformFilter
 *     selectedPlatforms={selected}
 *     availablePlatforms={available}
 *     onChange={setSelected}
 *   />
 */

'use client'

import { Check, SlidersHorizontal } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { PLATFORM_CONFIG } from '@/modules/platforms/constants'
import { PlatformIcon } from '@/modules/platforms/components/PlatformIcon'
import type { LatePlatform } from '@/lib/late'

// ─── Props ────────────────────────────────────────────────────────────────────

interface PlatformFilterProps {
  /** Plateformes actuellement actives dans le filtre (vide = tout afficher) */
  selectedPlatforms: string[]
  /** Plateformes présentes dans la liste courante des posts (déduites dynamiquement) */
  availablePlatforms: string[]
  /** Callback déclenché à chaque changement de sélection */
  onChange: (platforms: string[]) => void
}

// ─── Composant ────────────────────────────────────────────────────────────────

/**
 * Bouton "Filtrer" avec Popover de sélection multiple par plateforme.
 *
 * - Badge numérique sur le bouton si au moins 1 filtre actif
 * - Toggle par clic sur le badge de la plateforme (ajout / retrait)
 * - Bouton "Effacer les filtres" visible uniquement si sélection non vide
 *
 * @param selectedPlatforms - Plateformes actuellement filtrées
 * @param availablePlatforms - Plateformes disponibles dans la liste des posts
 * @param onChange - Callback avec la nouvelle liste de plateformes sélectionnées
 */
export function PlatformFilter({
  selectedPlatforms,
  availablePlatforms,
  onChange,
}: PlatformFilterProps): React.JSX.Element {
  /**
   * Bascule la sélection d'une plateforme.
   * Si elle est déjà sélectionnée → la retirer ; sinon → l'ajouter.
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
      {/* ── Bouton déclencheur ─────────────────────────────────────────────── */}
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <SlidersHorizontal className="size-3.5" />
          Filtrer
          {/* Badge compteur — visible uniquement si au moins 1 filtre actif */}
          {selectedPlatforms.length > 0 && (
            <span className="ml-0.5 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-semibold leading-none text-primary-foreground">
              {selectedPlatforms.length}
            </span>
          )}
        </Button>
      </PopoverTrigger>

      {/* ── Contenu du popover ─────────────────────────────────────────────── */}
      <PopoverContent align="end" className="w-72 p-4">
        <p className="mb-3 text-sm font-medium text-foreground">Filtrer par réseau</p>

        {/* Grille de badges — 2 colonnes */}
        <div className="grid grid-cols-2 gap-2">
          {availablePlatforms.map((platform) => {
            // Récupère la config (couleur, label) — fallback si plateforme inconnue
            const config = PLATFORM_CONFIG[platform as LatePlatform]
            const isSelected = selectedPlatforms.includes(platform)

            // Si la plateforme n'est pas dans PLATFORM_CONFIG, afficher un badge minimal
            if (!config) {
              return (
                <button
                  key={platform}
                  type="button"
                  onClick={() => togglePlatform(platform)}
                  className={[
                    'flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-all duration-150',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    'cursor-pointer',
                    isSelected
                      ? 'border-border bg-accent text-accent-foreground shadow-sm'
                      : 'border-border bg-background text-muted-foreground hover:bg-accent/50 hover:text-foreground',
                  ].join(' ')}
                  aria-pressed={isSelected}
                >
                  <span className="capitalize">{platform}</span>
                  {isSelected && <Check className="ml-auto size-3" />}
                </button>
              )
            }

            return (
              <button
                key={platform}
                type="button"
                onClick={() => togglePlatform(platform)}
                className={[
                  'flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-all duration-150',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  'cursor-pointer',
                  // Quand non sélectionné : apparence neutre avec hover subtil
                  !isSelected &&
                    'border-border bg-background text-muted-foreground hover:bg-accent/50 hover:text-foreground',
                ]
                  .filter(Boolean)
                  .join(' ')}
                // Quand sélectionné : couleurs de marque via style inline (pas de classe Tailwind dynamique)
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
                aria-label={`${isSelected ? 'Retirer le filtre' : 'Filtrer par'} ${config.label}`}
              >
                {/* Icône SVG de la plateforme */}
                <PlatformIcon platform={platform as LatePlatform} className="size-3.5 shrink-0" />
                {/* Nom affiché */}
                <span className="truncate">{config.label}</span>
                {/* Coche si sélectionné */}
                {isSelected && <Check className="ml-auto size-3 shrink-0" />}
              </button>
            )
          })}
        </div>

        {/* Bouton "Effacer" — visible seulement si au moins 1 filtre actif */}
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
