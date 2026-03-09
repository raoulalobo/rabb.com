/**
 * @file app/(dashboard)/settings/loading.tsx
 * @description Skeleton de la page Paramètres.
 *   Reproduit fidèlement la structure de settings/page.tsx :
 *   en-tête + barre d'onglets + contenu du premier onglet (Réseaux sociaux).
 */

import { Skeleton } from '@/components/ui/skeleton'
import { PlatformCardSkeleton } from '@/modules/platforms/components/PlatformCardSkeleton'

/**
 * Skeleton de la page paramètres.
 * Affiché automatiquement par Next.js pendant le chargement.
 * Reproduit : titre, sous-titre, barre d'onglets, section réseaux sociaux.
 */
export default function SettingsLoading(): React.JSX.Element {
  return (
    <div className="space-y-6">
      {/* ── En-tête skeleton ── */}
      <div className="space-y-2">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-80" />
      </div>

      {/* ── Barre d'onglets skeleton ── */}
      <div className="flex gap-1 rounded-lg bg-muted p-[3px] w-fit h-10">
        <Skeleton className="h-full w-36 rounded-md" />
        <Skeleton className="h-full w-28 rounded-md" />
        <Skeleton className="h-full w-24 rounded-md" />
      </div>

      {/* ── Contenu onglet actif skeleton (Réseaux sociaux, par défaut) ── */}
      <div className="space-y-4">
        {/* En-tête de section */}
        <div className="space-y-1">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
        {/* Liste des 5 cartes plateforme */}
        <PlatformCardSkeleton count={5} />
      </div>
    </div>
  )
}
