/**
 * @file modules/posts/schemas/post.schema.ts
 * @module posts
 * @description Schémas Zod pour la création et mise à jour de posts.
 *   Utilisés côté client (validation react-hook-form en temps réel)
 *   ET côté serveur (Server Action save-post).
 *
 * @example
 *   import { PostCreateSchema, PLATFORM_CHAR_LIMITS } from '@/modules/posts/schemas/post.schema'
 *   const result = PostCreateSchema.safeParse({ text: 'Hello', platforms: ['instagram'] })
 */

import { z } from 'zod'

import { PlatformEnum } from '@/modules/platforms/schemas/platform.schema'

// ─── Limites par plateforme ───────────────────────────────────────────────────

/**
 * Nombre maximum de caractères autorisés par plateforme.
 * Utilisé dans PostComposer.Editor pour afficher le compteur de caractères.
 */
export const PLATFORM_CHAR_LIMITS: Record<string, number> = {
  instagram: 2200,
  tiktok: 2200,
  youtube: 5000,
  facebook: 63206,
  twitter: 280,
  linkedin: 3000,
  bluesky: 300,
  threads: 500,
  reddit: 40000,
  pinterest: 500,
  telegram: 4096,
  snapchat: 250,
  google_business: 1500,
}

/**
 * Limite effective d'un post selon les plateformes sélectionnées.
 * Retourne la limite la plus restrictive parmi les plateformes choisies.
 *
 * @param platforms - Liste des plateformes sélectionnées
 * @returns Limite de caractères la plus basse (280 = Twitter si sélectionné)
 *
 * @example
 *   getEffectiveCharLimit(['instagram', 'twitter']) // 280 (twitter est le plus restrictif)
 *   getEffectiveCharLimit(['instagram', 'facebook']) // 2200 (instagram est le plus restrictif)
 */
export function getEffectiveCharLimit(platforms: string[]): number {
  if (platforms.length === 0) return 5000

  return platforms.reduce((min, platform) => {
    const limit = PLATFORM_CHAR_LIMITS[platform] ?? 5000
    return Math.min(min, limit)
  }, Infinity)
}

// ─── Schémas de validation ─────────────────────────────────────────────────────

/**
 * Statuts possibles d'un post.
 * DRAFT : brouillon non planifié
 * SCHEDULED : planifié pour publication future
 * PUBLISHED : publié avec succès
 * FAILED : publication échouée
 */
export const PostStatusEnum = z.enum(['DRAFT', 'SCHEDULED', 'PUBLISHED', 'FAILED'])
export type PostStatus = z.infer<typeof PostStatusEnum>

/**
 * Schéma d'un override de contenu pour une plateforme spécifique.
 * Permet de personnaliser le texte et les médias par canal.
 *
 * Utilisé dans PostCreateSchema.platformOverrides.
 */
export const PlatformOverrideSchema = z.object({
  /**
   * Texte spécifique à cette plateforme.
   * Max 63 206 (limite Facebook, la plus permissive).
   */
  text: z.string().max(63206, 'Le texte de la plateforme dépasse la limite maximale'),

  /**
   * URLs de médias spécifiques à cette plateforme.
   * Max 35 (limite TikTok, la plus permissive sur les photos).
   */
  mediaUrls: z.array(z.string().url()).max(35),
})

export type PlatformOverride = z.infer<typeof PlatformOverrideSchema>

/**
 * Schéma de création d'un post.
 * Valide le texte, les plateformes, les médias, la date de planification
 * et les overrides de contenu par plateforme (Phase 4).
 */
export const PostCreateSchema = z.object({
  /** Contenu textuel du post (base, utilisé par les plateformes sans override) */
  text: z
    .string()
    .min(1, 'Le texte est requis')
    .max(63206, 'Le texte dépasse la limite maximale'),

  /** Plateformes cibles (au moins une requise) */
  platforms: z
    .array(PlatformEnum)
    .min(1, 'Sélectionne au moins une plateforme'),

  /** URLs des médias de base uploadés sur Supabase Storage */
  mediaUrls: z.array(z.string().url()).max(35).optional().default([]),

  /**
   * Date de planification (doit être dans le futur si définie).
   * undefined = publier immédiatement ou enregistrer comme DRAFT.
   */
  scheduledFor: z
    .date()
    .refine((date) => date > new Date(), {
      message: 'La date de planification doit être dans le futur',
    })
    .optional(),

  /** Statut initial du post */
  status: PostStatusEnum.default('DRAFT'),

  /**
   * Contenus spécifiques par plateforme (opt-in).
   * Les plateformes absentes utilisent le contenu de base (text + mediaUrls).
   *
   * Note : on utilise z.record(z.string(), ...) au lieu de z.record(PlatformEnum, ...)
   * pour éviter les incompatibilités de typage avec `.default({})` dans Zod v4.
   * La validation des clés de plateforme est faite par la Server Action via la logique métier.
   *
   * @example
   *   platformOverrides: {
   *     twitter: { text: 'Version courte', mediaUrls: [] },
   *     instagram: { text: 'Version longue avec hashtags', mediaUrls: ['https://...'] },
   *   }
   */
  platformOverrides: z
    .record(z.string(), PlatformOverrideSchema)
    .optional()
    .default({}),
})

export type PostCreate = z.infer<typeof PostCreateSchema>

/**
 * Schéma de mise à jour d'un post existant.
 * Tous les champs sont optionnels sauf l'ID.
 */
export const PostUpdateSchema = PostCreateSchema.partial().extend({
  id: z.string().min(1, 'ID du post requis'),
})

export type PostUpdate = z.infer<typeof PostUpdateSchema>

/**
 * Schéma de validation de l'upload de média.
 * Utilisé par le Route Handler POST /api/posts/upload-url.
 */
export const MediaUploadRequestSchema = z.object({
  /** Nom du fichier (ex: "photo.jpg") */
  filename: z.string().min(1, 'Nom de fichier requis'),
  /** Type MIME — doit être image/* ou video/* */
  mimeType: z
    .string()
    .regex(/^(image|video)\//, 'Seuls les images et vidéos sont acceptées'),
  /** Taille en octets — max 500 Mo */
  size: z
    .number()
    .max(500 * 1024 * 1024, 'Le fichier dépasse la limite de 500 Mo'),
})

export type MediaUploadRequest = z.infer<typeof MediaUploadRequestSchema>
