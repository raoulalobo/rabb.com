/**
 * @file app/(dashboard)/signatures/loading.tsx
 * @module signatures
 * @description Skeleton de chargement pour la page /signatures.
 *   Activé automatiquement par Next.js via le Suspense natif (convention loading.tsx).
 *   Reproduit fidèlement la structure de la page réelle :
 *   - En-tête (titre + description)
 *   - Séparateur
 *   - 3 sections plateforme avec 2 cartes chacune
 *
 *   Règle : même layout, mêmes proportions, animation pulse via <Skeleton>.
 */

import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'

// ─── Composant ────────────────────────────────────────────────────────────────

/**
 * Skeleton de la page /signatures.
 * Même structure que SignaturesPage (en-tête + sections par plateforme).
 */
export default function SignaturesLoading(): React.JSX.Element {
  return (
    <div className="container max-w-3xl py-8 space-y-8">
      {/* ── En-tête skeleton ───────────────────────────────────────────── */}
      <div className="space-y-2">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-96 max-w-full" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>

      <Separator className="opacity-0" />

      {/* ── 3 sections plateforme skeleton ─────────────────────────────── */}
      <div className="space-y-10">
        {Array.from({ length: 3 }).map((_, sectionIndex) => (
          <div key={sectionIndex} className="space-y-3">
            {/* En-tête section : icône + label plateforme */}
            <div className="flex items-center gap-2">
              <Skeleton className="size-6 rounded-sm shrink-0" />
              <Skeleton className="h-5 w-28" />
            </div>

            {/* Grille de 2 cartes de signature */}
            <div className="grid gap-2 sm:grid-cols-2">
              {Array.from({ length: 2 }).map((_, cardIndex) => (
                <div
                  key={cardIndex}
                  className="rounded-lg border bg-card p-4 space-y-3"
                >
                  {/* En-tête carte : nom + badge */}
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-4 w-28" />
                    {/* Badge "par défaut" sur la première carte */}
                    {cardIndex === 0 && <Skeleton className="h-4 w-20 rounded-full" />}
                  </div>
                  {/* Corps : 2 lignes de texte signature */}
                  <div className="space-y-1.5">
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-4/5" />
                  </div>
                </div>
              ))}
            </div>

            {/* Bouton "Ajouter une signature" skeleton */}
            <Skeleton className="h-8 w-44" />
          </div>
        ))}
      </div>
    </div>
  )
}
