/**
 * @file modules/queue/hooks/useQueueSlots.ts
 * @module queue
 * @description Hook TanStack Query pour charger les créneaux de file d'attente.
 *   Retourne les créneaux groupés par jour de la semaine pour la grille QueueGrid.
 *
 * @example
 *   const { days, isLoading } = useQueueSlots()
 *   // days : QueueDay[] (7 jours avec leurs créneaux triés par heure)
 */

'use client'

import { useQuery } from '@tanstack/react-query'

import { fetchQueueSlots, queueQueryKeys } from '@/modules/queue/queries/queue.queries'
import type { QueueDay, QueueSlot } from '@/modules/queue/types'

// ─── Constantes ──────────────────────────────────────────────────────────────

/**
 * Libellés des jours de la semaine en français.
 * Index 0 = dimanche (convention JavaScript Date.getDay()).
 */
const DAY_LABELS: { label: string; shortLabel: string }[] = [
  { label: 'Dimanche', shortLabel: 'Dim' },
  { label: 'Lundi', shortLabel: 'Lun' },
  { label: 'Mardi', shortLabel: 'Mar' },
  { label: 'Mercredi', shortLabel: 'Mer' },
  { label: 'Jeudi', shortLabel: 'Jeu' },
  { label: 'Vendredi', shortLabel: 'Ven' },
  { label: 'Samedi', shortLabel: 'Sam' },
]

// ─── Types ───────────────────────────────────────────────────────────────────

interface UseQueueSlotsReturn {
  /** Liste des 7 jours avec leurs créneaux, en commençant par lundi */
  days: QueueDay[]
  /** Tous les créneaux bruts (non groupés) */
  slots: QueueSlot[]
  /** Vrai pendant le premier chargement */
  isLoading: boolean
  /** Erreur éventuelle */
  error: Error | null
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Groupe les créneaux par jour de la semaine et les trie par heure croissante.
 * Retourne toujours 7 jours (lundi → dimanche), même si certains n'ont pas de créneaux.
 *
 * @param slots - Créneaux bruts depuis l'API
 * @returns 7 QueueDay triés lundi (1) → dimanche (0)
 *
 * @example
 *   const days = groupSlotsByDay(slots)
 *   // days[0] = { dayOfWeek: 1, label: 'Lundi', slots: [...] }
 *   // days[6] = { dayOfWeek: 0, label: 'Dimanche', slots: [...] }
 */
function groupSlotsByDay(slots: QueueSlot[]): QueueDay[] {
  // Ordre d'affichage : lundi (1) → dimanche (0)
  const orderedDays = [1, 2, 3, 4, 5, 6, 0]

  return orderedDays.map((dayIndex) => {
    const daySlots = slots
      .filter((s) => s.dayOfWeek === dayIndex)
      // Tri par heure puis minute croissante
      .sort((a, b) => a.hour * 60 + a.minute - (b.hour * 60 + b.minute))

    return {
      dayOfWeek: dayIndex,
      label: DAY_LABELS[dayIndex].label,
      shortLabel: DAY_LABELS[dayIndex].shortLabel,
      slots: daySlots,
    }
  })
}

// ─── Hook ────────────────────────────────────────────────────────────────────

/**
 * Hook TanStack Query pour les créneaux de file d'attente.
 * Met en cache les résultats pendant 5 minutes.
 *
 * @returns Créneaux groupés par jour + état de chargement
 *
 * @example
 *   const { days, isLoading } = useQueueSlots()
 *
 *   // Accéder aux créneaux du lundi :
 *   const lundiSlots = days[0].slots // days[0] = lundi
 */
export function useQueueSlots(): UseQueueSlotsReturn {
  const { data, isLoading, error } = useQuery({
    queryKey: queueQueryKeys.slots(),
    queryFn: fetchQueueSlots,
    // Cache de 5 minutes : les créneaux changent rarement
    staleTime: 5 * 60 * 1000,
  })

  const slots = data ?? []
  const days = groupSlotsByDay(slots)

  return {
    days,
    slots,
    isLoading,
    error: error as Error | null,
  }
}
