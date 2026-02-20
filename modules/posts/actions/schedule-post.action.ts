/**
 * @file modules/posts/actions/schedule-post.action.ts
 * @module posts
 * @description Server Action : planification d'un post.
 *   Sauvegarde le post avec status SCHEDULED en DB, puis déclenche l'event Inngest
 *   "post/schedule" qui orchestre la publication différée via getlate.dev.
 *
 *   Cette action est appelée par PostComposer.Footer quand l'utilisateur
 *   clique sur "Planifier" avec une date sélectionnée.
 *
 *   Workflow complet :
 *   1. Vérification de session
 *   2. Validation Zod (scheduledFor requis et dans le futur)
 *   3. Vérification des plateformes connectées (ownership)
 *   4. Création ou mise à jour du post en DB (status: SCHEDULED)
 *   5. Envoi de l'event Inngest → publication différée
 *   6. Revalidation du cache /calendar
 *
 * @example
 *   // Depuis PostComposer.Footer :
 *   const result = await schedulePost({
 *     text: 'Mon post',
 *     platforms: ['instagram', 'tiktok'],
 *     scheduledFor: new Date('2024-03-15T10:00:00'),
 *   })
 *   if (result.success) {
 *     // result.post contient le post planifié
 *   }
 */

'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'

import { auth } from '@/lib/auth'
import { inngest } from '@/lib/inngest/client'
import { prisma } from '@/lib/prisma'
import { PostCreateSchema } from '@/modules/posts/schemas/post.schema'
import type { SavePostResult } from '@/modules/posts/types'

/**
 * Planifie un post : sauvegarde en DB + event Inngest pour publication différée.
 *
 * @param rawData - Données du post (validées par PostCreateSchema, scheduledFor requis)
 * @param existingPostId - ID d'un post existant à mettre à jour (optionnel)
 * @returns SavePostResult avec le post planifié ou un message d'erreur
 *
 * @example
 *   // Nouveau post planifié :
 *   const result = await schedulePost({ text: '...', platforms: ['instagram'], scheduledFor: date })
 *
 *   // Mise à jour d'un brouillon en post planifié :
 *   const result = await schedulePost({ ... }, 'post_abc123')
 */
export async function schedulePost(
  rawData: unknown,
  existingPostId?: string,
): Promise<SavePostResult> {
  // ─── Authentification ─────────────────────────────────────────────────────
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return { success: false, error: 'Non authentifié' }
  }

  // ─── Validation Zod ───────────────────────────────────────────────────────
  const parsed = PostCreateSchema.safeParse(rawData)
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Données invalides',
    }
  }

  // scheduledFor est requis pour planifier (sinon utiliser savePost pour DRAFT)
  if (!parsed.data.scheduledFor) {
    return { success: false, error: 'La date de publication est requise pour planifier' }
  }

  const { text, platforms, mediaUrls, scheduledFor, platformOverrides } = parsed.data

  // ─── Vérification des plateformes connectées ──────────────────────────────
  // Contrôler que l'utilisateur a bien connecté toutes les plateformes demandées
  const connectedCount = await prisma.connectedPlatform.count({
    where: {
      userId: session.user.id,
      platform: { in: platforms },
      isActive: true,
    },
  })

  if (connectedCount === 0) {
    return {
      success: false,
      error: 'Aucune des plateformes sélectionnées n\'est connectée',
    }
  }

  // ─── Ownership check pour la mise à jour ─────────────────────────────────
  if (existingPostId) {
    const existing = await prisma.post.findUnique({
      where: { id: existingPostId },
      select: { userId: true, status: true },
    })

    if (!existing || existing.userId !== session.user.id) {
      return { success: false, error: 'Post introuvable' }
    }

    if (existing.status === 'PUBLISHED' || existing.status === 'FAILED') {
      return { success: false, error: 'Ce post ne peut plus être modifié' }
    }
  }

  // ─── Sauvegarde en DB ─────────────────────────────────────────────────────
  try {
    const post = existingPostId
      ? await prisma.post.update({
          where: { id: existingPostId },
          data: { text, platforms, mediaUrls: mediaUrls ?? [], scheduledFor, status: 'SCHEDULED' },
        })
      : await prisma.post.create({
          data: {
            userId: session.user.id,
            text,
            platforms,
            mediaUrls: mediaUrls ?? [],
            scheduledFor,
            status: 'SCHEDULED',
          },
        })

    // ─── Upsert des overrides de plateformes ─────────────────────────────────
    // Persister les contenus spécifiques par plateforme si des overrides existent
    if (platformOverrides && Object.keys(platformOverrides).length > 0) {
      await Promise.all(
        Object.entries(platformOverrides).map(([platform, content]) =>
          prisma.postPlatformContent.upsert({
            where: { postId_platform: { postId: post.id, platform } },
            create: {
              postId: post.id,
              platform,
              text: content.text,
              mediaUrls: content.mediaUrls,
              status: 'PENDING',
            },
            update: {
              text: content.text,
              mediaUrls: content.mediaUrls,
              status: 'PENDING',
              latePostId: null,
              failureReason: null,
              publishedAt: null,
            },
          }),
        ),
      )
    }

    // ─── Envoi de l'event Inngest ────────────────────────────────────────────
    // Inngest orchestre la publication à scheduledFor via step.sleepUntil()
    await inngest.send({
      name: 'post/schedule',
      data: {
        postId: post.id,
        scheduledFor: scheduledFor.toISOString(),
      },
    })

    // Invalide le cache du calendrier pour afficher le nouveau post planifié
    revalidatePath('/calendar')
    revalidatePath('/')

    return {
      success: true,
      post: {
        id: post.id,
        userId: post.userId,
        text: post.text,
        platforms: post.platforms,
        mediaUrls: post.mediaUrls,
        scheduledFor: post.scheduledFor,
        publishedAt: post.publishedAt,
        status: post.status as 'SCHEDULED',
        latePostId: post.latePostId,
        createdAt: post.createdAt,
        updatedAt: post.updatedAt,
      },
    }
  } catch (error) {
    console.error('[schedulePost] Erreur :', error)
    return { success: false, error: 'Erreur lors de la planification' }
  }
}
