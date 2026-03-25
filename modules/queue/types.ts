/**
 * @file modules/queue/types.ts
 * @module queue
 * @description Types TypeScript du module file d'attente (queue).
 *   Les schedules sont stockés chez Zernio (source de vérité unique).
 *   L'interface QueueSlot est normalisée depuis la structure Zernio
 *   pour consommation par le QueueGrid.
 *
 * @example
 *   import type { QueueSlot, QueueDay, ZernioSchedule } from '@/modules/queue/types'
 */

// ─── Types Zernio bruts ─────────────────────────────────────────────────────

/**
 * Slot brut tel que stocké chez Zernio dans un schedule.
 * Format compact : dayOfWeek (0-6) + time "HH:MM".
 */
export interface ZernioQueueSlot {
  dayOfWeek: number
  time: string // "HH:MM" (24h)
}

/**
 * Schedule (queue) brut tel que retourné par l'API Zernio.
 * Un schedule contient N slots récurrents.
 */
export interface ZernioSchedule {
  _id: string
  profileId: string
  name: string
  timezone: string
  slots: ZernioQueueSlot[]
  active: boolean
  isDefault: boolean
  createdAt?: string
  updatedAt?: string
}

/**
 * Réponse de GET /v1/queue/slots.
 */
export interface ZernioQueueListResponse {
  exists: boolean
  schedule: ZernioSchedule | null
  nextSlots: string[]
}

// ─── Types normalisés pour l'UI ─────────────────────────────────────────────

/**
 * Créneau horaire récurrent normalisé pour l'UI.
 * Créé par `mapZernioSlots()` à partir de la réponse Zernio.
 *
 * L'`id` est synthétique (dayOfWeek-HH:MM) car Zernio ne donne pas
 * d'ID individuel aux slots — seul le schedule a un _id.
 */
export interface QueueSlot {
  /** ID synthétique pour la clé React : "dayOfWeek-HH:MM" (ex: "1-09:00") */
  id: string
  /** Jour de la semaine : 0 = dimanche, 1 = lundi, ..., 6 = samedi */
  dayOfWeek: number
  /** Heure (0-23) */
  hour: number
  /** Minute (0-59) */
  minute: number
  /** Time au format "HH:MM" (conservé pour les appels Zernio) */
  time: string
}

/**
 * Représentation d'un jour de la semaine avec ses créneaux.
 * Utilisé par QueueGrid pour afficher la grille 7 jours.
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
  error?: string
}

// ─── Mapper Zernio → QueueSlot ──────────────────────────────────────────────

/**
 * Convertit les slots bruts Zernio en QueueSlot[] normalisés.
 * Parse le time "HH:MM" en hour + minute séparés.
 * Génère un ID synthétique "dayOfWeek-HH:MM" pour chaque slot.
 *
 * @param zernioSlots - Slots bruts du schedule Zernio
 * @returns QueueSlot[] triés par dayOfWeek puis par heure
 *
 * @example
 *   mapZernioSlots([{ dayOfWeek: 1, time: "09:00" }])
 *   // → [{ id: "1-09:00", dayOfWeek: 1, hour: 9, minute: 0, time: "09:00" }]
 */
export function mapZernioSlots(zernioSlots: ZernioQueueSlot[]): QueueSlot[] {
  return zernioSlots
    .map((s) => {
      const [hourStr, minuteStr] = s.time.split(':')
      return {
        id: `${s.dayOfWeek}-${s.time}`,
        dayOfWeek: s.dayOfWeek,
        hour: parseInt(hourStr ?? '0', 10),
        minute: parseInt(minuteStr ?? '0', 10),
        time: s.time,
      }
    })
    .sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.hour - b.hour || a.minute - b.minute)
}
