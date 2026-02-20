/**
 * @file app/(dashboard)/settings/loading.tsx
 * @description Skeleton de la page Settings.
 *   Reproduit fidèlement la structure de settings/page.tsx :
 *   en-tête + section réseaux (4 PlatformCardSkeleton) + section profil.
 */

import { Skeleton } from '@/components/ui/skeleton'
import { PlatformCardSkeleton } from '@/modules/platforms/components/PlatformCardSkeleton'

/**
 * Skeleton de la page paramètres.
 * Affiché automatiquement par Next.js pendant le chargement de la page.
 */
export default function SettingsLoading(): React.JSX.Element {
  return (
    <div className="mx-auto max-w-2xl space-y-10 py-8">
      {/* ── En-tête skeleton ── */}
      <div className="space-y-2">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-80" />
      </div>

      {/* ── Section réseaux sociaux skeleton ── */}
      <section className="space-y-4">
        <div className="space-y-1">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
        <PlatformCardSkeleton count={4} />
      </section>

      {/* ── Section profil skeleton ── */}
      <section className="space-y-4">
        <div className="space-y-1">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-4 w-56" />
        </div>
        <Skeleton className="h-32 w-full rounded-xl" />
      </section>
    </div>
  )
}
