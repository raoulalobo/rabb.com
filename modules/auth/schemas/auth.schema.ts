/**
 * @file modules/auth/schemas/auth.schema.ts
 * @module auth
 * @description Schémas Zod pour la validation des formulaires d'authentification.
 *   Approche schema-first : les types TypeScript sont inférés depuis Zod.
 *
 *   Règles de mot de passe :
 *   - Minimum 8 caractères
 *   - Maximum 72 caractères (limite bcrypt)
 *
 * @example
 *   const result = LoginSchema.safeParse({ email: '...', password: '...' })
 *   if (!result.success) console.log(result.error.flatten())
 */

import { z } from 'zod'

// ─── Champs réutilisables ─────────────────────────────────────────────────────

/** Validation d'email : format standard, max 254 chars (RFC 5321) */
const emailSchema = z
  .string()
  .min(1, 'Email requis')
  .email("Format d'email invalide")
  .max(254, 'Email trop long')
  .toLowerCase()

/** Validation du mot de passe : 8-72 chars (72 = limite bcrypt) */
const passwordSchema = z
  .string()
  .min(8, 'Le mot de passe doit contenir au moins 8 caractères')
  .max(72, 'Le mot de passe ne peut pas dépasser 72 caractères')

// ─── Schéma de connexion ──────────────────────────────────────────────────────

/**
 * Schéma Zod pour le formulaire de connexion.
 * Utilisé côté client (feedback immédiat) ET côté serveur (validation finale).
 */
export const LoginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Mot de passe requis'),
})

/** Type TypeScript inféré depuis LoginSchema */
export type LoginFormData = z.infer<typeof LoginSchema>

// ─── Schéma d'inscription ─────────────────────────────────────────────────────

/**
 * Schéma Zod pour le formulaire d'inscription.
 * Inclut la confirmation du mot de passe avec vérification d'égalité.
 */
export const RegisterSchema = z
  .object({
    name: z
      .string()
      .min(2, 'Le nom doit contenir au moins 2 caractères')
      .max(100, 'Le nom ne peut pas dépasser 100 caractères')
      .trim(),
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string().min(1, 'Confirmation requise'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    // L'erreur s'affiche sur le champ confirmPassword
    path: ['confirmPassword'],
    message: 'Les mots de passe ne correspondent pas',
  })

/** Type TypeScript inféré depuis RegisterSchema */
export type RegisterFormData = z.infer<typeof RegisterSchema>

// ─── Schéma de reset de mot de passe ─────────────────────────────────────────

/**
 * Schéma pour la demande de reset (étape 1 : saisie de l'email).
 */
export const ForgotPasswordSchema = z.object({
  email: emailSchema,
})

/** Type TypeScript inféré depuis ForgotPasswordSchema */
export type ForgotPasswordFormData = z.infer<typeof ForgotPasswordSchema>

/**
 * Schéma pour le nouveau mot de passe (étape 2 : lien reçu par email).
 */
export const ResetPasswordSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string().min(1, 'Confirmation requise'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Les mots de passe ne correspondent pas',
  })

/** Type TypeScript inféré depuis ResetPasswordSchema */
export type ResetPasswordFormData = z.infer<typeof ResetPasswordSchema>
