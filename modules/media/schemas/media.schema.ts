/**
 * @file modules/media/schemas/media.schema.ts
 * @module media
 * @description Schémas Zod pour la validation des données du module Galerie.
 *   Utilisés dans les Server Actions (saveMedia) et côté client (MediaUploader).
 *
 * @example
 *   import { MediaSaveSchema } from '@/modules/media/schemas/media.schema'
 *   const result = MediaSaveSchema.safeParse({
 *     url: 'https://....supabase.co/...',
 *     filename: 'photo.jpg',
 *     mimeType: 'image/jpeg',
 *     size: 204800,
 *   })
 */

import { z } from 'zod'

// ─── Constantes ────────────────────────────────────────────────────────────────

/** Taille maximale d'un fichier : 500 Mo en octets */
const MAX_SIZE_BYTES = 500 * 1024 * 1024

// ─── Schémas ──────────────────────────────────────────────────────────────────

/**
 * Schéma de sauvegarde des métadonnées d'un média après upload Supabase.
 * Appelé par le client via saveMedia() une fois le PUT vers Supabase réussi.
 *
 * @example
 *   MediaSaveSchema.parse({
 *     url: 'https://example.supabase.co/storage/v1/object/public/post-media/...',
 *     filename: 'video.mp4',
 *     mimeType: 'video/mp4',
 *     size: 10485760,
 *   })
 */
export const MediaSaveSchema = z.object({
  /** URL publique permanente générée par Supabase Storage */
  url: z.string().url('URL de média invalide'),

  /**
   * Nom du fichier affiché dans la galerie.
   * Le nom peut contenir des espaces et caractères accentués.
   */
  filename: z.string().min(1, 'Le nom de fichier est requis').max(255),

  /** Type MIME — doit commencer par "image/" ou "video/" */
  mimeType: z
    .string()
    .regex(/^(image|video)\//, 'Seuls les images et vidéos sont acceptés'),

  /** Taille en octets — max 500 Mo */
  size: z
    .number()
    .int('La taille doit être un entier')
    .positive('La taille doit être positive')
    .max(MAX_SIZE_BYTES, `Le fichier dépasse la limite de 500 Mo`),
})

export type MediaSave = z.infer<typeof MediaSaveSchema>

/**
 * Schéma de suppression d'un média.
 * Valide l'ID transmis à deleteMedia().
 */
export const MediaDeleteSchema = z.object({
  /** Identifiant unique du média à supprimer */
  id: z.string().min(1, "L'ID du média est requis"),
})

export type MediaDelete = z.infer<typeof MediaDeleteSchema>
