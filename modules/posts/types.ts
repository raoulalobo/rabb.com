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
 * Correspond au modèle Prisma Post simplifié (1 post = 1 plateforme).
 */
export interface Post {
  id: string
  userId: string
  text: string
  /** Plateforme cible unique (ex: "tiktok", "instagram") */
  platform: string
  mediaUrls: string[]
  scheduledFor: Date | null
  publishedAt: Date | null
  status: 'DRAFT' | 'SCHEDULED' | 'PUBLISHED' | 'FAILED'
  latePostId: string | null
  /** URL directe du post sur la plateforme sociale (ex: "https://tiktok.com/@handle/video/...") */
  platformPostUrl: string | null
  failureReason: string | null
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
 * Fichier en cours d'upload dans l'AgentModal.
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

// ─── Types Agent ──────────────────────────────────────────────────────────────

/**
 * Média dans le pool de l'AgentModal.
 * Un média uploadé sans destination assignée — l'agent décide où il va.
 */
export interface PoolMedia {
  /** URL publique Supabase Storage */
  url: string
  /** Type de média détecté depuis l'URL ou le MIME type */
  type: 'photo' | 'video'
  /** Nom du fichier original */
  filename: string
}

/**
 * Un post individuel tel que retourné par Claude avant persistance.
 * Produit par l'endpoint /api/agent/create-posts (via tool_use).
 * Correspond à un enregistrement Post en DB (1 post = 1 plateforme).
 *
 * @example
 *   {
 *     platform: "tiktok",
 *     text: "Découvrez nos nouvelles photos ! 🎉 #tiktok",
 *     mediaUrls: ["https://...supabase.co/storage/v1/...photo1.jpg"],
 *     scheduledFor: "2024-03-15T09:00:00.000Z"
 *   }
 */
export interface PostDraft {
  /** Plateforme cible (ex: "tiktok", "instagram") */
  platform: string
  /** Texte adapté au ton et aux contraintes de la plateforme */
  text: string
  /** URLs des médias Supabase sélectionnés pour ce post */
  mediaUrls: string[]
  /** Date de publication ISO 8601, ou null si brouillon (pas de date) */
  scheduledFor: string | null
}
