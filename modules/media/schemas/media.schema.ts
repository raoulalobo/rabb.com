/**
 * @file modules/media/schemas/media.schema.ts
 * @module media
 * @description Schémas Zod pour la validation des données du module Galerie (Media Library).
 *   Utilisés dans les Server Actions (saveMedia, createFolder, createTag, updateMedia)
 *   et côté client (MediaUploader, NewFolderDialog, TagsDialog).
 *
 * @example
 *   import { MediaSaveSchema, MediaFolderCreateSchema } from '@/modules/media/schemas/media.schema'
 *   const result = MediaSaveSchema.safeParse({ url, filename, mimeType, size })
 *   const folder = MediaFolderCreateSchema.parse({ name: 'Campagne été' })
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

/**
 * Schéma de mise à jour d'un média (déplacement de dossier, changement de tags).
 * Appelé par updateMedia().
 *
 * @example
 *   MediaUpdateSchema.parse({
 *     id: 'clx123',
 *     folderId: 'clf456',    // ou null pour retirer du dossier
 *     tagIds: ['clt789'],
 *   })
 */
export const MediaUpdateSchema = z.object({
  /** Identifiant du média à mettre à jour */
  id: z.string().min(1, "L'ID du média est requis"),
  /** ID du dossier cible — null pour retirer le média de tout dossier */
  folderId: z.string().nullable().optional(),
  /** IDs des tags à associer (remplace la liste actuelle entièrement) */
  tagIds: z.array(z.string()).optional(),
})

export type MediaUpdate = z.infer<typeof MediaUpdateSchema>

// ─── Schémas dossiers ─────────────────────────────────────────────────────────

/**
 * Schéma de création d'un dossier de galerie.
 *
 * @example
 *   MediaFolderCreateSchema.parse({ name: 'Campagne Printemps 2026' })
 */
export const MediaFolderCreateSchema = z.object({
  /** Nom du dossier — 1 à 50 caractères */
  name: z
    .string()
    .min(1, 'Le nom du dossier est requis')
    .max(50, 'Le nom du dossier ne doit pas dépasser 50 caractères'),
})

export type MediaFolderCreate = z.infer<typeof MediaFolderCreateSchema>

// ─── Schémas tags ─────────────────────────────────────────────────────────────

/**
 * Schéma de création d'un tag coloré.
 *
 * @example
 *   MediaTagCreateSchema.parse({ name: 'Été', color: '#f59e0b' })
 */
export const MediaTagCreateSchema = z.object({
  /** Nom du tag — 1 à 30 caractères */
  name: z
    .string()
    .min(1, 'Le nom du tag est requis')
    .max(30, 'Le nom du tag ne doit pas dépasser 30 caractères'),

  /** Couleur hexadécimale du badge (ex: "#6366f1") */
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, 'La couleur doit être un code hexadécimal valide (ex: #6366f1)'),
})

export type MediaTagCreate = z.infer<typeof MediaTagCreateSchema>
