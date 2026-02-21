/**
 * @file modules/posts/actions/save-post.action.ts
 * @module posts
 * @description Server Actions pour la création et la mise à jour de posts.
 *   Valide les données avec Zod, vérifie la session, persiste en base de données.
 *
 *   Modèle simplifié : 1 post = 1 plateforme (platform string, pas platforms[]).
 *   Les posts sont créés individuellement par l'agent via /api/agent/create-posts.
 *
 *   Deux actions exportées :
 *   - savePost : crée un nouveau post ou met à jour un post existant (selon postId)
 *   - deletePost : supprime un post (DRAFT ou SCHEDULED uniquement)
 *
 *   La logique de publication vers getlate.dev est gérée par Inngest
 *   (lib/inngest/functions/publish-scheduled-post.ts), pas ici.
 *
 * @example
 *   // Sauvegarde d'un brouillon simple
 *   const result = await savePost({
 *     text: 'Mon post Instagram',
 *     platform: 'instagram',
 *   })
 *   if (result.success) {
 *     // result.post contient le post sauvegardé
 *   }
 */

'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PostCreateSchema, PostUpdateSchema } from '@/modules/posts/schemas/post.schema'
import type { Post, SavePostResult } from '@/modules/posts/types'

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Mappe un enregistrement Prisma vers l'interface Post du module.
 * Nécessaire car Prisma retourne des types légèrement différents (ex: enum string).
 *
 * @param record - Enregistrement Prisma brut
 * @returns Post typé pour le module
 */
function mapPrismaPost(record: {
  id: string
  userId: string
  text: string
  platform: string
  mediaUrls: string[]
  scheduledFor: Date | null
  publishedAt: Date | null
  status: string
  latePostId: string | null
  failureReason: string | null
  createdAt: Date
  updatedAt: Date
}): Post {
  return {
    id: record.id,
    userId: record.userId,
    text: record.text,
    platform: record.platform,
    mediaUrls: record.mediaUrls,
    scheduledFor: record.scheduledFor,
    publishedAt: record.publishedAt,
    status: record.status as Post['status'],
    latePostId: record.latePostId,
    failureReason: record.failureReason,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  }
}

// ─── savePost ─────────────────────────────────────────────────────────────────

/**
 * Crée un nouveau post ou met à jour un post existant.
 *
 * Logique de statut :
 * - Si scheduledFor est défini → status = 'SCHEDULED'
 * - Si status explicitement fourni → utiliser ce statut
 * - Sinon → status = 'DRAFT'
 *
 * Si rawData contient un champ "id", c'est une mise à jour (PATCH).
 * Sinon c'est une création (POST).
 *
 * @param rawData - Données brutes du formulaire (non validées)
 * @returns { success: true, post } si OK, { success: false, error } si KO
 *
 * @example
 *   // Création d'un brouillon
 *   const result = await savePost({ text: 'Mon post', platform: 'instagram' })
 *
 *   // Mise à jour d'un post existant
 *   const result = await savePost({ id: 'post_123', text: 'Texte modifié', platform: 'instagram' })
 */
export async function savePost(rawData: unknown): Promise<SavePostResult> {
  // ─── Authentification ─────────────────────────────────────────────────────
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return { success: false, error: 'Non authentifié' }
  }

  // ─── Détection : création ou mise à jour ──────────────────────────────────
  const isUpdate =
    typeof rawData === 'object' &&
    rawData !== null &&
    'id' in rawData &&
    typeof (rawData as Record<string, unknown>).id === 'string'

  if (isUpdate) {
    return updatePost(rawData, session.user.id)
  }

  return createPost(rawData, session.user.id)
}

// ─── Création ─────────────────────────────────────────────────────────────────

/**
 * Crée un nouveau post en base de données.
 *
 * @param rawData - Données brutes (validées par PostCreateSchema)
 * @param userId - ID de l'utilisateur connecté
 * @returns SavePostResult
 */
async function createPost(rawData: unknown, userId: string): Promise<SavePostResult> {
  const parsed = PostCreateSchema.safeParse(rawData)
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Données invalides',
    }
  }

  const { text, platform, mediaUrls, scheduledFor, status } = parsed.data

  // Détermination du statut final
  const finalStatus = scheduledFor ? 'SCHEDULED' : (status ?? 'DRAFT')

  try {
    const post = await prisma.post.create({
      data: {
        userId,
        text,
        platform,
        mediaUrls: mediaUrls ?? [],
        scheduledFor: scheduledFor ?? null,
        status: finalStatus,
      },
    })

    // Invalide le cache de la liste des posts
    revalidatePath('/compose')
    revalidatePath('/calendar')
    revalidatePath('/')

    return { success: true, post: mapPrismaPost(post) }
  } catch (error) {
    console.error('[savePost] Erreur création post :', error)
    return { success: false, error: 'Erreur lors de la sauvegarde' }
  }
}

// ─── Mise à jour ──────────────────────────────────────────────────────────────

/**
 * Met à jour un post existant en base de données.
 * Vérifie que le post appartient bien à l'utilisateur connecté (ownership check).
 *
 * @param rawData - Données brutes avec `id` (validées par PostUpdateSchema)
 * @param userId - ID de l'utilisateur connecté
 * @returns SavePostResult
 */
async function updatePost(rawData: unknown, userId: string): Promise<SavePostResult> {
  const parsed = PostUpdateSchema.safeParse(rawData)
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Données invalides',
    }
  }

  const { id, text, platform, mediaUrls, scheduledFor, status } = parsed.data

  // ─── Ownership check ────────────────────────────────────────────────────────
  const existingPost = await prisma.post.findUnique({
    where: { id },
    select: { userId: true, status: true },
  })

  if (!existingPost) {
    return { success: false, error: 'Post introuvable' }
  }

  if (existingPost.userId !== userId) {
    return { success: false, error: 'Post introuvable' }
  }

  // Seuls les posts DRAFT ou SCHEDULED peuvent être modifiés
  if (existingPost.status === 'PUBLISHED' || existingPost.status === 'FAILED') {
    return { success: false, error: 'Ce post ne peut plus être modifié' }
  }

  // Détermination du statut final
  const finalStatus = scheduledFor ? 'SCHEDULED' : (status ?? existingPost.status)

  try {
    const post = await prisma.post.update({
      where: { id },
      data: {
        ...(text !== undefined && { text }),
        ...(platform !== undefined && { platform }),
        ...(mediaUrls !== undefined && { mediaUrls }),
        ...(scheduledFor !== undefined && { scheduledFor }),
        status: finalStatus,
      },
    })

    revalidatePath('/compose')
    revalidatePath('/calendar')
    revalidatePath('/')

    return { success: true, post: mapPrismaPost(post) }
  } catch (error) {
    console.error('[savePost] Erreur mise à jour post :', error)
    return { success: false, error: 'Erreur lors de la sauvegarde' }
  }
}

// ─── deletePost ───────────────────────────────────────────────────────────────

/**
 * Supprime un post (DRAFT ou SCHEDULED uniquement).
 * Les posts PUBLISHED ou FAILED ne peuvent pas être supprimés via cette action.
 *
 * @param postId - ID du post à supprimer
 * @returns { success: true } si supprimé, { success: false, error } si KO
 *
 * @example
 *   const result = await deletePost('post_abc123')
 *   if (result.success) {
 *     // Post supprimé
 *   }
 */
export async function deletePost(postId: string): Promise<{ success: boolean; error?: string }> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return { success: false, error: 'Non authentifié' }
  }

  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: { userId: true, status: true },
  })

  if (!post || post.userId !== session.user.id) {
    return { success: false, error: 'Post introuvable' }
  }

  if (post.status === 'PUBLISHED' || post.status === 'FAILED') {
    return { success: false, error: 'Ce post ne peut pas être supprimé' }
  }

  try {
    await prisma.post.delete({ where: { id: postId } })

    revalidatePath('/compose')
    revalidatePath('/calendar')
    revalidatePath('/')

    return { success: true }
  } catch (error) {
    console.error('[deletePost] Erreur suppression post :', error)
    return { success: false, error: 'Erreur lors de la suppression' }
  }
}
