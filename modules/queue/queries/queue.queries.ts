/**
 * @file modules/queue/queries/queue.queries.ts
 * @module queue
 * @description Clés et fetchers TanStack Query pour le module file d'attente.
 *   Les données viennent de Zernio via le proxy /api/queue.
 *   Supporte le multi-schedule (un par plateforme).
 *
 * @example
 *   import { queueQueryKeys, fetchQueueSlots } from '@/modules/queue/queries/queue.queries'
 *   useQuery({ queryKey: queueQueryKeys.slots(), queryFn: fetchQueueSlots })
 */

import type { QueueSlot } from '@/modules/queue/types'

// ─── Clés de cache TanStack Query ────────────────────────────────────────────

export const queueQueryKeys = {
  /** Clé racine du module queue */
  all: () => ['queue'] as const,
  /** Liste des créneaux (tous les schedules mergés) */
  slots: () => ['queue', 'slots'] as const,
}

// ─── Types réponse proxy ────────────────────────────────────────────────────

/** Info résumée d'un schedule retournée par le proxy */
export interface QueueScheduleInfo {
  id: string
  name: string
  platform: string
  timezone: string
  active: boolean
  slotsCount: number
}

/** Réponse normalisée de GET /api/queue */
export interface QueueProxyResponse {
  /** Tous les slots de tous les schedules (avec platform + scheduleId) */
  slots: QueueSlot[]
  /** Liste des schedules avec info résumée */
  schedules: QueueScheduleInfo[]
  /** Prochains créneaux calculés par Zernio */
  nextSlots: string[]
}

// ─── Fetchers ────────────────────────────────────────────────────────────────

/**
 * Fetche tous les schedules et leurs slots via le proxy /api/queue.
 * La réponse contient les slots de toutes les plateformes avec l'info plateforme.
 *
 * @returns Réponse complète avec slots + schedules + nextSlots
 * @throws Error si la réponse n'est pas OK
 */
export async function fetchQueueData(): Promise<QueueProxyResponse> {
  const res = await fetch('/api/queue')

  if (!res.ok) {
    throw new Error(`Erreur chargement créneaux : ${res.status} ${res.statusText}`)
  }

  return res.json() as Promise<QueueProxyResponse>
}

/**
 * Fetche uniquement les slots (raccourci pour le hook useQueueSlots).
 */
export async function fetchQueueSlots(): Promise<QueueSlot[]> {
  const data = await fetchQueueData()
  return data.slots
}
