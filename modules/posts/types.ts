/**
 * @file modules/posts/types.ts
 * @module posts
 * @description Types TypeScript du module posts.
 *   Re-exporte les types inférés depuis les schémas Zod.
 *   Types additionnels pour les états UI et les réponses d'API.
 *
 * @example
 *   import type { Post, PostCreate, PostStatus } from '@/modules/posts/types'
 */

export type { PostCreate, PostUpdate, PostStatus } from './schemas/post.schema'

// ─── Type Post (modèle complet depuis la DB) ──────────────────────────────────

/**
 * Post complet tel que retourné par la base de données.
 * Correspond au modèle Prisma Post.
 */
export interface Post {
  id: string
  userId: string
  text: string
  platforms: string[]
  mediaUrls: string[]
  scheduledFor: Date | null
  publishedAt: Date | null
  status: 'DRAFT' | 'SCHEDULED' | 'PUBLISHED' | 'FAILED'
  latePostId: string | null
  createdAt: Date
  updatedAt: Date
}

// ─── Types UI ─────────────────────────────────────────────────────────────────

/**
 * Résultat d'une Server Action de création/mise à jour de post.
 */
export interface SavePostResult {
  success: boolean
  post?: Post
  error?: string
}

/**
 * Résultat de la génération d'un presigned URL d'upload.
 */
export interface UploadUrlResult {
  /** URL signée pour l'upload direct vers Supabase Storage (valide 60s) */
  signedUrl: string
  /** URL publique permanente du fichier après upload */
  publicUrl: string
  /** Chemin du fichier dans le bucket Supabase Storage */
  path: string
}

/**
 * Fichier en cours d'upload dans PostComposer.MediaUpload.
 * Combine les données du fichier avec l'état de progression.
 */
export interface UploadingFile {
  /** ID unique temporaire pour la gestion de l'état */
  id: string
  /** Fichier local sélectionné par l'utilisateur */
  file: File
  /** Progression de l'upload (0-100) */
  progress: number
  /** URL publique disponible après upload complet */
  publicUrl?: string
  /** Erreur d'upload si applicable */
  error?: string
}
