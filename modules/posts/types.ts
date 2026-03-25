/**
 * @file modules/posts/types.ts
 * @module posts
 * @description Types TypeScript du module posts.
 *   Les posts sont stockés chez Zernio (source de vérité unique).
 *   L'interface `Post` est une vue normalisée de la réponse Zernio
 *   pour consommation côté client (calendrier, PostComposer, etc.).
 *
 * @example
 *   import type { Post, PostStatus, ZernioRawPost } from '@/modules/posts/types'
 */

export type { PostCreate, PostStatus } from './schemas/post.schema'
export type { PlatformOverrides, PlatformOverrideItem } from './schemas/platform-overrides.schema'
export type { ContentType } from './schemas/content-type.schema'

// ─── Type Post (normalisé depuis Zernio) ────────────────────────────────────────

/**
 * Statuts possibles d'un post Zernio.
 * - draft     : brouillon non planifié
 * - scheduled : planifié pour publication future
 * - published : publié avec succès
 * - partial   : certaines plateformes OK, d'autres KO (multi-plateformes)
 * - failed    : échec de publication
 */
export type ZernioPostStatus = 'draft' | 'scheduled' | 'published' | 'partial' | 'failed'

/**
 * Média tel que retourné par l'API Zernio dans `mediaItems[]`.
 */
export interface ZernioMediaItem {
  type: 'image' | 'video' | 'document'
  url: string
  filename?: string
  mimeType?: string
  _id?: string
}

/**
 * Résultat de publication par plateforme dans `platforms[]`.
 * Contient le statut, l'URL du post publié, et les erreurs éventuelles.
 */
export interface ZernioPlatformResult {
  platform: string
  accountId: string | { _id: string; username: string; displayName: string; isActive: boolean; profilePicture?: string; platform: string; profileId: string }
  profileId?: string
  status: 'pending' | 'published' | 'failed'
  platformPostUrl?: string
  platformPostId?: string
  publishedAt?: string
  errorMessage?: string
  errorCode?: string
  errorCategory?: string
  errorSource?: string
  customContent?: string
  customMedia?: ZernioMediaItem[]
  scheduledFor?: string
  platformSpecificData?: Record<string, unknown>
  publishAttempts?: number
  _id?: string
}

/**
 * Post brut tel que retourné par l'API Zernio (GET /v1/posts ou POST /v1/posts).
 * Structure MongoDB — champs nommés _id, snake_case, etc.
 */
export interface ZernioRawPost {
  _id: string
  userId: string | { _id: string; name: string; email: string }
  title?: string
  content: string
  mediaItems: ZernioMediaItem[]
  platforms: ZernioPlatformResult[]
  scheduledFor?: string | null
  timezone?: string
  status: ZernioPostStatus
  tags?: string[]
  hashtags?: string[]
  mentions?: string[]
  visibility?: string
  contentHash?: string
  publishAttempts?: number
  createdAt: string
  updatedAt: string
}

/**
 * Post normalisé pour consommation côté client (calendrier, PostComposer, filtres).
 * Créé par `mapZernioPost()` à partir de `ZernioRawPost`.
 *
 * Convention : 1 post = 1 plateforme (platforms[0] est la plateforme cible).
 */
export interface Post {
  /** ID Zernio du post (MongoDB ObjectId) */
  id: string
  /** Texte du post */
  text: string
  /** Plateforme cible unique (ex: "tiktok", "instagram") */
  platform: string
  /** URLs des médias (extraites de mediaItems[].url) */
  mediaUrls: string[]
  /** Médias bruts Zernio (type, url, filename, mimeType) pour un mapping plus riche */
  mediaItems: ZernioMediaItem[]
  /** Contenu custom pour cette plateforme (extrait de platforms[0].customContent) */
  customContent: string | null
  /** Médias custom pour cette plateforme (extrait de platforms[0].customMedia) */
  customMedia: ZernioMediaItem[]
  /** Données spécifiques à la plateforme (contentType, threadItems, tiktokSettings, etc.) */
  platformSpecificData: Record<string, unknown>
  /** Statut normalisé (UPPERCASE pour compatibilité UI existante) */
  status: 'DRAFT' | 'SCHEDULED' | 'PUBLISHED' | 'PARTIAL' | 'FAILED'
  /** Date de publication planifiée (null si brouillon) */
  scheduledFor: Date | null
  /** Date effective de publication (null si pas encore publié) */
  publishedAt: Date | null
  /** URL directe du post sur la plateforme sociale */
  platformPostUrl: string | null
  /** Message d'erreur si status === FAILED */
  failureReason: string | null
  /** Catégorie d'erreur Zernio (user_content, account, platform) */
  errorCategory: string | null
  /** Date de création */
  createdAt: Date
  /** Date de mise à jour */
  updatedAt: Date
}

// ─── Mapper Zernio → Post ────────────────────────────────────────────────────────

/**
 * Mappe le statut Zernio (lowercase) vers le statut UI (UPPERCASE).
 */
function mapStatus(status: ZernioPostStatus): Post['status'] {
  const mapping: Record<ZernioPostStatus, Post['status']> = {
    draft: 'DRAFT',
    scheduled: 'SCHEDULED',
    published: 'PUBLISHED',
    partial: 'PARTIAL',
    failed: 'FAILED',
  }
  return mapping[status] ?? 'DRAFT'
}

/**
 * Normalise un post brut Zernio en interface Post pour le client.
 * Extrait les données de platforms[0] (convention 1 post = 1 plateforme).
 *
 * @param raw - Post brut de l'API Zernio
 * @returns Post normalisé pour le client
 *
 * @example
 *   const posts = zernioResponse.posts.map(mapZernioPost)
 */
export function mapZernioPost(raw: ZernioRawPost): Post {
  // Plateforme principale (convention : 1 post = 1 plateforme → platforms[0])
  const platformEntry = raw.platforms[0]

  return {
    id: raw._id,
    text: raw.content,
    platform: platformEntry?.platform ?? 'unknown',
    mediaUrls: raw.mediaItems.map((m) => m.url),
    mediaItems: raw.mediaItems,
    customContent: platformEntry?.customContent ?? null,
    customMedia: platformEntry?.customMedia ?? [],
    platformSpecificData: (platformEntry?.platformSpecificData as Record<string, unknown>) ?? {},
    status: mapStatus(raw.status),
    scheduledFor: raw.scheduledFor ? new Date(raw.scheduledFor) : null,
    publishedAt: platformEntry?.publishedAt ? new Date(platformEntry.publishedAt) : null,
    platformPostUrl: platformEntry?.platformPostUrl ?? null,
    failureReason: platformEntry?.errorMessage ?? null,
    errorCategory: platformEntry?.errorCategory ?? null,
    createdAt: new Date(raw.createdAt),
    updatedAt: new Date(raw.updatedAt),
  }
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
