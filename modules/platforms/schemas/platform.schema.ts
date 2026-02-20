/**
 * @file modules/platforms/schemas/platform.schema.ts
 * @module platforms
 * @description Schémas Zod pour la validation des données de plateformes sociales.
 *   Utilisés côté client et serveur (Server Actions, Route Handlers).
 *
 * @example
 *   import { ConnectPlatformSchema, ConnectedPlatformSchema } from '@/modules/platforms/schemas/platform.schema'
 *   const valid = ConnectPlatformSchema.parse({ platform: 'instagram' })
 */

import { z } from 'zod'

// ─── Enum des plateformes ──────────────────────────────────────────────────────

/**
 * Toutes les plateformes supportées par getlate.dev.
 * L'ordre reflète la priorité UI (Instagram → TikTok → YouTube → Facebook en premier).
 */
export const PlatformEnum = z.enum([
  // Plateformes prioritaires MVP
  'instagram',
  'tiktok',
  'youtube',
  'facebook',
  // Plateformes secondaires
  'twitter',
  'linkedin',
  'bluesky',
  'threads',
  'reddit',
  'pinterest',
  'telegram',
  'snapchat',
  'google_business',
])

export type Platform = z.infer<typeof PlatformEnum>

// ─── Schémas de validation ─────────────────────────────────────────────────────

/**
 * Schéma de la requête de connexion d'une plateforme.
 * Reçu par la Server Action connectPlatform.
 */
export const ConnectPlatformSchema = z.object({
  platform: PlatformEnum,
})

export type ConnectPlatformData = z.infer<typeof ConnectPlatformSchema>

/**
 * Schéma d'une plateforme connectée telle que stockée en base de données.
 * Correspond au modèle Prisma ConnectedPlatform.
 */
export const ConnectedPlatformSchema = z.object({
  id: z.string(),
  userId: z.string(),
  platform: PlatformEnum,
  /** ID du profil getlate.dev correspondant */
  lateProfileId: z.string(),
  accountName: z.string(),
  avatarUrl: z.string().url().optional(),
  isActive: z.boolean(),
  connectedAt: z.date(),
})

export type ConnectedPlatformData = z.infer<typeof ConnectedPlatformSchema>

/**
 * Schéma de la réponse API `/api/platforms` (GET list).
 * Version allégée sans userId (pas nécessaire côté client).
 */
export const PlatformListItemSchema = ConnectedPlatformSchema.omit({ userId: true })

export type PlatformListItem = z.infer<typeof PlatformListItemSchema>

/**
 * Schéma de la requête de déconnexion d'une plateforme.
 * Reçu par la Server Action disconnectPlatform.
 */
export const DisconnectPlatformSchema = z.object({
  connectedPlatformId: z.string().min(1, 'ID de plateforme requis'),
})

export type DisconnectPlatformData = z.infer<typeof DisconnectPlatformSchema>
