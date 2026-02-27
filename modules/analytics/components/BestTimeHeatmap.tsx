/**
 * @file modules/analytics/components/BestTimeHeatmap.tsx
 * @module analytics
 * @description Heatmap des meilleurs créneaux de publication.
 *   Grille 7 jours × 8 tranches horaires (3h chacune).
 *   L'intensité de couleur reflète l'engagement moyen pour chaque créneau.
 *   Données : BestTimeResponse via GET /v1/analytics/best-time.
 *
 * @example
 *   <BestTimeHeatmap data={bestTime} />
 */

'use client'

import { useMemo } from 'react'

import type { BestTimeResponse } from '@/modules/analytics/types'

// ─── Constantes de la grille ──────────────────────────────────────────────────

const DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
// Tranches de 3h affichées en UTC
const HOUR_LABELS = ['12am', '3am', '6am', '9am', '12pm', '3pm', '6pm', '9pm']
const HOUR_SLOTS = [0, 3, 6, 9, 12, 15, 18, 21] // heures UTC de début de chaque tranche

// ─── Props ────────────────────────────────────────────────────────────────────

interface BestTimeHeatmapProps {
  data: BestTimeResponse | undefined
}

// ─── Utilitaires ──────────────────────────────────────────────────────────────

/**
 * Classe de couleur selon l'intensité d'engagement (0=aucun, 4=max).
 */
function intensityClass(engagement: number, max: number): string {
  if (engagement === 0 || max === 0) return 'bg-muted/30'
  const ratio = engagement / max
  if (ratio < 0.2) return 'bg-emerald-900/40'
  if (ratio < 0.4) return 'bg-emerald-700/50'
  if (ratio < 0.6) return 'bg-emerald-500/60'
  if (ratio < 0.8) return 'bg-emerald-400/80'
  return 'bg-emerald-400'
}

// ─── Composant ────────────────────────────────────────────────────────────────

/**
 * Grille heatmap des meilleurs créneaux.
 * Lignes = jours de la semaine, colonnes = tranches horaires UTC.
 */
export function BestTimeHeatmap({ data }: BestTimeHeatmapProps): React.JSX.Element {
  // Indexer les slots par (dayOfWeek, heure) → engagement moyen
  const slotMap = useMemo(() => {
    const map = new Map<string, number>()
    // Garde défensive : slots peut être absent ou non-tableau
    const slots = Array.isArray(data?.slots) ? data.slots : []
    for (const slot of slots) {
      // Grouper dans la tranche de 3h correspondante
      const tranche = HOUR_SLOTS.findLastIndex((h) => slot.hour >= h)
      if (tranche >= 0) {
        const key = `${slot.dayOfWeek}-${tranche}`
        const existing = map.get(key) ?? 0
        map.set(key, Math.max(existing, slot.avgEngagement))
      }
    }
    return map
  }, [data])

  const maxEngagement = useMemo(
    () => Math.max(...slotMap.values(), 1),
    [slotMap]
  )

  if (!data || data.slots.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
        Pas assez de données pour calculer les meilleurs créneaux
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Grille : lignes = jours, colonnes = heures */}
      <div className="overflow-x-auto">
        {/* En-tête heures */}
        <div
          className="mb-1 grid"
          style={{ gridTemplateColumns: `4rem repeat(${HOUR_SLOTS.length}, 1fr)` }}
        >
          <div />
          {HOUR_LABELS.map((label) => (
            <span key={label} className="text-center text-[10px] text-muted-foreground">
              {label}
            </span>
          ))}
        </div>

        {/* Lignes par jour */}
        {DAYS.map((day, dayIndex) => (
          <div
            key={day}
            className="mb-1 grid items-center"
            style={{ gridTemplateColumns: `4rem repeat(${HOUR_SLOTS.length}, 1fr)` }}
          >
            {/* Label jour */}
            <span className="text-[11px] text-muted-foreground">{day}</span>
            {/* Cellules heure */}
            {HOUR_SLOTS.map((_, slotIndex) => {
              const key = `${dayIndex}-${slotIndex}`
              const engagement = slotMap.get(key) ?? 0
              return (
                <div
                  key={slotIndex}
                  title={
                    engagement > 0
                      ? `${day} ${HOUR_LABELS[slotIndex]} — engagement moyen: ${engagement.toFixed(1)}`
                      : `${day} ${HOUR_LABELS[slotIndex]} — aucune donnée`
                  }
                  className={`mx-0.5 h-5 rounded-[3px] transition-colors ${intensityClass(
                    engagement,
                    maxEngagement
                  )}`}
                />
              )
            })}
          </div>
        ))}
      </div>

      {/* Meilleurs créneaux en badges */}
      {data.bestTimes && data.bestTimes.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-muted-foreground">Meilleur créneau :</span>
          {data.bestTimes.map((time) => (
            <span
              key={time}
              className="rounded-full bg-emerald-500/15 px-2 py-0.5 font-medium text-emerald-500"
            >
              {time}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
