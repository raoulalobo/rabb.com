/**
 * @file app/(dashboard)/analytics/loading.tsx
 * @description Skeleton de chargement de la page analytics.
 *   Reproduit fidèlement la disposition de AnalyticsPage :
 *   - En-tête + filtres
 *   - Heatmap d'activité
 *   - Graphique followers
 *   - Métriques toggles + bar chart
 *   - Répartition plateforme
 *   - Best time + Top posts (2 colonnes)
 *   - Fréquence + Content decay
 *
 *   Activé automatiquement par Next.js App Router (Suspense natif).
 */

import { Skeleton } from '@/components/ui/skeleton'

// ─── Skeleton d'une section card ─────────────────────────────────────────────

function CardSkeleton({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <Skeleton className="mb-4 h-4 w-40" />
      {children}
    </div>
  )
}

// ─── Skeleton principal ───────────────────────────────────────────────────────

/**
 * Skeleton de la page analytics — reproduit la structure réelle sans données.
 */
export default function AnalyticsLoading(): React.JSX.Element {
  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6">
      {/* ── En-tête ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-4 w-64" />
        </div>
        {/* Filtres skeleton */}
        <div className="flex gap-2">
          <Skeleton className="h-8 w-40 rounded-md" />
          <Skeleton className="h-8 w-36 rounded-md" />
          <Skeleton className="h-8 w-28 rounded-md" />
        </div>
      </div>

      {/* ── 1. Heatmap d'activité ───────────────────────────────────────── */}
      <CardSkeleton>
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: 112 }).map((_, i) => (
            <Skeleton key={i} className="aspect-square rounded-[2px]" />
          ))}
        </div>
      </CardSkeleton>

      {/* ── 2. Graphique followers ──────────────────────────────────────── */}
      <CardSkeleton>
        <Skeleton className="mb-3 h-8 w-24" />
        <Skeleton className="h-[220px] w-full rounded-lg" />
      </CardSkeleton>

      {/* ── 3. Métriques panel ──────────────────────────────────────────── */}
      <CardSkeleton>
        <div className="mb-4 grid grid-cols-4 gap-3 sm:grid-cols-8">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-[180px] w-full rounded-lg" />
      </CardSkeleton>

      {/* ── 4. Plateforme breakdown ─────────────────────────────────────── */}
      <CardSkeleton>
        <div className="space-y-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-lg" />
          ))}
        </div>
      </CardSkeleton>

      {/* ── 5. Best Time + Top Posts (2 colonnes) ───────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-2">
        <CardSkeleton>
          <div className="space-y-2">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="flex items-center gap-2">
                <Skeleton className="h-3 w-8" />
                {Array.from({ length: 8 }).map((_, j) => (
                  <Skeleton key={j} className="h-5 flex-1 rounded-[3px]" />
                ))}
              </div>
            ))}
          </div>
        </CardSkeleton>

        <CardSkeleton>
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-start gap-3">
                <Skeleton className="mt-0.5 size-5 rounded" />
                <div className="flex-1 space-y-1">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
            ))}
          </div>
        </CardSkeleton>
      </div>

      {/* ── 6. Fréquence de publication ─────────────────────────────────── */}
      <CardSkeleton>
        <div className="space-y-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-lg" />
          ))}
        </div>
      </CardSkeleton>

      {/* ── 7. Content decay ────────────────────────────────────────────── */}
      <CardSkeleton>
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-3 w-10" />
              <Skeleton className="h-5 flex-1 rounded-md" />
              <Skeleton className="h-3 w-8" />
            </div>
          ))}
        </div>
      </CardSkeleton>

      {/* ── 8. Grille posts ─────────────────────────────────────────────── */}
      <div className="rounded-xl border border-border bg-card p-5">
        <Skeleton className="mb-4 h-4 w-32" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-border p-3 space-y-3">
              <div className="flex gap-3">
                <Skeleton className="size-16 shrink-0 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
              <div className="flex gap-2">
                <Skeleton className="h-5 w-12 rounded-full" />
                <Skeleton className="h-5 w-14 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
