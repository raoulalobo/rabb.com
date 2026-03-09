/**
 * @file app/(dashboard)/calendar/loading.tsx
 * @description Skeleton de chargement de la page Calendrier.
 *   Reproduit fidèlement la disposition de CalendarPage :
 *   - En-tête (titre + description)
 *   - Grille calendrier (CalendarGridSkeleton)
 *
 *   Activé automatiquement par Next.js App Router (Suspense natif)
 *   pendant le rendu du Server Component CalendarPage.
 */

import { Skeleton } from '@/components/ui/skeleton'
import { CalendarGridSkeleton } from '@/modules/posts/components/CalendarGrid/CalendarGridSkeleton'

// ─── Skeleton principal ───────────────────────────────────────────────────────

/**
 * Skeleton de la page Calendrier.
 * Reproduit la structure réelle : en-tête + grille mensuelle.
 */
export default function CalendarLoading(): React.JSX.Element {
  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6">
      {/* ── En-tête skeleton ─────────────────────────────────────────── */}
      <div className="space-y-2">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-4 w-64" />
      </div>

      {/* ── Grille calendrier skeleton ───────────────────────────────── */}
      {/*
       * CalendarGridSkeleton reproduit fidèlement la structure de CalendarGrid :
       * navigation mois + ligne jours semaine + 42 cellules avec chips skeleton.
       */}
      <CalendarGridSkeleton />
    </div>
  )
}
