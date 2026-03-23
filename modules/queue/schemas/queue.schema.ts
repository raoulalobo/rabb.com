/**
 * @file modules/queue/schemas/queue.schema.ts
 * @module queue
 * @description Schémas Zod pour la création et mise à jour de créneaux de file d'attente.
 *   Valide les contraintes métier :
 *   - dayOfWeek : 0-6 (dimanche à samedi)
 *   - hour : 0-23
 *   - minute : 0-59
 *   - platform : optionnel (null = toutes plateformes)
 *
 *   Utilisés côté client (validation formulaire) ET côté serveur (Server Actions).
 *
 * @example
 *   import { QueueSlotCreateSchema } from '@/modules/queue/schemas/queue.schema'
 *   const result = QueueSlotCreateSchema.safeParse({ dayOfWeek: 1, hour: 9, minute: 0 })
 */

import { z } from 'zod'

// ─── Schéma de création ─────────────────────────────────────────────────────

/**
 * Schéma de création d'un créneau de file d'attente.
 * Valide les bornes numériques et le format de la plateforme.
 *
 * @example
 *   QueueSlotCreateSchema.parse({
 *     dayOfWeek: 1,        // Lundi
 *     hour: 14,            // 14h
 *     minute: 30,          // 30 min
 *     platform: 'instagram', // Optionnel
 *   })
 */
export const QueueSlotCreateSchema = z.object({
  /** Jour de la semaine : 0 (dimanche) à 6 (samedi) */
  dayOfWeek: z
    .number()
    .int('Le jour doit être un entier')
    .min(0, 'Le jour doit être entre 0 et 6')
    .max(6, 'Le jour doit être entre 0 et 6'),

  /** Heure : 0 à 23 */
  hour: z
    .number()
    .int("L'heure doit être un entier")
    .min(0, "L'heure doit être entre 0 et 23")
    .max(23, "L'heure doit être entre 0 et 23"),

  /** Minute : 0 à 59 */
  minute: z
    .number()
    .int('La minute doit être un entier')
    .min(0, 'La minute doit être entre 0 et 59')
    .max(59, 'La minute doit être entre 0 et 59'),

  /** Plateforme ciblée (optionnel — null/undefined = toutes plateformes) */
  platform: z.string().min(1).nullable().optional().default(null),

  /** Créneau actif par défaut */
  active: z.boolean().optional().default(true),
})

export type QueueSlotCreate = z.infer<typeof QueueSlotCreateSchema>

// ─── Schéma de mise à jour ───────────────────────────────────────────────────

/**
 * Schéma de mise à jour d'un créneau existant.
 * Tous les champs sont optionnels sauf l'ID.
 *
 * @example
 *   QueueSlotUpdateSchema.parse({
 *     id: 'clxxx',
 *     hour: 10,       // Changer l'heure à 10h
 *     active: false,  // Désactiver le créneau
 *   })
 */
export const QueueSlotUpdateSchema = QueueSlotCreateSchema.partial().extend({
  /** ID du créneau à modifier */
  id: z.string().min(1, 'ID du créneau requis'),
})

export type QueueSlotUpdate = z.infer<typeof QueueSlotUpdateSchema>
