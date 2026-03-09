/**
 * @file modules/posts/components/CalendarGrid/CalendarGridSkeleton.tsx
 * @module posts
 * @description Skeleton de la grille calendrier.
 *   Reproduit fidèlement la structure du CalendarGrid responsive (style Buffer/Later) :
 *   - En-tête responsive : titre + toggle Mois/Semaine (desktop) + boutons navigation
 *   - Ligne des 7 jours de la semaine
 *   - 6 semaines × 7 jours, cellules 120px desktop / 52px mobile
 *   - Quelques chips skeleton répartis aléatoirement (distribution réaliste)
 *
 *   Deux variantes par cellule :
 *   - Mobile (< md)  : cellule compacte 52px, numéro rond + point skeleton
 *   - Desktop (≥ md) : cellule 120px, numéro + chips skeleton
 *
 * @example
 *   // Dans loading.tsx :
 *   export default function Loading() { return <CalendarGridSkeleton /> }
 */

import { Skeleton } from '@/components/ui/skeleton'

/**
 * Skeleton de la grille calendrier.
 * Simule une grille de 6 semaines avec des chips de posts factices.
 * Dimensions et structure calées sur le design Buffer/Later responsive.
 */
export function CalendarGridSkeleton(): React.JSX.Element {
  // 42 cellules (6 semaines × 7 jours)
  const cells = Array.from({ length: 42 })

  // Positions qui auront un chip skeleton (distribution réaliste)
  const chipPositions = new Set([2, 5, 8, 9, 12, 15, 16, 20, 23, 27, 30, 33, 38])

  // Positions avec 2 chips superposés (journées chargées)
  const doubleChipPositions = new Set([9, 15, 23])

  // Positions avec un point skeleton visible sur mobile (sous-ensemble de chipPositions)
  const mobilePointPositions = new Set([2, 5, 9, 15, 20, 27, 33])

  return (
    <div className="space-y-4">
      {/* ── En-tête navigation skeleton — responsive ─────────────────────── */}
      {/*
       * Mobile : titre plein largeur + boutons navigation alignés à droite.
       * Desktop : titre + toggle Mois/Semaine + navigation sur une ligne.
       */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
        {/* Titre mois */}
        <Skeleton className="h-6 w-36 flex-1 sm:h-7 sm:w-40" />

        <div className="flex items-center justify-between gap-2 sm:justify-normal sm:gap-3">
          {/* Toggle Mois / Semaine — masqué sur mobile */}
          <Skeleton className="hidden h-7 w-[120px] rounded-lg sm:block" />

          {/* Boutons ← Aujourd'hui → — taille réduite sur mobile */}
          <div className="flex items-center gap-1">
            <Skeleton className="size-7 rounded-md sm:size-8" />
            <Skeleton className="h-7 w-20 rounded-md sm:h-8 sm:w-24" />
            <Skeleton className="size-7 rounded-md sm:size-8" />
          </div>
        </div>
      </div>

      {/* ── Grille calendrier skeleton ────────────────────────────────────── */}
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        {/* En-tête des jours de la semaine */}
        <div className="grid grid-cols-7 border-b border-border">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="flex justify-center py-2.5">
              {/* Lettre unique sur mobile, abréviation 3 lettres sur desktop */}
              <Skeleton className="h-3 w-3 md:w-6" />
            </div>
          ))}
        </div>

        {/* Cellules de jours */}
        <div className="grid grid-cols-7">
          {cells.map((_, index) => {
            const hasBorderB = index < cells.length - 7
            const hasBorderR = (index + 1) % 7 !== 0
            const borderClass = [
              hasBorderB ? 'border-b border-border' : '',
              hasBorderR ? 'border-r border-border' : '',
            ].join(' ')

            return (
              <div key={index}>
                {/* ── Version mobile (< md) : ultra-compact 52px ──────── */}
                <div
                  className={`md:hidden flex min-h-[52px] flex-col items-center justify-start gap-1 p-1 ${borderClass}`}
                >
                  {/* Numéro du jour */}
                  <Skeleton className="size-5 rounded-full" />

                  {/* Point skeleton visible si cette position a des posts */}
                  {mobilePointPositions.has(index) && (
                    <Skeleton className="h-1.5 w-4 rounded-full" />
                  )}
                </div>

                {/* ── Version desktop (≥ md) : cellule 120px avec chips ── */}
                <div
                  className={`hidden md:block min-h-[100px] p-1.5 md:min-h-[120px] md:p-2 ${borderClass}`}
                >
                  {/* En-tête cellule : numéro en haut à gauche */}
                  <div className="mb-1 flex justify-start">
                    <Skeleton className="size-6 rounded-full" />
                  </div>

                  {/* Chip skeleton principal */}
                  {chipPositions.has(index) && (
                    <Skeleton className="h-6 w-full rounded" />
                  )}

                  {/* Second chip pour les journées avec 2 posts */}
                  {doubleChipPositions.has(index) && (
                    <Skeleton className="mt-0.5 h-6 w-5/6 rounded" />
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
