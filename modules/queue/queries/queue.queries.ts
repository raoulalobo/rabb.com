/**
 * @file modules/queue/queries/queue.queries.ts
 * @module queue
 * @description Clés et fetchers TanStack Query pour le module file d'attente.
 *   Les données viennent de Zernio via le proxy /api/queue.
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
  /** Liste des créneaux */
  slots: () => ['queue', 'slots'] as const,
}

// ─── Types réponse proxy ────────────────────────────────────────────────────

/** Réponse normalisée de GET /api/queue */
export interface QueueProxyResponse {
  slots: QueueSlot[]
  scheduleId: string | null
  scheduleName?: string
  timezone?: string
  active?: boolean
  nextSlots: string[]
}

// ─── Fetchers ────────────────────────────────────────────────────────────────

/**
 * Fetche les créneaux du schedule par défaut via le proxy /api/queue.
 * La réponse est déjà normalisée (slots avec hour/minute extraits de "HH:MM").
 *
 * @returns Réponse complète avec slots + métadonnées schedule
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
