/**
 * @file lib/inngest/functions/publish-scheduled-post.ts
 * @description Fonction Inngest : publication d'un post planifié via getlate.dev.
 *   Déclenchée sur l'événement "post/schedule".
 *
 *   Nouveau modèle simplifié (post-refonte) : 1 post = 1 plateforme.
 *   - Post.platform (string) : plateforme unique du post
 *   - Post.text / Post.mediaUrls : contenu direct sans override par plateforme
 *   - Pas de PostPlatformContent : le contenu est directement sur le Post
 *
 *   Workflow :
 *   1. Attendre la date scheduledFor via step.sleepUntil()
 *   2. Récupérer le post en DB et vérifier son statut (SCHEDULED)
 *   3. Récupérer le profil getlate.dev de la plateforme du post
 *   4. Publier via getlate.dev avec publishNow: true (Inngest a déjà attendu)
 *   5. Vérifier le statut par plateforme dans la réponse Late
 *   6. Mettre à jour le Post avec PUBLISHED + platformPostUrl (ou FAILED)
 *
 *   Pourquoi `publishNow: true` au lieu de `scheduledAt` ?
 *   - Inngest gère le timing via `step.sleepUntil()` (persistance, retries, backoff)
 *   - Late ne connaît pas la date de publication — c'est Inngest qui décide du moment
 *   - En passant `publishNow: true`, Late publie immédiatement à réception
 *   - Late retourne le statut par plateforme + l'URL du post publié
 *
 *   En cas d'échec après les 3 retries Inngest :
 *   → L'event "inngest/function.failed" est émis automatiquement
 *
 * @example
 *   // Déclenché automatiquement par inngest.send({ name: 'post/schedule', data: { ... } })
 *   // Ne pas appeler directement.
 */

import { inngest } from '@/lib/inngest/client'
import { late } from '@/lib/late'
import { prisma } from '@/lib/prisma'

/**
 * Fonction Inngest de publication d'un post planifié.
 * Retry automatique : 3 tentatives avec backoff exponentiel (géré par Inngest).
 */
export const publishScheduledPost = inngest.createFunction(
  {
    id: 'publish-scheduled-post',
    name: 'Publier un post planifié',
    // 3 retries avec backoff exponentiel en cas d'erreur réseau ou API
    retries: 3,
  },
  { event: 'post/schedule' },
  async ({ event, step }) => {
    const { postId, scheduledFor } = event.data

    // ── Étape 1 : Attendre la date de publication ─────────────────────────────
    // step.sleepUntil() met en pause la fonction jusqu'à scheduledFor.
    // Inngest gère la persistance — pas de processus Node actif pendant l'attente.
    await step.sleepUntil('attendre-heure-publication', scheduledFor)

    // ── Étape 2 : Récupérer le post et vérifier son statut ───────────────────
    // Un autre processus aurait pu annuler ou modifier le post entre-temps.
    const post = await step.run('recuperer-post', async () => {
      return prisma.post.findUnique({
        where: { id: postId },
        select: {
          id: true,
          text: true,
          platform: true,   // Plateforme unique du post (simplifié)
          mediaUrls: true,
          status: true,
          userId: true,
          scheduledFor: true,
        },
      })
    })

    // Si le post a été supprimé ou annulé, on arrête sans erreur
    if (!post || post.status !== 'SCHEDULED') {
      return {
        skipped: true,
        reason: post
          ? `Statut inattendu : ${post.status}`
          : 'Post introuvable',
      }
    }

    // ── Étape 3 : Récupérer le profil getlate.dev de la plateforme ───────────
    // Chaque post a UNE seule plateforme → un seul profil à récupérer
    const connectedPlatform = await step.run('recuperer-profil', async () => {
      return prisma.connectedPlatform.findFirst({
        where: {
          userId: post.userId,
          platform: post.platform,
          isActive: true,
        },
        select: {
          platform: true,
          lateProfileId: true,
        },
      })
    })

    if (!connectedPlatform) {
      // Profil connecté introuvable → marquer comme FAILED
      await prisma.post.update({
        where: { id: postId },
        data: {
          status: 'FAILED',
          failureReason: `Aucun profil ${post.platform} connecté pour la publication`,
        },
      })
      throw new Error(`Profil ${post.platform} introuvable pour l'utilisateur`)
    }

    // ── Étape 4 : Publier via getlate.dev avec publishNow ────────────────────
    // `publishNow: true` car Inngest a déjà attendu via step.sleepUntil().
    // Late publie immédiatement et retourne le statut par plateforme + l'URL du post.
    const latePost = await step.run('publier-post', async () => {
      return late.posts.create({
        text: post.text,
        // Un seul profileId : la publication est sur une seule plateforme
        profileIds: [connectedPlatform.lateProfileId],
        mediaUrls: post.mediaUrls.length > 0 ? post.mediaUrls : undefined,
        // Late publie immédiatement — Inngest a déjà géré le timing via sleepUntil
        publishNow: true,
      })
    })

    // ── Étape 5 : Vérifier le statut de publication par plateforme ───────────
    // Late retourne `platforms[0]` avec status 'success' | 'failed' | 'pending'.
    // En cas d'échec, on throw pour déclencher les retries Inngest automatiques.
    const platformResult = latePost.platforms?.[0]

    if (!platformResult || platformResult.status === 'failed') {
      // Marquer comme FAILED immédiatement (avant le throw)
      // pour que l'UI reflète l'erreur même si les retries échouent.
      await prisma.post.update({
        where: { id: postId },
        data: {
          status: 'FAILED',
          failureReason: `Late : publication échouée sur ${platformResult?.platform ?? connectedPlatform.platform}`,
        },
      })
      throw new Error(
        `Late : publication échouée sur ${platformResult?.platform ?? connectedPlatform.platform}`
      )
    }

    // ── Étape 6 : Mettre à jour le statut du Post ─────────────────────────────
    // Récupérer l'ID Late : Late retourne `_id` (MongoDB), fallback sur `id`
    const latePostId = latePost._id ?? latePost.id ?? null

    await step.run('mettre-a-jour-statut', async () => {
      return prisma.post.update({
        where: { id: postId },
        data: {
          status: 'PUBLISHED',
          publishedAt: latePost.publishedAt ? new Date(latePost.publishedAt) : new Date(),
          latePostId,
          // URL directe du post publié (ex: "https://tiktok.com/@handle/video/...")
          platformPostUrl: platformResult.platformPostUrl ?? null,
          failureReason: null,
        },
      })
    })

    return {
      published: true,
      platform: post.platform,
      latePostId,
      platformPostUrl: platformResult.platformPostUrl ?? null,
    }
  },
)
