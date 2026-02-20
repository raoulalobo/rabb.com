/**
 * @file lib/inngest/functions/publish-scheduled-post.ts
 * @description Fonction Inngest : publication d'un post planifié via getlate.dev.
 *   Déclenchée sur l'événement "post/schedule".
 *
 *   Depuis la Phase 4 (contenu par plateforme), la publication se fait plateforme
 *   par plateforme (et non en une seule requête globale) :
 *   - Pour chaque plateforme du post, on cherche un PostPlatformContent (override)
 *   - Si un override existe → utiliser son text et ses mediaUrls
 *   - Sinon → utiliser le contenu de base du Post parent (fallback)
 *   - On met à jour le statut du PostPlatformContent après chaque publication
 *   - Le Post global passe à PUBLISHED quand toutes les plateformes sont OK
 *
 *   Workflow :
 *   1. Attendre la date scheduledFor via step.sleepUntil()
 *   2. Récupérer le post en DB (avec ses platformContents) et vérifier son statut
 *   3. Récupérer les profils getlate.dev des plateformes sélectionnées
 *   4. Pour chaque plateforme : publier avec son contenu spécifique ou le fallback
 *   5. Mettre à jour le PostPlatformContent avec le statut de publication
 *   6. Marquer le Post global comme PUBLISHED (ou FAILED si toutes ont échoué)
 *
 *   En cas d'échec après les 3 retries Inngest :
 *   → L'event "inngest/function.failed" est émis automatiquement
 *   → Intercepté par handle-post-failure.ts
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
    // On charge aussi les platformContents pour connaître les overrides.
    const post = await step.run('recuperer-post', async () => {
      return prisma.post.findUnique({
        where: { id: postId },
        select: {
          id: true,
          text: true,
          platforms: true,
          mediaUrls: true,
          status: true,
          userId: true,
          scheduledFor: true,
          // Overrides de contenu par plateforme
          platformContents: {
            select: {
              platform: true,
              text: true,
              mediaUrls: true,
            },
          },
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

    // ── Étape 3 : Récupérer les profils getlate.dev correspondants ───────────
    // Chaque plateforme sélectionnée doit avoir un profil connecté (lateProfileId).
    // On retourne un map platform → lateProfileId pour la boucle de publication.
    const connectedPlatformsMap = await step.run('recuperer-profils', async () => {
      const connectedPlatforms = await prisma.connectedPlatform.findMany({
        where: {
          userId: post.userId,
          platform: { in: post.platforms },
          isActive: true,
        },
        select: {
          platform: true,
          lateProfileId: true,
        },
      })

      // Convertir en Map pour un accès O(1) lors de la boucle
      return Object.fromEntries(
        connectedPlatforms.map((cp) => [cp.platform, cp.lateProfileId]),
      )
    })

    if (Object.keys(connectedPlatformsMap).length === 0) {
      // Aucun profil connecté trouvé → on marque comme FAILED
      await prisma.post.update({
        where: { id: postId },
        data: {
          status: 'FAILED',
          failureReason: 'Aucune plateforme connectée trouvée pour la publication',
        },
      })
      throw new Error('Aucun profil getlate.dev disponible')
    }

    // ── Étape 4 : Publier plateforme par plateforme ───────────────────────────
    // Pour chaque plateforme sélectionnée dans le post :
    // 1. Chercher un PostPlatformContent (override)
    // 2. Utiliser son contenu ou le fallback sur le Post parent
    // 3. Publier via getlate.dev sur ce profil uniquement
    // 4. Mettre à jour le statut du PostPlatformContent
    const platformResults: Array<{
      platform: string
      success: boolean
      latePostId?: string
      error?: string
    }> = []

    for (const platform of post.platforms) {
      const lateProfileId = connectedPlatformsMap[platform]

      // Si la plateforme n'a pas de profil connecté, on saute
      if (!lateProfileId) {
        platformResults.push({
          platform,
          success: false,
          error: `Profil non connecté pour ${platform}`,
        })
        continue
      }

      // Chercher l'override de contenu spécifique à cette plateforme
      const platformContent = post.platformContents.find((pc) => pc.platform === platform)

      // Fallback : si pas d'override → utiliser le contenu de base du Post
      const textToPublish = platformContent?.text ?? post.text
      const mediaUrlsToPublish =
        platformContent?.mediaUrls && platformContent.mediaUrls.length > 0
          ? platformContent.mediaUrls
          : post.mediaUrls

      try {
        // Publier sur cette plateforme uniquement (profileId unique)
        const latePost = await step.run(`publier-${platform}`, async () => {
          return late.posts.create({
            text: textToPublish,
            // Un seul profileId : la publication est par plateforme
            profileIds: [lateProfileId],
            mediaUrls: mediaUrlsToPublish.length > 0 ? mediaUrlsToPublish : undefined,
          })
        })

        // Mettre à jour le PostPlatformContent : PUBLISHED
        await step.run(`maj-statut-${platform}`, async () => {
          return prisma.postPlatformContent.upsert({
            where: { postId_platform: { postId: post.id, platform } },
            create: {
              postId: post.id,
              platform,
              text: textToPublish,
              mediaUrls: mediaUrlsToPublish,
              status: 'PUBLISHED',
              latePostId: latePost.id,
              publishedAt: new Date(),
            },
            update: {
              status: 'PUBLISHED',
              latePostId: latePost.id,
              publishedAt: new Date(),
              failureReason: null,
            },
          })
        })

        platformResults.push({
          platform,
          success: true,
          latePostId: latePost.id,
        })
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue'

        // Mettre à jour le PostPlatformContent : FAILED (sans interrompre les autres plateformes)
        await step.run(`maj-echec-${platform}`, async () => {
          return prisma.postPlatformContent.upsert({
            where: { postId_platform: { postId: post.id, platform } },
            create: {
              postId: post.id,
              platform,
              text: textToPublish,
              mediaUrls: mediaUrlsToPublish,
              status: 'FAILED',
              failureReason: errorMessage,
            },
            update: {
              status: 'FAILED',
              failureReason: errorMessage,
            },
          })
        })

        platformResults.push({
          platform,
          success: false,
          error: errorMessage,
        })
      }
    }

    // ── Étape 5 : Mettre à jour le statut global du Post ─────────────────────
    // Le Post passe à PUBLISHED si au moins une plateforme a réussi.
    // Il passe à FAILED si toutes les plateformes ont échoué.
    const successfulPlatforms = platformResults.filter((r) => r.success)
    const allFailed = successfulPlatforms.length === 0

    await step.run('mettre-a-jour-statut-global', async () => {
      if (allFailed) {
        // Toutes les plateformes ont échoué → marquer le post global comme FAILED
        const allErrors = platformResults.map((r) => `${r.platform}: ${r.error}`).join(', ')
        return prisma.post.update({
          where: { id: postId },
          data: {
            status: 'FAILED',
            failureReason: `Échec sur toutes les plateformes : ${allErrors}`,
          },
        })
      }

      // Au moins une plateforme a réussi → marquer le post global comme PUBLISHED
      // Le latePostId global pointe vers la première publication réussie (référence)
      const firstSuccess = successfulPlatforms[0]
      return prisma.post.update({
        where: { id: postId },
        data: {
          status: 'PUBLISHED',
          publishedAt: new Date(),
          latePostId: firstSuccess?.latePostId ?? null,
        },
      })
    })

    return {
      published: !allFailed,
      platformResults,
      successCount: successfulPlatforms.length,
      failureCount: platformResults.length - successfulPlatforms.length,
    }
  },
)
