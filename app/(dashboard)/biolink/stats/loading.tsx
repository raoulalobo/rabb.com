/**
 * @file app/(dashboard)/biolink/stats/loading.tsx
 * @module biolink
 * @description Skeleton de chargement pour la page /biolink/stats.
 *   Reproduit la structure : en-tête, 3 cartes métriques, graphique, tableau.
 */

import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'

export default function BioLinkStatsLoading(): React.JSX.Element {
  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex items-center gap-3">
        <Skeleton className="size-8 rounded-md" />
        <div className="space-y-2">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-4 w-64" />
        </div>
      </div>

      <Separator className="opacity-50" />

      {/* Cartes métriques */}
      <div className="grid gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-lg border p-4 space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-9 w-20" />
          </div>
        ))}
      </div>

      {/* Graphique */}
      <div className="rounded-lg border p-4 space-y-4">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-[200px] w-full" />
      </div>

      {/* Tableau */}
      <div className="rounded-lg border overflow-hidden">
        <div className="p-4 border-b">
          <Skeleton className="h-5 w-28" />
        </div>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3 border-b last:border-0">
            <Skeleton className="h-4 w-40" />
            <div className="flex-1" />
            <Skeleton className="h-4 w-12" />
            <Skeleton className="h-4 w-12" />
            <Skeleton className="h-5 w-14 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  )
}
