/**
 * @file app/(dashboard)/gallery/loading.tsx
 * @description Skeleton de la page Galerie (chargement SSR).
 *
 *   Activé automatiquement par Next.js App Router via le Suspense natif.
 *   Reproduit fidèlement la structure de gallery/page.tsx :
 *   - En-tête avec titre + description
 *   - Zone d'upload (rectangle arrondi)
 *   - Grille 2×2 (mobile) / 3×3 (tablet) / 4×3 (desktop) de rectangles 4:3
 *
 * @see app/(dashboard)/gallery/page.tsx
 */

import { Skeleton } from '@/components/ui/skeleton'

/**
 * Skeleton de la page galerie.
 * Reproduit la même disposition que la grille réelle (MediaGrid + MediaCard).
 */
export default function GalleryLoading(): React.JSX.Element {
  return (
    <div className="space-y-6">
      {/* ── Skeleton en-tête ─────────────────────────────────────────────── */}
      <div className="space-y-2">
        {/* Titre */}
        <Skeleton className="h-7 w-32" />
        {/* Description */}
        <Skeleton className="h-4 w-80" />
      </div>

      {/* ── Skeleton zone d'upload ─────────────────────────────────────────── */}
      <Skeleton className="h-36 w-full rounded-lg" />

      {/* ── Skeleton grille de médias ─────────────────────────────────────── */}
      <div className="space-y-3">
        {/* Label "N médias" */}
        <Skeleton className="h-3 w-20" />

        {/* Grille 2 cols mobile, 3 tablet, 4 desktop — ratio 4:3 par carte */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {/* 8 cartes skeleton (2 lignes × 4 cols desktop) */}
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton
              key={i}
              // ratio 4:3 : padding-bottom 75% ou aspect-ratio
              className="aspect-[4/3] w-full rounded-lg"
            />
          ))}
        </div>
      </div>
    </div>
  )
}
