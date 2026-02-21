/**
 * @file modules/posts/actions/schedule-post.action.ts
 * @module posts
 * @description Server Action : planification d'un post.
 *   Sauvegarde le post avec status SCHEDULED en DB, puis déclenche l'event Inngest
 *   "post/schedule" qui orchestre la publication différée via getlate.dev.
 *
 *   Modèle simplifié : 1 post = 1 plateforme (platform string, pas platforms[]).
 *
 *   Workflow complet :
 *   1. Vérification de session
 *   2. Validation Zod (scheduledFor requis et dans le futur)
 *   3. Vérification de la plateforme connectée (ownership)
 *   4. Création ou mise à jour du post en DB (status: SCHEDULED)
 *   5. Envoi de l'event Inngest → publication différée
 *   6. Revalidation du cache /calendar et /compose
 *
 * @example
 *   // Depuis PostComposeCard.tsx (action "Planifier") :
 *   const result = await schedulePost({
 *     text: 'Mon post',
 *     platform: 'instagram',
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
 *   const result = await schedulePost({ text: '...', platform: 'instagram', scheduledFor: date })
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

  const { text, platform, mediaUrls, scheduledFor } = parsed.data

  // ─── Vérification de la plateforme connectée ──────────────────────────────
  // Contrôler que l'utilisateur a bien connecté cette plateforme
  const connectedCount = await prisma.connectedPlatform.count({
    where: {
      userId: session.user.id,
      platform,
      isActive: true,
    },
  })

  if (connectedCount === 0) {
    return {
      success: false,
      error: `La plateforme ${platform} n'est pas connectée`,
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
          data: { text, platform, mediaUrls: mediaUrls ?? [], scheduledFor, status: 'SCHEDULED' },
        })
      : await prisma.post.create({
          data: {
            userId: session.user.id,
            text,
            platform,
            mediaUrls: mediaUrls ?? [],
            scheduledFor,
            status: 'SCHEDULED',
          },
        })

    // ─── Envoi de l'event Inngest ────────────────────────────────────────────
    // Inngest orchestre la publication à scheduledFor via step.sleepUntil()
    await inngest.send({
      name: 'post/schedule',
      data: {
        postId: post.id,
        scheduledFor: scheduledFor.toISOString(),
      },
    })

    // Invalide le cache des pages affectées
    revalidatePath('/compose')
    revalidatePath('/calendar')
    revalidatePath('/')

    return {
      success: true,
      post: {
        id: post.id,
        userId: post.userId,
        text: post.text,
        platform: post.platform,
        mediaUrls: post.mediaUrls,
        scheduledFor: post.scheduledFor,
        publishedAt: post.publishedAt,
        status: post.status as 'SCHEDULED',
        latePostId: post.latePostId,
        failureReason: post.failureReason,
        createdAt: post.createdAt,
        updatedAt: post.updatedAt,
      },
    }
  } catch (error) {
    console.error('[schedulePost] Erreur :', error)
    return { success: false, error: 'Erreur lors de la planification' }
  }
}
