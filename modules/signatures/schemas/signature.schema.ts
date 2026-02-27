/**
 * @file modules/signatures/schemas/signature.schema.ts
 * @module signatures
 * @description Schémas Zod de validation pour les signatures.
 *   Utilisés côté client (feedback immédiat) et côté serveur (Server Actions).
 *
 *   Pattern "Schema-First" : le schéma est défini avant le composant ou l'action.
 *   Le type TypeScript est inféré depuis le schéma Zod (source de vérité unique).
 *
 * @example
 *   // Validation dans une Server Action
 *   const validated = SignatureUpsertSchema.parse(rawData)
 *
 *   // Validation côté client (react-hook-form)
 *   const form = useForm<SignatureUpsert>({
 *     resolver: zodResolver(SignatureUpsertSchema),
 *   })
 */

import { z } from 'zod'

// ─── Schéma de création / mise à jour ────────────────────────────────────────

/**
 * Schéma pour créer ou mettre à jour une signature.
 * - `id` absent → création
 * - `id` présent → mise à jour de la signature existante
 *
 * @field id       - ID de la signature (optionnel ; absent = création)
 * @field name     - Libellé court (1–50 chars)
 * @field text     - Contenu de la signature (1–500 chars)
 * @field platform - Identifiant de la plateforme ("instagram", "linkedin", etc.)
 */
export const SignatureUpsertSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, 'Le nom est requis').max(50, 'Nom trop long (max 50 caractères)'),
  text: z.string().min(1, 'Le contenu est requis').max(500, 'Signature trop longue (max 500 caractères)'),
  platform: z.string().min(1, 'La plateforme est requise'),
})

/** Type TypeScript inféré depuis SignatureUpsertSchema */
export type SignatureUpsert = z.infer<typeof SignatureUpsertSchema>
