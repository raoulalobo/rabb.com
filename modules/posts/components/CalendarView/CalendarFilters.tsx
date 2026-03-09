/**
 * @file modules/posts/components/CalendarView/CalendarFilters.tsx
 * @module posts
 * @description Toolbar de filtres pour la page /calendar.
 *   Combine deux filtres indépendants :
 *   - PlatformFilter (local)     : filtre multi-select par réseau social
 *   - StatusFilter (inline)      : filtre multi-select par statut de publication
 *
 *   Les deux filtres utilisent le même pattern : Popover avec badges toggle.
 *   Un bouton "Effacer tout" apparaît si au moins un filtre des deux est actif.
 *
 * @example
 *   <CalendarFilters
 *     selectedPlatforms={selectedPlatforms}
 *     onPlatformsChange={setSelectedPlatforms}
 *     selectedStatuses={selectedStatuses}
 *     onStatusesChange={setSelectedStatuses}
 *   />
 */

'use client'

import { CheckSquare, Filter, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { DISPLAYED_PLATFORMS } from '@/modules/platforms/constants'
import { PlatformFilter } from '@/modules/posts/components/CalendarView/PlatformFilter'
import type { PostStatus } from '@/modules/posts/types'

// ─── Configuration des statuts ────────────────────────────────────────────────

/**
 * Configuration visuelle de chaque statut de publication.
 * Définit le label FR, les classes Tailwind actives/inactives.
 */
const STATUS_CONFIG: Record<
  PostStatus,
  {
    label: string
    /** Classes appliquées quand le statut est sélectionné */
    activeClass: string
    /** Classes appliquées quand le statut n'est pas sélectionné */
    inactiveClass: string
  }
> = {
  DRAFT: {
    label: 'Brouillon',
    activeClass: 'border-gray-400 bg-gray-100 text-gray-700 dark:bg-gray-800/60 dark:text-gray-300',
    inactiveClass: 'border-border bg-background text-muted-foreground hover:bg-accent/50 hover:text-foreground',
  },
  SCHEDULED: {
    label: 'Planifié',
    activeClass: 'border-blue-400 bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    inactiveClass: 'border-border bg-background text-muted-foreground hover:bg-accent/50 hover:text-foreground',
  },
  PUBLISHED: {
    label: 'Publié',
    activeClass: 'border-green-400 bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
    inactiveClass: 'border-border bg-background text-muted-foreground hover:bg-accent/50 hover:text-foreground',
  },
  FAILED: {
    label: 'Échoué',
    activeClass: 'border-red-400 bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
    inactiveClass: 'border-border bg-background text-muted-foreground hover:bg-accent/50 hover:text-foreground',
  },
}

/** Ordre d'affichage des statuts dans le popover */
const STATUS_ORDER: PostStatus[] = ['DRAFT', 'SCHEDULED', 'PUBLISHED', 'FAILED']

// ─── Props ────────────────────────────────────────────────────────────────────

interface CalendarFiltersProps {
  /** Plateformes actuellement filtrées (vide = tout afficher) */
  selectedPlatforms: string[]
  /** Callback déclenché à chaque changement de sélection de plateformes */
  onPlatformsChange: (platforms: string[]) => void
  /** Statuts actuellement filtrés (vide = tout afficher) */
  selectedStatuses: PostStatus[]
  /** Callback déclenché à chaque changement de sélection de statuts */
  onStatusesChange: (statuses: PostStatus[]) => void
  /** true si le mode sélection multiple est actif */
  isSelectMode?: boolean
  /** Callback pour basculer le mode sélection */
  onToggleSelectMode?: () => void
}

// ─── Composant ────────────────────────────────────────────────────────────────

/**
 * Toolbar de filtres pour le calendrier.
 * Affiche deux boutons côte à côte : filtre réseau et filtre statut.
 * Un bouton "Effacer tout" apparaît si au moins un filtre des deux est actif.
 *
 * @param selectedPlatforms  - Plateformes actuellement filtrées
 * @param onPlatformsChange  - Callback changement de sélection plateformes
 * @param selectedStatuses   - Statuts actuellement filtrés
 * @param onStatusesChange   - Callback changement de sélection statuts
 */
export function CalendarFilters({
  selectedPlatforms,
  onPlatformsChange,
  selectedStatuses,
  onStatusesChange,
  isSelectMode = false,
  onToggleSelectMode,
}: CalendarFiltersProps): React.JSX.Element {
  /**
   * Seules les plateformes accessibles aux utilisateurs (DISPLAYED_PLATFORMS).
   * Exclut Bluesky, Reddit, Telegram et Google Business — non disponibles dans l'UI.
   * Synchronisé avec constants.ts : mettre à jour là-bas suffit à changer le filtre.
   */
  const allPlatforms = DISPLAYED_PLATFORMS

  /** Nombre total de filtres actifs (plateformes + statuts) */
  const totalActiveFilters = selectedPlatforms.length + selectedStatuses.length

  /**
   * Bascule la sélection d'un statut.
   * Si déjà sélectionné → le retirer ; sinon → l'ajouter.
   *
   * @param status - Statut à basculer
   */
  const toggleStatus = (status: PostStatus): void => {
    const isSelected = selectedStatuses.includes(status)
    onStatusesChange(
      isSelected
        ? selectedStatuses.filter((s) => s !== status)
        : [...selectedStatuses, status],
    )
  }

  /** Efface tous les filtres actifs (plateformes + statuts) */
  const clearAll = (): void => {
    onPlatformsChange([])
    onStatusesChange([])
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* ── Filtre par réseau social (composant réutilisé) ────────────────── */}
      {/*
       * availablePlatforms = DISPLAYED_PLATFORMS (9 réseaux accessibles dans l'UI).
       * Exclut les réseaux non disponibles (Bluesky, Reddit, Telegram, Google Business).
       */}
      <PlatformFilter
        selectedPlatforms={selectedPlatforms}
        availablePlatforms={allPlatforms}
        onChange={onPlatformsChange}
      />

      {/* ── Filtre par statut (inline dans ce composant) ─────────────────── */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1.5">
            <Filter className="size-3.5" />
            <span className="hidden sm:inline">Statut</span>
            {/* Badge compteur — visible uniquement si au moins 1 statut actif */}
            {selectedStatuses.length > 0 && (
              <span className="ml-0.5 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-semibold leading-none text-primary-foreground">
                {selectedStatuses.length}
              </span>
            )}
          </Button>
        </PopoverTrigger>

        <PopoverContent align="start" className="w-56 p-4">
          <p className="mb-3 text-sm font-medium text-foreground">Filtrer par statut</p>

          {/* Liste des 4 statuts */}
          <div className="flex flex-col gap-2">
            {STATUS_ORDER.map((status) => {
              const config = STATUS_CONFIG[status]
              const isSelected = selectedStatuses.includes(status)

              return (
                <button
                  key={status}
                  type="button"
                  onClick={() => toggleStatus(status)}
                  aria-pressed={isSelected}
                  aria-label={`${isSelected ? 'Retirer le filtre' : 'Filtrer par'} ${config.label}`}
                  className={[
                    'flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-all duration-150',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer',
                    isSelected ? config.activeClass : config.inactiveClass,
                  ].join(' ')}
                >
                  {/* Indicateur coloré selon le statut */}
                  <span
                    className={[
                      'size-2 rounded-full shrink-0',
                      status === 'DRAFT' && 'bg-gray-400',
                      status === 'SCHEDULED' && 'bg-blue-500',
                      status === 'PUBLISHED' && 'bg-green-500',
                      status === 'FAILED' && 'bg-red-500',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  />
                  {config.label}
                </button>
              )
            })}
          </div>

          {/* Bouton "Effacer" (statuts uniquement) */}
          {selectedStatuses.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="mt-3 w-full text-muted-foreground hover:text-foreground"
              onClick={() => onStatusesChange([])}
            >
              Effacer les filtres
            </Button>
          )}
        </PopoverContent>
      </Popover>

      {/* ── Bouton "Effacer tout" — visible si au moins 1 filtre actif ───── */}
      {totalActiveFilters > 0 && (
        <Button
          variant="ghost"
          size="sm"
          onClick={clearAll}
          className="gap-1 text-muted-foreground hover:text-foreground"
          aria-label="Effacer tous les filtres actifs"
        >
          <X className="size-3.5" />
          Effacer tout
          {/* Badge total des filtres actifs */}
          <span className="flex size-4 items-center justify-center rounded-full bg-muted text-[10px] font-semibold">
            {totalActiveFilters}
          </span>
        </Button>
      )}

      {/* ── Bouton mode sélection multiple ───────────────────────────────── */}
      {/*
       * Variant 'default' (rempli) quand le mode est actif pour indiquer l'état.
       * Variant 'outline' quand inactif.
       * ml-auto : pousse le bouton à droite de la barre d'outils.
       */}
      {onToggleSelectMode && (
        <Button
          variant={isSelectMode ? 'default' : 'outline'}
          size="sm"
          onClick={onToggleSelectMode}
          className="gap-1.5 sm:ml-auto"
          aria-pressed={isSelectMode}
        >
          <CheckSquare className="size-3.5" />
          {isSelectMode ? 'Annuler la sélection' : 'Sélectionner'}
        </Button>
      )}
    </div>
  )
}
