/**
 * @file modules/queue/hooks/useQueueSlots.ts
 * @module queue
 * @description Hook TanStack Query pour charger les créneaux de file d'attente.
 *   Retourne les créneaux groupés par jour de la semaine pour la grille QueueGrid.
 *   Supporte le filtrage par plateforme.
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
  /** Liste des plateformes présentes dans les créneaux (pour le filtre) */
  platforms: string[]
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
 * @param slots - Créneaux depuis l'API (potentiellement filtrés par plateforme)
 * @returns 7 QueueDay triés lundi (1) → dimanche (0)
 */
function groupSlotsByDay(slots: QueueSlot[]): QueueDay[] {
  const orderedDays = [1, 2, 3, 4, 5, 6, 0]

  return orderedDays.map((dayIndex) => {
    const daySlots = slots
      .filter((s) => s.dayOfWeek === dayIndex)
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
 * Accepte un filtre optionnel par plateforme.
 *
 * @param filterPlatform - Plateforme à filtrer (null = toutes)
 * @returns Créneaux groupés par jour + plateformes uniques + état de chargement
 */
export function useQueueSlots(filterPlatform?: string | null): UseQueueSlotsReturn {
  const { data, isLoading, error } = useQuery({
    queryKey: queueQueryKeys.slots(),
    queryFn: fetchQueueSlots,
    staleTime: 5 * 60 * 1000,
  })

  const allSlots = data ?? []

  // Extraire les plateformes uniques pour le filtre UI
  const platforms = [...new Set(allSlots.map((s) => s.platform))].sort()

  // Filtrer par plateforme si demandé
  const filteredSlots = filterPlatform
    ? allSlots.filter((s) => s.platform === filterPlatform)
    : allSlots

  const days = groupSlotsByDay(filteredSlots)

  return {
    days,
    slots: filteredSlots,
    platforms,
    isLoading,
    error: error as Error | null,
  }
}
