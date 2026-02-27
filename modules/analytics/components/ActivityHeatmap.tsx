/**
 * @file modules/analytics/components/ActivityHeatmap.tsx
 * @module analytics
 * @description Heatmap d'activité de publication (style GitHub contributions).
 *   Affiche une grille de 7 colonnes × N semaines où chaque cellule représente
 *   un jour. L'intensité de couleur reflète le nombre de posts publiés ce jour-là.
 *   Données : DailyMetric[].postCount via GET /v1/analytics/daily-metrics.
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

// ─── Utilitaires ──────────────────────────────────────────────────────────────

/**
 * Retourne la classe de couleur Tailwind selon l'intensité (0-4).
 * 0 = aucune activité (cellule vide), 4 = activité maximale.
 */
function intensityClass(count: number, max: number): string {
  if (count === 0) return 'bg-muted/40'
  const ratio = count / Math.max(max, 1)
  if (ratio < 0.25) return 'bg-blue-900/60'
  if (ratio < 0.5) return 'bg-blue-700/70'
  if (ratio < 0.75) return 'bg-blue-500/80'
  return 'bg-blue-400'
}

// ─── Composant ────────────────────────────────────────────────────────────────

/**
 * Grille heatmap d'activité — chaque cellule = 1 jour.
 * Défile horizontalement si > 16 semaines.
 */
export function ActivityHeatmap({ days }: ActivityHeatmapProps): React.JSX.Element {
  // Calcul du nombre maximum de posts sur un jour (pour normaliser l'intensité)
  // Normalisation défensive : s'assurer que days est bien un tableau
  const safeDays = Array.isArray(days) ? days : []

  const maxCount = useMemo(
    () => Math.max(...safeDays.map((d) => d.postCount), 1),
    [safeDays]
  )

  // Indexation par date pour accès rapide
  const byDate = useMemo(
    () => new Map(safeDays.map((d) => [d.date.slice(0, 10), d])),
    [safeDays]
  )

  // Construction de la grille : 7 jours × N semaines
  // On part du lundi le plus récent et on remonte
  const cells = useMemo(() => {
    const today = new Date()
    // Aligner sur le dimanche passé (fin de semaine)
    const startOffset = (today.getDay() + 6) % 7 // Jours depuis lundi
    const gridDays: Array<{ date: string; count: number } | null> = []

    // On crée une grille de 16 semaines (112 jours) + padding initial
    for (let i = 111; i >= 0; i--) {
      const d = new Date(today)
      d.setDate(today.getDate() - i)
      const dateStr = d.toISOString().slice(0, 10)
      const metric = byDate.get(dateStr)
      gridDays.push({ date: dateStr, count: metric?.postCount ?? 0 })
    }

    // Ajouter des cellules vides au début pour aligner sur le lundi
    const firstDay = gridDays[0]
    if (firstDay) {
      const firstDate = new Date(firstDay.date)
      const dayOfWeek = (firstDate.getDay() + 6) % 7 // 0=Lun
      for (let i = 0; i < dayOfWeek; i++) {
        gridDays.unshift(null)
      }
    }

    return gridDays
  }, [byDate])

  if (safeDays.length === 0) {
    return (
      <div className="flex h-24 items-center justify-center text-sm text-muted-foreground">
        Aucune donnée d'activité disponible
      </div>
    )
  }

  // Organisation GitHub-style : 7 lignes (jours) × N colonnes (semaines)
  // On regroupe les cellules par colonne de 7 (une semaine par colonne)
  const weeks: Array<Array<{ date: string; count: number } | null>> = []
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7))
  }

  return (
    <div className="overflow-x-auto">
      <div className="flex gap-0.5">
        {/* Labels des jours (colonne gauche fixe) */}
        <div className="mr-1 flex flex-col justify-around">
          {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((day, i) => (
            <span key={i} className="h-[10px] text-[9px] leading-none text-muted-foreground">
              {i % 2 === 0 ? day : ''}
            </span>
          ))}
        </div>

        {/* Colonnes semaines */}
        {weeks.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-0.5">
            {week.map((cell, di) => (
              <div
                key={di}
                title={
                  cell
                    ? `${cell.date} — ${cell.count} post${cell.count !== 1 ? 's' : ''}`
                    : ''
                }
                className={`size-[10px] rounded-[2px] transition-colors ${
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
