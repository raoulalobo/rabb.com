/**
 * @file modules/posts/schemas/post.schema.ts
 * @module posts
 * @description Schémas Zod pour la création et mise à jour de posts.
 *   Modèle simplifié : 1 post = 1 plateforme (platform string au lieu de platforms[]).
 *
 *   Utilisés côté client (validation react-hook-form en temps réel)
 *   ET côté serveur (Server Actions save-post, routes API agent).
 *
 * @example
 *   import { PostCreateSchema } from '@/modules/posts/schemas/post.schema'
 *   const result = PostCreateSchema.safeParse({ text: 'Hello', platform: 'instagram' })
 */

import { z } from 'zod'

// ─── Limites par plateforme ───────────────────────────────────────────────────

/**
 * Nombre maximum de caractères autorisés par plateforme.
 * Utilisé pour valider le texte avant envoi à l'API.
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
 * Limite de caractères d'une plateforme spécifique.
 * Retourne la limite de la plateforme, ou 63206 (max Facebook) si inconnue.
 *
 * @param platform - Identifiant de la plateforme (ex: "tiktok")
 * @returns Limite de caractères de la plateforme
 *
 * @example
 *   getCharLimit('twitter') // 280
 *   getCharLimit('instagram') // 2200
 */
export function getCharLimit(platform: string): number {
  return PLATFORM_CHAR_LIMITS[platform] ?? 63206
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
 * Schéma de création d'un post simplifié (1 post = 1 plateforme).
 * Valide le texte, la plateforme cible, les médias et la date de planification.
 *
 * @example
 *   PostCreateSchema.parse({
 *     platform: 'tiktok',
 *     text: 'Mon post TikTok 🎵',
 *     mediaUrls: ['https://...'],
 *     scheduledFor: new Date('2024-03-15T09:00:00'),
 *   })
 */
export const PostCreateSchema = z.object({
  /** Plateforme cible unique (ex: "tiktok", "instagram") */
  platform: z.string().min(1, 'La plateforme est requise'),

  /** Contenu textuel du post (max 63 206 — limite Facebook la plus permissive) */
  text: z
    .string()
    .min(1, 'Le texte est requis')
    .max(63206, 'Le texte dépasse la limite maximale'),

  /** URLs des médias uploadés sur Supabase Storage */
  mediaUrls: z.array(z.string().url()).max(35).optional().default([]),

  /**
   * Date de planification (doit être dans le futur si définie).
   * undefined = enregistrer comme DRAFT (pas de date de publication).
   */
  scheduledFor: z
    .date()
    .refine((date) => date > new Date(), {
      message: 'La date de planification doit être dans le futur',
    })
    .optional(),

  /** Statut initial du post */
  status: PostStatusEnum.default('DRAFT'),
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
