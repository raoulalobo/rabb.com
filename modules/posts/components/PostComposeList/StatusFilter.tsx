/**
 * @file modules/posts/components/PostComposeList/StatusFilter.tsx
 * @module posts
 * @description Filtre multi-select par statut pour la page /compose.
 *
 *   Affiche un bouton "Statut" qui ouvre un Popover shadcn/ui.
 *   L'utilisateur peut cocher un ou plusieurs statuts simultanément
 *   (logique OR inclusif) — une sélection vide = tout afficher.
 *
 *   Les 4 statuts possibles sont fixes (DRAFT, SCHEDULED, PUBLISHED, FAILED).
 *   Chaque statut a une couleur et un fond définis dans STATUS_FILTER_CONFIG.
 *
 *   Conçu pour fonctionner en parallèle avec PlatformFilter — les deux filtres
 *   s'appliquent en AND (un post doit satisfaire les deux filtres simultanément).
 *
 * @example
 *   const [selectedStatuses, setSelectedStatuses] = useState<Post['status'][]>([])
 *
 *   <StatusFilter
 *     selectedStatuses={selectedStatuses}
 *     onChange={setSelectedStatuses}
 *   />
 */

'use client'

import { Check, Tag } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import type { Post } from '@/modules/posts/types'

// ─── Configuration des statuts ────────────────────────────────────────────────

/**
 * Ordre d'affichage des statuts dans le Popover.
 * Suit la progression naturelle du cycle de vie d'un post.
 */
const ALL_STATUSES: Post['status'][] = ['DRAFT', 'SCHEDULED', 'PUBLISHED', 'FAILED']

/**
 * Config visuelle pour chaque statut.
 * - `label`   : libellé français affiché dans le badge
 * - `color`   : couleur du texte (et de la bordure quand sélectionné)
 * - `bgColor` : couleur de fond quand le badge est sélectionné
 */
const STATUS_FILTER_CONFIG: Record<
  Post['status'],
  { label: string; color: string; bgColor: string }
> = {
  DRAFT:     { label: 'Brouillon', color: '#6B7280', bgColor: '#F3F4F6' },
  SCHEDULED: { label: 'Planifié',  color: '#2563EB', bgColor: '#EFF6FF' },
  PUBLISHED: { label: 'Publié',    color: '#16A34A', bgColor: '#F0FDF4' },
  FAILED:    { label: 'Échoué',    color: '#DC2626', bgColor: '#FEF2F2' },
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface StatusFilterProps {
  /** Statuts actuellement actifs dans le filtre (vide = tout afficher) */
  selectedStatuses: Post['status'][]
  /** Callback déclenché à chaque changement de sélection */
  onChange: (statuses: Post['status'][]) => void
}

// ─── Composant ────────────────────────────────────────────────────────────────

/**
 * Bouton "Statut" avec Popover de sélection multiple par statut de post.
 *
 * - Badge numérique sur le bouton si au moins 1 filtre actif
 * - Toggle par clic sur le badge du statut (ajout / retrait)
 * - Bouton "Effacer" visible uniquement si sélection non vide
 * - Toujours visible (contrairement à PlatformFilter qui exige ≥ 2 plateformes)
 *
 * @param selectedStatuses - Statuts actuellement filtrés
 * @param onChange - Callback avec la nouvelle liste de statuts sélectionnés
 */
export function StatusFilter({
  selectedStatuses,
  onChange,
}: StatusFilterProps): React.JSX.Element {
  /**
   * Bascule la sélection d'un statut.
   * Si déjà sélectionné → le retirer ; sinon → l'ajouter.
   *
   * @param status - Valeur du statut à basculer (ex: 'DRAFT')
   */
  const toggleStatus = (status: Post['status']): void => {
    const isSelected = selectedStatuses.includes(status)
    onChange(
      isSelected
        ? selectedStatuses.filter((s) => s !== status)
        : [...selectedStatuses, status],
    )
  }

  return (
    <Popover>
      {/* ── Bouton déclencheur ─────────────────────────────────────────────── */}
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Tag className="size-3.5" />
          Statut
          {/* Badge compteur — visible uniquement si au moins 1 filtre actif */}
          {selectedStatuses.length > 0 && (
            <span className="ml-0.5 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-semibold leading-none text-primary-foreground">
              {selectedStatuses.length}
            </span>
          )}
        </Button>
      </PopoverTrigger>

      {/* ── Contenu du popover ─────────────────────────────────────────────── */}
      <PopoverContent align="end" className="w-56 p-4">
        <p className="mb-3 text-sm font-medium text-foreground">Filtrer par statut</p>

        {/* Liste verticale des 4 statuts */}
        <div className="flex flex-col gap-2">
          {ALL_STATUSES.map((status) => {
            const config = STATUS_FILTER_CONFIG[status]
            const isSelected = selectedStatuses.includes(status)

            return (
              <button
                key={status}
                type="button"
                onClick={() => toggleStatus(status)}
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
                // Quand sélectionné : couleurs du statut via style inline
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
                {/* Libellé du statut */}
                <span className="flex-1 text-left">{config.label}</span>
                {/* Icône de coche si sélectionné */}
                {isSelected && <Check className="size-3 shrink-0" />}
              </button>
            )
          })}
        </div>

        {/* Bouton "Effacer" — visible seulement si au moins 1 filtre actif */}
        {selectedStatuses.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="mt-3 w-full text-muted-foreground hover:text-foreground"
            onClick={() => onChange([])}
          >
            Effacer
          </Button>
        )}
      </PopoverContent>
    </Popover>
  )
}
