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

      {/* ── Section dictée vocale skeleton ── */}
      <section className="space-y-4">
        <div className="space-y-1">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-64" />
        </div>
        {/* Reproduit la carte SpeechSettings : icône + texte + valeur + slider + boutons */}
        <div className="rounded-xl border border-border p-5 space-y-5">
          <div className="flex items-start gap-3">
            <Skeleton className="size-8 rounded-md shrink-0" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-3/4" />
            </div>
            <Skeleton className="h-8 w-12 shrink-0" />
          </div>
          <Skeleton className="h-2 w-full rounded-full" />
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-6 w-10 rounded-md" />
            ))}
          </div>
        </div>
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
