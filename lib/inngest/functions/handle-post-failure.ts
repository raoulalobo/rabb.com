/**
 * @file lib/inngest/functions/handle-post-failure.ts
 * @description Fonction Inngest : gestion des échecs de publication.
 *   Déclenchée automatiquement par Inngest sur "inngest/function.failed"
 *   quand publishScheduledPost échoue après ses retries.
 *
 *   Workflow :
 *   1. Vérifier que c'est bien publish-scheduled-post qui a échoué
 *   2. Mettre le post en statut FAILED en base de données
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
    // Rejouer cette fonction si elle échoue (ex: DB temporairement indisponible)
    retries: 3,
  },
  // Événement système Inngest émis quand une fonction épuise ses retries
  { event: 'inngest/function.failed' },
  async ({ event, step }) => {
    // Log complet pour diagnostiquer les futurs changements de structure SDK Inngest
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

    // ── Étape 1 : Marquer le post comme FAILED en DB ─────────────────────────
    // Sans `include: { user }` pour éviter qu'une relation brisée empêche l'update
    await step.run('marquer-echec', async () => {
      return prisma.post.update({
        where: { id: postId },
        data: { status: 'FAILED', failureReason },
        select: { userId: true },
      })
    })

    return { postMarkedFailed: true }
  },
)
