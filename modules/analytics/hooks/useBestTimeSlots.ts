/**
 * @file modules/analytics/hooks/useBestTimeSlots.ts
 * @module analytics
 * @description Hook léger pour récupérer les top 3 créneaux de publication.
 *   Utilisé par PostComposer/Schedule pour suggérer les meilleurs moments.
 *   Cache long (24h) car les créneaux optimaux changent rarement.
 *
 *   Retourne les créneaux sous forme de { dayOfWeek, hour, label } triés par engagement.
 *
 * @example
 *   const { slots, isLoading } = useBestTimeSlots()
 *   // slots = [{ dayOfWeek: 2, hour: 14, label: 'Mer 14h' }, ...]
 */

import { useQuery } from '@tanstack/react-query'

import { analyticsKeys, fetchBestTime } from '@/modules/analytics/queries/analytics.queries'

// ─── Types ───────────────────────────────────────────────────────────────────

/** Créneau recommandé avec label lisible en français */
export interface RecommendedSlot {
  /** Jour de la semaine : 0=Lundi ... 6=Dimanche */
  dayOfWeek: number
  /** Heure UTC (0-23) */
  hour: number
  /** Label lisible en français (ex: "Mer 14h") */
  label: string
  /** Score d'engagement moyen */
  avgEngagement: number
}

// ─── Labels jours en français ────────────────────────────────────────────────

const DAY_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

/**
 * Formate un créneau en label français.
 * @param dayOfWeek - 0=Lundi..6=Dimanche
 * @param hour - 0-23 UTC
 * @returns Label ex: "Mer 14h"
 */
function formatSlotLabel(dayOfWeek: number, hour: number): string {
  const day = DAY_LABELS[dayOfWeek] ?? '?'
  return `${day} ${hour}h`
}

// ─── Hook ────────────────────────────────────────────────────────────────────

/**
 * Récupère les top 3 créneaux de publication depuis l'API analytics.
 * Cache 24h, pas de retry (dégradation gracieuse si l'API ne répond pas).
 *
 * @param limit - Nombre de créneaux à retourner (défaut: 3)
 * @returns { slots, isLoading }
 */
export function useBestTimeSlots(limit = 3): {
  slots: RecommendedSlot[]
  isLoading: boolean
} {
  const { data, isPending } = useQuery({
    queryKey: analyticsKeys.bestTime({}),
    queryFn: () => fetchBestTime({}),
    staleTime: 24 * 60 * 60 * 1000, // 24h
    retry: 0,
  })

  // Trier par engagement décroissant et prendre les top N
  const slots: RecommendedSlot[] = (data?.slots ?? [])
    .filter((s) => s.postCount > 0)
    .sort((a, b) => b.avgEngagement - a.avgEngagement)
    .slice(0, limit)
    .map((s) => ({
      dayOfWeek: s.dayOfWeek,
      hour: s.hour,
      label: formatSlotLabel(s.dayOfWeek, s.hour),
      avgEngagement: s.avgEngagement,
    }))

  return { slots, isLoading: isPending }
}

// ─── Helpers pour le PostComposer ─────────────────────────────────────────────

/**
 * Calcule la prochaine occurrence d'un créneau (jour + heure) à partir de maintenant.
 * Si le créneau est déjà passé cette semaine, retourne celui de la semaine prochaine.
 *
 * @param dayOfWeek - Jour cible (0=Lundi..6=Dimanche)
 * @param hour - Heure cible (0-23)
 * @returns Date de la prochaine occurrence
 *
 * @example
 *   // Si on est mercredi 15h et le créneau est mercredi 14h → retourne mercredi prochain 14h
 *   // Si on est mercredi 12h et le créneau est mercredi 14h → retourne aujourd'hui 14h
 *   getNextOccurrence(2, 14) // 2 = mercredi
 */
export function getNextOccurrence(dayOfWeek: number, hour: number): Date {
  const now = new Date()

  // Convertir dayOfWeek (0=Lun..6=Dim) vers JS Date (0=Dim, 1=Lun..6=Sam)
  const jsDayTarget = dayOfWeek === 6 ? 0 : dayOfWeek + 1

  const result = new Date(now)
  result.setHours(hour, 0, 0, 0)

  // Calculer les jours à ajouter
  const currentJsDay = now.getDay()
  let daysToAdd = jsDayTarget - currentJsDay
  if (daysToAdd < 0) {
    daysToAdd += 7
  } else if (daysToAdd === 0 && result <= now) {
    // Même jour mais heure passée → semaine prochaine
    daysToAdd = 7
  }

  result.setDate(result.getDate() + daysToAdd)
  return result
}
