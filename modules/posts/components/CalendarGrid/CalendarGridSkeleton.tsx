/**
 * @file modules/posts/components/CalendarGrid/CalendarGridSkeleton.tsx
 * @module posts
 * @description Skeleton de la grille calendrier.
 *   Reproduit fidèlement la structure de CalendarGrid :
 *   - En-tête navigation (titre mois + boutons)
 *   - Ligne des 7 jours de la semaine
 *   - 6 semaines × 7 jours avec quelques chips skeleton aléatoires
 *
 * @example
 *   // Dans loading.tsx :
 *   export default function Loading() { return <CalendarGridSkeleton /> }
 */

import { Skeleton } from '@/components/ui/skeleton'

/**
 * Skeleton de la grille calendrier.
 * Simule une grille de 6 semaines avec des chips de posts factices.
 */
export function CalendarGridSkeleton(): React.JSX.Element {
  // 42 cellules (6 semaines × 7 jours)
  const cells = Array.from({ length: 42 })

  // Positions qui auront un chip skeleton (pour simuler une distribution réaliste)
  const chipPositions = new Set([2, 5, 8, 9, 12, 15, 16, 20, 23, 27, 30, 33, 38])

  return (
    <div className="space-y-4">
      {/* En-tête navigation skeleton */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-7 w-36" />
        <div className="flex items-center gap-1">
          <Skeleton className="size-8 rounded-md" />
          <Skeleton className="h-8 w-24 rounded-md" />
          <Skeleton className="size-8 rounded-md" />
        </div>
      </div>

      {/* Grille calendrier */}
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        {/* En-tête des jours de la semaine */}
        <div className="grid grid-cols-7 border-b border-border">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="flex justify-center py-2">
              <Skeleton className="h-3 w-6" />
            </div>
          ))}
        </div>

        {/* Cellules de jours */}
        <div className="grid grid-cols-7">
          {cells.map((_, index) => (
            <div
              key={index}
              className={[
                'min-h-[90px] p-1.5',
                index < cells.length - 7 ? 'border-b border-border' : '',
                (index + 1) % 7 !== 0 ? 'border-r border-border' : '',
              ].join(' ')}
            >
              {/* Numéro du jour */}
              <div className="mb-1 flex justify-end">
                <Skeleton className="size-6 rounded-full" />
              </div>

              {/* Chip de post skeleton (seulement certaines cellules) */}
              {chipPositions.has(index) && (
                <Skeleton className="h-4 w-full rounded" />
              )}
              {/* Quelques cellules avec 2 chips */}
              {(index === 9 || index === 15 || index === 23) && (
                <Skeleton className="mt-0.5 h-4 w-5/6 rounded" />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
