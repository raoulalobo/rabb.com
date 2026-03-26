/**
 * @file modules/feedback/schemas/feedback.schema.ts
 * @module feedback
 * @description Schéma Zod de validation pour le formulaire de feedback.
 *   Utilisé côté client (validation instantanée) et côté serveur (Server Action).
 *
 * @example
 *   const result = FeedbackSchema.safeParse({ category: 'bug', message: 'Le bouton...' })
 *   if (!result.success) console.error(result.error.issues)
 */

import { z } from 'zod'

// ─── Schéma ──────────────────────────────────────────────────────────────────

/**
 * Schéma de validation du formulaire de feedback.
 *
 * @property category - Catégorie du feedback (general, bug, feature, autre)
 * @property message  - Contenu du feedback (10 à 2000 caractères)
 */
export const FeedbackSchema = z.object({
  category: z.enum(['general', 'bug', 'feature', 'autre'], {
    required_error: 'Veuillez sélectionner une catégorie',
  }),
  message: z
    .string()
    .min(10, 'Le message doit contenir au moins 10 caractères')
    .max(2000, 'Le message ne peut pas dépasser 2000 caractères'),
})

/** Type inféré depuis le schéma Zod — utilisé par le formulaire et la Server Action */
export type FeedbackFormData = z.infer<typeof FeedbackSchema>
