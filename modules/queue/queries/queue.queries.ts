/**
 * @file modules/queue/queries/queue.queries.ts
 * @module queue
 * @description Clés et fetchers TanStack Query pour le module file d'attente.
 *   Centralise la définition des queryKeys pour la cohérence du cache.
 *
 * @example
 *   import { queueQueryKeys, fetchQueueSlots } from '@/modules/queue/queries/queue.queries'
 *   useQuery({ queryKey: queueQueryKeys.all(), queryFn: fetchQueueSlots })
 */

import type { QueueSlot } from '@/modules/queue/types'

// ─── Clés de cache TanStack Query ────────────────────────────────────────────

/**
 * Hiérarchie de clés pour le module queue.
 * Structure : ['queue'] → ['queue', 'slots']
 *
 * Permet l'invalidation sélective :
 * - Tous les créneaux : invalidate(['queue'])
 * - Liste des créneaux : invalidate(['queue', 'slots'])
 */
export const queueQueryKeys = {
  /** Clé racine du module queue */
  all: () => ['queue'] as const,

  /** Liste de tous les créneaux de l'utilisateur */
  slots: () => ['queue', 'slots'] as const,
}

// ─── Fetchers ────────────────────────────────────────────────────────────────

/**
 * Fetche tous les créneaux de file d'attente de l'utilisateur connecté.
 * Appelle GET /api/queue.
 *
 * @returns Liste des créneaux triés par jour et heure
 * @throws Error si la réponse n'est pas OK
 *
 * @example
 *   const slots = await fetchQueueSlots()
 *   // → [{ id: 'clxxx', dayOfWeek: 1, hour: 9, minute: 0, ... }, ...]
 */
export async function fetchQueueSlots(): Promise<QueueSlot[]> {
  const res = await fetch('/api/queue')

  if (!res.ok) {
    throw new Error(`Erreur chargement créneaux : ${res.status} ${res.statusText}`)
  }

  const data = (await res.json()) as { slots: QueueSlot[] }

  // Désérialiser les dates JSON (string → Date)
  return data.slots.map((slot) => ({
    ...slot,
    createdAt: new Date(slot.createdAt as unknown as string),
    updatedAt: new Date(slot.updatedAt as unknown as string),
  }))
}
