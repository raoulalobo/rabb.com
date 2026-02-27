/**
 * @file modules/analytics/components/ActivityHeatmap.tsx
 * @module analytics
 * @description Heatmap d'activité de publication (style GitHub contributions).
 *   Affiche une grille de 7 lignes (jours) × N colonnes (semaines) où chaque cellule
 *   représente un jour. L'intensité de couleur reflète le nombre de posts publiés ce jour.
 *
 *   Fenêtre dynamique : la grille commence à la date du premier post retourné par l'API
 *   (trié ASC) et se termine aujourd'hui, avec un cap à 52 semaines (364 jours).
 *   Si aucune donnée, fallback à 16 semaines.
 *
 *   Cellules fluides : chaque cellule occupe toute la largeur disponible de sa colonne
 *   (flex-1 + w-full) afin que la grille remplisse son conteneur.
 *
 *   Tooltip enrichi : survol d'une cellule avec activité → date + total + répartition
 *   par plateforme (ex: "2026-02-22 — 3 posts\ntiktok ×2 · instagram ×1").
 *
 * @example
 *   <ActivityHeatmap days={dailyMetrics.days} />
 */

'use client'

import { useMemo } from 'react'

import type { DailyMetric } from '@/modules/analytics/types'

// ─── Props ────────────────────────────────────────────────────────────────────

interface ActivityHeatmapProps {
  days: DailyMetric[]
}

// ─── Type interne de cellule ──────────────────────────────────────────────────

/** Représente une cellule de la grille avec ses données d'activité. */
interface GridCell {
  date: string
  count: number
  /** Distribution par plateforme, ex: { tiktok: 2, instagram: 1 } */
  platforms: Record<string, number>
}

// ─── Utilitaires ──────────────────────────────────────────────────────────────

/**
 * Retourne la classe de couleur Tailwind selon l'intensité (0-4).
 * 0 = aucune activité (cellule vide), 4 = activité maximale.
 *
 * @param count - Nombre de posts ce jour
 * @param max   - Nombre maximum de posts sur toute la période
 * @returns Classe CSS Tailwind de couleur
 */
function intensityClass(count: number, max: number): string {
  if (count === 0) return 'bg-muted/40'
  const ratio = count / Math.max(max, 1)
  if (ratio < 0.25) return 'bg-blue-900/60'
  if (ratio < 0.5) return 'bg-blue-700/70'
  if (ratio < 0.75) return 'bg-blue-500/80'
  return 'bg-blue-400'
}

/**
 * Construit le texte du tooltip d'une cellule.
 * Ligne 1 : date + total posts.
 * Ligne 2 : répartition par plateforme si plusieurs plateformes (optionnelle).
 *
 * @param date      - Date au format YYYY-MM-DD
 * @param count     - Nombre de posts
 * @param platforms - Distribution par plateforme
 * @returns Texte multiligne du tooltip
 *
 * @example
 *   buildTooltip('2026-02-22', 3, { tiktok: 2, instagram: 1 })
 *   // → "2026-02-22 — 3 posts\ntiktok ×2 · instagram ×1"
 *
 *   buildTooltip('2026-02-20', 1, { instagram: 1 })
 *   // → "2026-02-20 — 1 post\ninstagram ×1"
 */
function buildTooltip(
  date: string,
  count: number,
  platforms: Record<string, number>
): string {
  const total = `${date} — ${count} post${count !== 1 ? 's' : ''}`
  const breakdown = Object.entries(platforms)
    .filter(([, n]) => n > 0)
    .map(([p, n]) => `${p} ×${n}`)
    .join(' · ')
  return breakdown ? `${total}\n${breakdown}` : total
}

// ─── Composant ────────────────────────────────────────────────────────────────

/**
 * Grille heatmap d'activité — chaque cellule = 1 jour.
 * La fenêtre est dérivée de la date du premier post retourné par l'API.
 * Les cellules sont fluides et remplissent toute la largeur disponible.
 *
 * @param days - Tableau de métriques journalières (trié ASC par date)
 */
export function ActivityHeatmap({ days }: ActivityHeatmapProps): React.JSX.Element {
  // Normalisation défensive : s'assurer que days est bien un tableau
  const safeDays = Array.isArray(days) ? days : []

  // Calcul du nombre maximum de posts sur un jour (pour normaliser l'intensité des couleurs)
  const maxCount = useMemo(
    () => Math.max(...safeDays.map((d) => d.postCount), 1),
    [safeDays]
  )

  // Indexation par date (YYYY-MM-DD) pour accès O(1) lors de la construction de la grille
  const byDate = useMemo(
    () => new Map(safeDays.map((d) => [d.date.slice(0, 10), d])),
    [safeDays]
  )

  /**
   * Construction de la grille.
   *
   * Fix 1 — Fenêtre dynamique :
   *   La grille commence à la date du premier jour de données (trié ASC par l'API).
   *   Cap à 52 semaines (364 jours) pour éviter une grille trop large.
   *   Fallback à 16 semaines si safeDays est vide.
   *
   * Fix 2 — Cellules fluides :
   *   Les colonnes (semaines) utilisent flex-1 et les cellules w-full
   *   pour remplir toute la largeur disponible du conteneur.
   *
   * Fix 3 — Tooltip enrichi :
   *   Chaque cellule stocke la distribution par plateforme pour enrichir le tooltip.
   */
  const cells = useMemo(() => {
    const today = new Date()

    // Déterminer le début de la grille depuis la date du premier jour de données
    // L'API retourne les jours triés par date ASC → safeDays[0] est le plus ancien
    const rawStart =
      safeDays.length > 0
        ? new Date(safeDays[0].date)
        : (() => {
            const d = new Date(today)
            d.setDate(d.getDate() - 111) // Fallback : 16 semaines
            return d
          })()

    // Cap à 52 semaines pour éviter une grille trop large
    const maxStart = new Date(today)
    maxStart.setDate(today.getDate() - 364)
    const gridStart = rawStart < maxStart ? maxStart : rawStart

    // Nombre total de jours dans la fenêtre (de gridStart à aujourd'hui inclus)
    const totalDays =
      Math.round((today.getTime() - gridStart.getTime()) / 86_400_000) + 1

    // Construction des cellules de la grille (une par jour)
    const gridDays: Array<GridCell | null> = []
    for (let i = totalDays - 1; i >= 0; i--) {
      const d = new Date(today)
      d.setDate(today.getDate() - i)
      const dateStr = d.toISOString().slice(0, 10)
      const metric = byDate.get(dateStr)
      gridDays.push({
        date: dateStr,
        count: metric?.postCount ?? 0,
        platforms: metric?.platforms ?? {},
      })
    }

    // Padding initial : aligner le premier jour sur le lundi (index 0)
    const firstDate = new Date(gridDays[0]!.date)
    const dayOfWeek = (firstDate.getDay() + 6) % 7 // 0=Lun, 1=Mar, ..., 6=Dim
    for (let i = 0; i < dayOfWeek; i++) {
      gridDays.unshift(null)
    }

    return gridDays
  }, [safeDays, byDate])

  if (safeDays.length === 0) {
    return (
      <div className="flex h-24 items-center justify-center text-sm text-muted-foreground">
        Aucune donnée d'activité disponible
      </div>
    )
  }

  // Regroupement en semaines : 7 jours par colonne (style GitHub)
  const weeks: Array<Array<GridCell | null>> = []
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7))
  }

  return (
    <div>
      {/* Fix 2 — Suppression de overflow-x-auto : la grille s'adapte à la largeur disponible */}
      <div className="flex gap-0.5 w-full">
        {/* Labels des jours (colonne gauche fixe, alignés sur h-[10px] des cellules) */}
        <div className="mr-1 flex flex-col justify-around">
          {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((day, i) => (
            <span key={i} className="h-[10px] text-[9px] leading-none text-muted-foreground">
              {/* Afficher un label sur deux pour éviter l'encombrement */}
              {i % 2 === 0 ? day : ''}
            </span>
          ))}
        </div>

        {/* Colonnes semaines — Fix 2 : flex-1 pour que chaque colonne occupe la même largeur */}
        {weeks.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-0.5 flex-1">
            {week.map((cell, di) => (
              <div
                key={di}
                // Fix 3 — Tooltip enrichi avec répartition par plateforme
                // Cellule vide (padding) ou jour sans activité → pas de tooltip
                title={
                  cell && cell.count > 0
                    ? buildTooltip(cell.date, cell.count, cell.platforms)
                    : ''
                }
                // Fix 2 — h-[10px] w-full : hauteur fixe, largeur fluide
                className={`h-[10px] w-full rounded-[2px] transition-colors ${
                  cell ? intensityClass(cell.count, maxCount) : 'bg-transparent'
                }`}
              />
            ))}
          </div>
        ))}
      </div>

      {/* Légende */}
      <div className="mt-2 flex items-center justify-end gap-1 text-[10px] text-muted-foreground">
        <span>Moins</span>
        {[0, 1, 2, 3, 4].map((level) => (
          <div
            key={level}
            className={`size-[10px] rounded-[2px] ${intensityClass(level, 4)}`}
          />
        ))}
        <span>Plus</span>
      </div>
    </div>
  )
}
