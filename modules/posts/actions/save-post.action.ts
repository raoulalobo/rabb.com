/**
 * @file modules/posts/actions/save-post.action.ts
 * @module posts
 * @description Server Actions pour la création et la mise à jour de posts.
 *   Valide les données avec Zod, vérifie la session, persiste en base de données.
 *
 *   Deux actions exportées :
 *   - savePost : crée un nouveau post ou met à jour un post existant (selon postId)
 *   - deletePost : supprime un post (DRAFT ou SCHEDULED uniquement)
 *
 *   La logique de publication vers getlate.dev est gérée par Inngest
 *   (lib/inngest/functions/publish-scheduled-post.ts), pas ici.
 *
 * @example
 *   // Dans PostComposer.Footer :
 *   const result = await savePost({
 *     text: 'Mon post',
 *     platforms: ['instagram', 'tiktok'],
 *     scheduledFor: new Date('2024-03-15T10:00:00'),
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
  platforms: string[]
  mediaUrls: string[]
  scheduledFor: Date | null
  publishedAt: Date | null
  status: string
  latePostId: string | null
  createdAt: Date
  updatedAt: Date
}): Post {
  return {
    id: record.id,
    userId: record.userId,
    text: record.text,
    platforms: record.platforms,
    mediaUrls: record.mediaUrls,
    scheduledFor: record.scheduledFor,
    publishedAt: record.publishedAt,
    status: record.status as Post['status'],
    latePostId: record.latePostId,
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
 * Si un postId est présent dans les données, c'est une mise à jour (PATCH).
 * Sinon c'est une création (POST).
 *
 * @param rawData - Données brutes du formulaire (non validées)
 * @returns { success: true, post } si OK, { success: false, error } si KO
 *
 * @example
 *   // Création d'un brouillon
 *   const result = await savePost({ text: 'Mon post', platforms: ['instagram'] })
 *
 *   // Planification
 *   const result = await savePost({
 *     text: 'Post planifié',
 *     platforms: ['instagram'],
 *     scheduledFor: new Date('2024-03-15T10:00:00'),
 *   })
 *
 *   // Mise à jour d'un post existant
 *   const result = await savePost({
 *     id: 'post_123',
 *     text: 'Texte modifié',
 *     platforms: ['instagram', 'tiktok'],
 *   })
 */
export async function savePost(rawData: unknown): Promise<SavePostResult> {
  // ─── Authentification ─────────────────────────────────────────────────────
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return { success: false, error: 'Non authentifié' }
  }

  // ─── Détection : création ou mise à jour ──────────────────────────────────
  // Si rawData contient un champ "id", on tente la mise à jour
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
  // Validation Zod côté serveur (défense en profondeur)
  const parsed = PostCreateSchema.safeParse(rawData)
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Données invalides',
    }
  }

  const { text, platforms, mediaUrls, scheduledFor, status, platformOverrides } = parsed.data

  // Détermination du statut final
  const finalStatus = scheduledFor ? 'SCHEDULED' : (status ?? 'DRAFT')

  try {
    const post = await prisma.post.create({
      data: {
        userId,
        text,
        platforms,
        mediaUrls: mediaUrls ?? [],
        scheduledFor: scheduledFor ?? null,
        status: finalStatus,
      },
    })

    // Upsert des contenus spécifiques par plateforme (si des overrides existent)
    // Chaque override crée ou met à jour un enregistrement PostPlatformContent
    if (platformOverrides && Object.keys(platformOverrides).length > 0) {
      await upsertPlatformContents(post.id, platformOverrides)
    }

    // Invalide le cache de la liste des posts
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

  const { id, text, platforms, mediaUrls, scheduledFor, status, platformOverrides } = parsed.data

  // ─── Ownership check ────────────────────────────────────────────────────────
  // Vérifier que le post appartient à l'utilisateur avant de le modifier
  const existingPost = await prisma.post.findUnique({
    where: { id },
    select: { userId: true, status: true },
  })

  if (!existingPost) {
    return { success: false, error: 'Post introuvable' }
  }

  if (existingPost.userId !== userId) {
    // Ne pas révéler si le post existe ou non (sécurité)
    return { success: false, error: 'Post introuvable' }
  }

  // Seuls les posts DRAFT ou SCHEDULED peuvent être modifiés
  if (existingPost.status === 'PUBLISHED' || existingPost.status === 'FAILED') {
    return { success: false, error: 'Ce post ne peut plus être modifié' }
  }

  // Détermination du statut final
  const finalStatus = scheduledFor
    ? 'SCHEDULED'
    : (status ?? existingPost.status)

  try {
    const post = await prisma.post.update({
      where: { id },
      data: {
        // Seuls les champs présents dans rawData sont mis à jour
        ...(text !== undefined && { text }),
        ...(platforms !== undefined && { platforms }),
        ...(mediaUrls !== undefined && { mediaUrls }),
        ...(scheduledFor !== undefined && { scheduledFor }),
        status: finalStatus,
      },
    })

    // Upsert des contenus spécifiques par plateforme (si des overrides existent)
    if (platformOverrides && Object.keys(platformOverrides).length > 0) {
      await upsertPlatformContents(id, platformOverrides)
    }

    // Invalide le cache des pages affectées
    revalidatePath('/calendar')
    revalidatePath('/')

    return { success: true, post: mapPrismaPost(post) }
  } catch (error) {
    console.error('[savePost] Erreur mise à jour post :', error)
    return { success: false, error: 'Erreur lors de la sauvegarde' }
  }
}

// ─── Helpers internes ─────────────────────────────────────────────────────────

/**
 * Upsert les enregistrements PostPlatformContent pour un post donné.
 * Appelée après la création ou la mise à jour d'un Post pour persister les overrides.
 *
 * La logique est un upsert : si l'enregistrement existe déjà (même postId + platform),
 * on le met à jour ; sinon on le crée. Le status est reset à PENDING car le contenu
 * a changé et devra être re-publié.
 *
 * @param postId - ID du post parent
 * @param overrides - Map platform → {text, mediaUrls} depuis PostCreateSchema
 *
 * @example
 *   await upsertPlatformContents('post_abc', {
 *     twitter: { text: 'Tweet court', mediaUrls: [] },
 *     instagram: { text: 'Post Instagram plus long', mediaUrls: ['https://...'] },
 *   })
 */
async function upsertPlatformContents(
  postId: string,
  overrides: Record<string, { text: string; mediaUrls: string[] }>,
): Promise<void> {
  // Upsert en parallèle pour les performances (chaque plateforme est indépendante)
  await Promise.all(
    Object.entries(overrides).map(([platform, content]) =>
      prisma.postPlatformContent.upsert({
        where: {
          // Contrainte unique (postId, platform) définie dans schema.prisma
          postId_platform: { postId, platform },
        },
        create: {
          postId,
          platform,
          text: content.text,
          mediaUrls: content.mediaUrls,
          // Status PENDING : sera mis à jour par Inngest lors de la publication
          status: 'PENDING',
        },
        update: {
          text: content.text,
          mediaUrls: content.mediaUrls,
          // Reset le status car le contenu a changé → nécessite une re-publication
          status: 'PENDING',
          // Effacer les données de publication précédentes (si re-publication)
          latePostId: null,
          failureReason: null,
          publishedAt: null,
        },
      }),
    ),
  )
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
 *     // Post supprimé, rediriger vers /calendar
 *   }
 */
export async function deletePost(postId: string): Promise<{ success: boolean; error?: string }> {
  // ─── Authentification ─────────────────────────────────────────────────────
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return { success: false, error: 'Non authentifié' }
  }

  // ─── Ownership check + statut ──────────────────────────────────────────────
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

    revalidatePath('/calendar')
    revalidatePath('/')

    return { success: true }
  } catch (error) {
    console.error('[deletePost] Erreur suppression post :', error)
    return { success: false, error: 'Erreur lors de la suppression' }
  }
}
