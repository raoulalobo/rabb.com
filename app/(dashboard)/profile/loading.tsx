/**
 * @file app/(dashboard)/profile/loading.tsx
 * @description Skeleton de la page profil — affiché pendant le chargement SSR.
 *   Reproduit fidèlement la structure de ProfileForm :
 *   - Section photo de profil (avatar + bouton)
 *   - Section informations (3 champs + bouton sauvegarder)
 */

import { Skeleton } from '@/components/ui/skeleton'

/**
 * Skeleton de la page profil.
 * Épouse exactement la mise en page de ProfileForm pour éviter tout layout shift.
 */
export default function ProfileLoading(): React.JSX.Element {
  return (
    <div className="mx-auto max-w-2xl space-y-6 py-8">

      {/* En-tête */}
      <div className="space-y-2">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-72" />
      </div>

      {/* Section photo de profil */}
      <div className="rounded-xl border border-border bg-card p-6 space-y-4">
        <div className="space-y-1">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-56" />
        </div>
        <div className="flex items-center gap-5">
          {/* Avatar */}
          <Skeleton className="size-20 rounded-full shrink-0" />
          {/* Bouton */}
          <Skeleton className="h-8 w-36" />
        </div>
      </div>

      {/* Section informations */}
      <div className="rounded-xl border border-border bg-card p-6 space-y-6">
        <div className="space-y-1">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-3 w-64" />
        </div>

        {/* Champ nom */}
        <div className="space-y-1.5">
          <Skeleton className="h-3.5 w-24" />
          <Skeleton className="h-9 w-full" />
        </div>

        {/* Champ email */}
        <div className="space-y-1.5">
          <Skeleton className="h-3.5 w-28" />
          <Skeleton className="h-9 w-full" />
        </div>

        {/* Champ description */}
        <div className="space-y-1.5">
          <Skeleton className="h-3.5 w-20" />
          <Skeleton className="h-24 w-full" />
        </div>
      </div>

      {/* Footer bouton */}
      <div className="flex justify-end">
        <Skeleton className="h-9 w-32" />
      </div>
    </div>
  )
}
