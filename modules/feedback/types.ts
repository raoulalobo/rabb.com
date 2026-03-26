/**
 * @file modules/feedback/types.ts
 * @module feedback
 * @description Types TypeScript du module Feedback.
 *   Définit les catégories de feedback et le type inféré depuis le schéma Zod.
 *
 * @example
 *   import type { FeedbackCategory, FeedbackFormData } from '@/modules/feedback/types'
 */

/** Catégories de feedback disponibles dans le formulaire */
export type FeedbackCategory = 'general' | 'bug' | 'feature' | 'autre'

/** Labels affichés dans le select pour chaque catégorie */
export const FEEDBACK_CATEGORIES: Record<FeedbackCategory, string> = {
  general: 'Remarque générale',
  bug: 'Signaler un bug',
  feature: 'Suggestion de fonctionnalité',
  autre: 'Autre',
} as const
