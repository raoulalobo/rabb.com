/**
 * @file app/(dashboard)/calendar/loading.tsx
 * @description Skeleton de chargement de la page /calendar.
 *   Reproduit fidèlement la mise en page de calendar/page.tsx :
 *   - En-tête (titre + description)
 *   - Légende des statuts
 *   - Grille calendrier skeleton
 */

import { Skeleton } from '@/components/ui/skeleton'
import { CalendarGridSkeleton } from '@/modules/posts/components/CalendarGrid/CalendarGridSkeleton'

/**
 * Skeleton de la page /calendar.
 */
export default function CalendarLoading(): React.JSX.Element {
  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6">
      {/* En-tête skeleton */}
      <div className="space-y-2">
        <Skeleton className="h-8 w-36" />
        <Skeleton className="h-4 w-72" />
      </div>

      {/* Légende skeleton */}
      <div className="flex gap-2">
        {[80, 64, 56, 60].map((w, i) => (
          <Skeleton key={i} className="h-5 rounded" style={{ width: w }} />
        ))}
      </div>

      {/* Grille calendrier skeleton */}
      <CalendarGridSkeleton />
    </div>
  )
}
