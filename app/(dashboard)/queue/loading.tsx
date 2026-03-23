/**
 * @file app/(dashboard)/queue/loading.tsx
 * @description Skeleton de la page File d'attente (chargement SSR).
 *
 *   Activé automatiquement par Next.js App Router via le Suspense natif.
 *   Reproduit fidèlement la structure de queue/page.tsx :
 *   - En-tête : titre + description
 *   - Info résumé : icône + texte
 *   - Grille 7 jours : 7 colonnes avec 2 créneaux placeholder + bouton ajouter
 *
 * @see app/(dashboard)/queue/page.tsx
 */

import { Skeleton } from '@/components/ui/skeleton'

/**
 * Skeleton de la page File d'attente.
 * Reproduit la disposition complète : header, résumé, grille 7 jours.
 * Chaque colonne simule un jour avec 2 créneaux et un bouton d'ajout.
 */
export default function QueueLoading(): React.JSX.Element {
  return (
    <div className="space-y-6">
      {/* ── Skeleton en-tête ─────────────────────────────────────────────── */}
      <div className="space-y-2">
        <Skeleton className="h-7 w-44" />
        <Skeleton className="h-4 w-[420px] max-w-full" />
      </div>

      {/* ── Skeleton info résumé ──────────────────────────────────────────── */}
      <div className="flex items-center gap-2">
        <Skeleton className="size-4 rounded" />
        <Skeleton className="h-4 w-72" />
      </div>

      {/* ── Skeleton grille 7 jours ───────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-7">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="rounded-lg border bg-card p-4 space-y-3">
            {/* En-tête du jour : nom + badge count */}
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-5 w-12 rounded-full" />
            </div>

            {/* 2 créneaux placeholder (même hauteur qu'un vrai créneau) */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 rounded-md border p-2">
                <Skeleton className="size-3.5 rounded" />
                <Skeleton className="h-4 w-12" />
                <div className="flex-1" />
                <Skeleton className="h-4 w-16 rounded-full" />
              </div>
              <div className="flex items-center gap-2 rounded-md border p-2">
                <Skeleton className="size-3.5 rounded" />
                <Skeleton className="h-4 w-12" />
                <div className="flex-1" />
              </div>
            </div>

            {/* Bouton ajouter (même apparence que le vrai bouton dashed) */}
            <Skeleton className="h-8 w-full rounded-md" />
          </div>
        ))}
      </div>
    </div>
  )
}
