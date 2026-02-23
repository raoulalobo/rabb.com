/**
 * @file modules/auth/schemas/profile.schema.ts
 * @module auth
 * @description Schémas Zod pour la mise à jour du profil utilisateur.
 *   Valide les données avant la Server Action update-profile.
 *
 * @example
 *   import { ProfileUpdateSchema } from '@/modules/auth/schemas/profile.schema'
 *   const result = ProfileUpdateSchema.safeParse(formData)
 */

import { z } from 'zod'

// ─── Schéma de mise à jour du profil ─────────────────────────────────────────

/**
 * Données du formulaire de profil.
 * L'email est exclu — il ne peut pas être modifié depuis ce formulaire.
 */
export const ProfileUpdateSchema = z.object({
  /** Nom complet de l'utilisateur (affiché dans l'UI et les emails) */
  name: z
    .string()
    .min(1, 'Le nom est requis')
    .max(100, 'Le nom est trop long (max 100 caractères)')
    .trim(),

  /** Bio/description publique — facultative, max 500 caractères */
  description: z
    .string()
    .max(500, 'La description est trop longue (max 500 caractères)')
    .trim()
    .optional(),
})

export type ProfileUpdateData = z.infer<typeof ProfileUpdateSchema>
