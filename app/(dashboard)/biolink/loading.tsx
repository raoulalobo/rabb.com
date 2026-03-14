/**
 * @file app/(dashboard)/biolink/loading.tsx
 * @module biolink
 * @description Skeleton de chargement pour la page /biolink.
 *   Activé automatiquement par Next.js via le Suspense natif (convention loading.tsx).
 *   Reproduit fidèlement la structure de l'éditeur Bio Link :
 *   - En-tête (titre + boutons)
 *   - Séparateur
 *   - Split view : formulaire (3 sections) + aperçu mobile
 *
 *   Règle : même layout, mêmes proportions, animation pulse via <Skeleton>.
 */

import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'

// ─── Composant ────────────────────────────────────────────────────────────────

/**
 * Skeleton de la page /biolink.
 * Même structure que BioPageEditor (en-tête + split view).
 */
export default function BioLinkLoading(): React.JSX.Element {
  return (
    <div className="space-y-6">
      {/* ── En-tête skeleton ───────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-28" />
        </div>
      </div>

      <Separator className="opacity-50" />

      {/* ── Split view skeleton ────────────────────────────────────────── */}
      <div className="grid gap-8 lg:grid-cols-[1fr_auto]">
        {/* Colonne gauche : formulaire */}
        <div className="space-y-8 max-w-xl">
          {/* Section profil */}
          <div className="space-y-4">
            <Skeleton className="h-5 w-16" />
            <div className="space-y-3">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-4 w-10" />
              <Skeleton className="h-20 w-full" />
            </div>
          </div>

          <Separator className="opacity-50" />

          {/* Section liens */}
          <div className="space-y-4">
            <Skeleton className="h-5 w-24" />
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-2 rounded-lg border p-3">
                <Skeleton className="size-4 shrink-0" />
                <Skeleton className="size-6 shrink-0 rounded" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
                <Skeleton className="size-8" />
                <Skeleton className="size-8" />
              </div>
            ))}
            <Skeleton className="h-9 w-full" />
          </div>

          <Separator className="opacity-50" />

          {/* Section thème */}
          <div className="space-y-4">
            <Skeleton className="h-5 w-16" />
            <div className="grid grid-cols-5 gap-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full rounded-lg" />
              ))}
            </div>
          </div>
        </div>

        {/* Colonne droite : aperçu */}
        <div className="hidden lg:block">
          <div className="space-y-3">
            <Skeleton className="h-5 w-16 mx-auto" />
            <Skeleton className="h-[520px] w-[320px] rounded-2xl" />
            <Skeleton className="h-3 w-40 mx-auto" />
          </div>
        </div>
      </div>
    </div>
  )
}
