/**
 * @file modules/queue/types.ts
 * @module queue
 * @description Types TypeScript du module file d'attente (queue).
 *   Les schedules sont stockés chez Zernio (source de vérité unique).
 *   Chaque plateforme a son propre schedule (convention de nommage "queue:<platform>").
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
 * Convention de nommage : "queue:<platform>" (ex: "queue:linkedin").
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
 * Réponse de GET /v1/queue/slots (schedule unique).
 */
export interface ZernioQueueListResponse {
  exists: boolean
  schedule: ZernioSchedule | null
  nextSlots: string[]
}

/**
 * Réponse de GET /v1/queue/slots?all=true (tous les schedules).
 */
export interface ZernioQueueListAllResponse {
  exists: boolean
  schedules: ZernioSchedule[]
  nextSlots: string[]
}

// ─── Types normalisés pour l'UI ─────────────────────────────────────────────

/**
 * Créneau horaire récurrent normalisé pour l'UI.
 * Créé par `mapZernioSlots()` à partir de la réponse Zernio.
 *
 * L'`id` est synthétique (platform-dayOfWeek-HH:MM) car Zernio ne donne pas
 * d'ID individuel aux slots — seul le schedule a un _id.
 */
export interface QueueSlot {
  /** ID synthétique pour la clé React : "platform-dayOfWeek-HH:MM" (ex: "linkedin-1-09:00") */
  id: string
  /** Jour de la semaine : 0 = dimanche, 1 = lundi, ..., 6 = samedi */
  dayOfWeek: number
  /** Heure (0-23) */
  hour: number
  /** Minute (0-59) */
  minute: number
  /** Time au format "HH:MM" (conservé pour les appels Zernio) */
  time: string
  /** Plateforme associée au créneau (extraite du nom du schedule "queue:<platform>") */
  platform: string
  /** ID du schedule Zernio contenant ce slot */
  scheduleId: string
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

// ─── Helpers convention de nommage schedule ←→ plateforme ───────────────────

/** Préfixe des noms de schedule par plateforme */
const QUEUE_NAME_PREFIX = 'queue:'

/**
 * Extrait le nom de la plateforme depuis le nom du schedule Zernio.
 * Convention : "queue:linkedin" → "linkedin".
 * Si le nom ne suit pas la convention → retourne "global" (ancien format).
 *
 * @param scheduleName - Nom du schedule Zernio
 * @returns Nom de la plateforme ou "global"
 */
export function platformFromScheduleName(scheduleName: string): string {
  if (scheduleName.startsWith(QUEUE_NAME_PREFIX)) {
    return scheduleName.slice(QUEUE_NAME_PREFIX.length)
  }
  return 'global'
}

/**
 * Génère le nom du schedule Zernio pour une plateforme donnée.
 *
 * @param platform - Nom de la plateforme (ex: "linkedin")
 * @returns Nom du schedule (ex: "queue:linkedin")
 */
export function scheduleNameForPlatform(platform: string): string {
  return `${QUEUE_NAME_PREFIX}${platform}`
}

// ─── Mapper Zernio → QueueSlot ──────────────────────────────────────────────

/**
 * Convertit les slots bruts d'un schedule Zernio en QueueSlot[] normalisés.
 * Parse le time "HH:MM" en hour + minute séparés.
 * Génère un ID synthétique "platform-dayOfWeek-HH:MM" pour chaque slot.
 *
 * @param zernioSlots - Slots bruts du schedule Zernio
 * @param platform - Plateforme associée (extraite du nom du schedule)
 * @param scheduleId - ID du schedule Zernio contenant les slots
 * @returns QueueSlot[] triés par dayOfWeek puis par heure
 *
 * @example
 *   mapZernioSlots([{ dayOfWeek: 1, time: "09:00" }], 'linkedin', 'sched_123')
 *   // → [{ id: "linkedin-1-09:00", dayOfWeek: 1, hour: 9, minute: 0, time: "09:00", platform: "linkedin", scheduleId: "sched_123" }]
 */
export function mapZernioSlots(
  zernioSlots: ZernioQueueSlot[],
  platform: string = 'global',
  scheduleId: string = '',
): QueueSlot[] {
  return zernioSlots
    .map((s) => {
      const [hourStr, minuteStr] = s.time.split(':')
      return {
        id: `${platform}-${s.dayOfWeek}-${s.time}`,
        dayOfWeek: s.dayOfWeek,
        hour: parseInt(hourStr ?? '0', 10),
        minute: parseInt(minuteStr ?? '0', 10),
        time: s.time,
        platform,
        scheduleId,
      }
    })
    .sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.hour - b.hour || a.minute - b.minute)
}
