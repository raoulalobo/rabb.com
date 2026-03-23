/**
 * @file modules/queue/types.ts
 * @module queue
 * @description Types TypeScript du module file d'attente (queue).
 *   Re-exporte les types inférés depuis les schémas Zod.
 *   Types additionnels pour la grille de créneaux et l'état UI.
 *
 * @example
 *   import type { QueueSlot, QueueDay } from '@/modules/queue/types'
 */

export type { QueueSlotCreate, QueueSlotUpdate } from './schemas/queue.schema'

// ─── Type QueueSlot (modèle complet depuis la DB) ───────────────────────────

/**
 * Créneau horaire récurrent tel que retourné par la base de données.
 * Correspond au modèle Prisma QueueSlot.
 *
 * @example
 *   const slot: QueueSlot = {
 *     id: 'clxxx',
 *     userId: 'user_123',
 *     dayOfWeek: 1,      // Lundi
 *     hour: 9,           // 9h
 *     minute: 0,         // 00 min
 *     platform: null,    // Toutes plateformes
 *     active: true,
 *     createdAt: new Date(),
 *     updatedAt: new Date(),
 *   }
 */
export interface QueueSlot {
  id: string
  userId: string
  /** Jour de la semaine : 0 = dimanche, 1 = lundi, ..., 6 = samedi */
  dayOfWeek: number
  /** Heure (0-23) */
  hour: number
  /** Minute (0-59) */
  minute: number
  /** Plateforme ciblée (null = toutes) */
  platform: string | null
  /** Créneau actif ou désactivé */
  active: boolean
  createdAt: Date
  updatedAt: Date
}

// ─── Types UI ────────────────────────────────────────────────────────────────

/**
 * Représentation d'un jour de la semaine avec ses créneaux.
 * Utilisé par QueueGrid pour afficher la grille 7 jours.
 *
 * @example
 *   const lundi: QueueDay = {
 *     dayOfWeek: 1,
 *     label: 'Lundi',
 *     shortLabel: 'Lun',
 *     slots: [slot1, slot2],
 *   }
 */
export interface QueueDay {
  /** Index du jour : 0 = dimanche, ..., 6 = samedi */
  dayOfWeek: number
  /** Libellé complet en français (ex: "Lundi") */
  label: string
  /** Libellé court (ex: "Lun") */
  shortLabel: string
  /** Créneaux de ce jour, triés par heure croissante */
  slots: QueueSlot[]
}

/**
 * Résultat d'une Server Action CRUD sur les créneaux.
 */
export interface QueueActionResult {
  success: boolean
  slot?: QueueSlot
  error?: string
}

/**
 * Résultat de la suppression d'un créneau.
 */
export interface QueueDeleteResult {
  success: boolean
  error?: string
}
