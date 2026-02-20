/**
 * @file modules/platforms/components/PlatformCardSkeleton.tsx
 * @module platforms
 * @description Skeleton de PlatformCard — même layout, dimensions identiques.
 *   Utilisé pendant le chargement de usePlatforms (TanStack Query).
 *
 * @example
 *   {isLoading && <PlatformCardSkeleton count={4} />}
 */

import { Skeleton } from '@/components/ui/skeleton'

interface PlatformCardSkeletonProps {
  /** Nombre de cartes skeleton à afficher (défaut : 4 plateformes prioritaires) */
  count?: number
}

/**
 * Skeleton d'une liste de PlatformCard.
 * Reproduit fidèlement la structure et les dimensions des vraies cartes.
 *
 * @param count - Nombre de cartes à afficher
 */
export function PlatformCardSkeleton({ count = 4 }: PlatformCardSkeletonProps): React.JSX.Element {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 rounded-xl border border-border/60 bg-muted/30 p-4"
        >
          {/* Icône de la plateforme */}
          <Skeleton className="size-12 shrink-0 rounded-xl" />

          {/* Infos : nom + description */}
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-3 w-40" />
          </div>

          {/* Bouton action */}
          <Skeleton className="h-8 w-24 shrink-0 rounded-md" />
        </div>
      ))}
    </div>
  )
}
