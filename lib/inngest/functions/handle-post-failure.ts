/**
 * @file lib/inngest/functions/handle-post-failure.ts
 * @description Fonction Inngest : gestion des échecs de publication.
 *   Déclenchée automatiquement par Inngest sur "inngest/function.failed"
 *   quand publishScheduledPost échoue après ses retries.
 *
 *   Workflow :
 *   1. Vérifier que c'est bien publish-scheduled-post qui a échoué
 *   2. Lire l'état actuel du post en DB
 *   3a. Si platformPostUrl présent → post publié en réalité → réparer en PUBLISHED
 *   3b. Sinon → marquer FAILED avec le motif d'erreur Inngest
 *
 *   Garde critique contre la race condition "double run" :
 *   Lorsque l'event post/schedule est émis deux fois (double-submit, retry réseau),
 *   deux runs Inngest coexistent sur le même postId. Si Run A échoue et Run B réussit :
 *   - Run B → "mettre-a-jour-statut" → DB: PUBLISHED + platformPostUrl
 *   - Run A → inngest/function.failed → ici
 *   Sans garde, on écraserait PUBLISHED → FAILED alors que le post EST publié.
 *
 *   Règle métier : platformPostUrl = preuve irréfutable de publication.
 *   Un post avec platformPostUrl ne peut jamais être FAILED.
 *
 *   Note : les notifications par email (Resend) ont été retirées — seul Plunk
 *   est actif pour les emails transactionnels, géré dans lib/auth.ts.
 *
 * @example
 *   // Déclenché automatiquement par Inngest — ne pas appeler directement.
 */

import { inngest } from '@/lib/inngest/client'
import { prisma } from '@/lib/prisma'

/** ID de la fonction qui déclenche cette gestion d'échec */
const PUBLISHER_FUNCTION_ID = 'publish-scheduled-post'

/**
 * Fonction Inngest de gestion des échecs de publication.
 * Écoute l'événement système "inngest/function.failed" émis par Inngest
 * quand une fonction dépasse son nombre de retries.
 *
 * retries: 3 — si cette fonction échoue elle-même (ex: Prisma indisponible),
 * Inngest la rejoue jusqu'à 3 fois avant d'abandonner.
 */
export const handlePostFailure = inngest.createFunction(
  {
    id: 'handle-post-failure',
    name: 'Gérer un échec de publication',
    retries: 3,
  },
  { event: 'inngest/function.failed' },
  async ({ event, step }) => {
    console.log('[handle-post-failure] event.data:', JSON.stringify(event.data, null, 2))

    // Vérifier que c'est bien la fonction de publication qui a échoué
    if (!event.data.function_id?.includes(PUBLISHER_FUNCTION_ID)) {
      return { skipped: true, reason: 'Autre fonction' }
    }

    // Extraire le postId depuis l'événement original
    const postId = event.data.event?.data?.postId as string | undefined
    if (!postId) {
      console.error('[handle-post-failure] postId manquant dans event.data')
      return { skipped: true, reason: 'postId manquant' }
    }

    const failureReason =
      (event.data.error as { message?: string } | undefined)?.message ?? 'Erreur inconnue'

    // ── Étape 1 : Lire l'état actuel puis marquer FAILED ou réparer ───────────
    //
    // Avant de marquer FAILED, on vérifie la présence de platformPostUrl.
    // platformPostUrl = preuve que Late a bien publié le contenu sur la plateforme.
    //
    // Cas de race condition :
    //   Run B (doublon) réussit → DB: PUBLISHED + platformPostUrl à T1
    //   Run A échoue  → inngest/function.failed → on lit la DB à T2
    //   Si T2 > T1 : platformPostUrl présent → on répare en PUBLISHED (pas d'écrasement)
    //   Si T2 < T1 : platformPostUrl absent → on marque FAILED, Run B écrasera en PUBLISHED
    // Dans les deux ordres, l'état final est PUBLISHED. ✅
    await step.run('verifier-puis-marquer', async () => {
      const current = await prisma.post.findUnique({
        where: { id: postId },
        select: { platformPostUrl: true },
      })

      // Post supprimé entre la planification et l'échec Inngest
      if (!current) {
        console.warn(`[handle-post-failure] Post ${postId} introuvable — rien à faire.`)
        return { updated: false, reason: 'post-not-found' }
      }

      // platformPostUrl présent = publication confirmée malgré l'échec Inngest.
      // Incohérence DB détectée → réparer en PUBLISHED.
      if (current.platformPostUrl) {
        console.warn(
          `[handle-post-failure] Incohérence détectée sur le post ${postId} :`,
          `platformPostUrl présent (${current.platformPostUrl}) mais Inngest a échoué.`,
          'Race condition "double run" — réparation : PUBLISHED + failureReason: null.',
        )
        await prisma.post.update({
          where: { id: postId },
          data: { status: 'PUBLISHED', failureReason: null },
        })
        return { updated: true, reason: 'repaired-to-published' }
      }

      // Cas nominal : pas de platformPostUrl → le post n'a pas été publié → FAILED
      await prisma.post.update({
        where: { id: postId },
        data: { status: 'FAILED', failureReason },
      })
      return { updated: true, reason: 'marked-failed' }
    })

    return { postMarkedFailed: true }
  },
)
