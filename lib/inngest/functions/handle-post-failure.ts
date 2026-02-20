/**
 * @file lib/inngest/functions/handle-post-failure.ts
 * @description Fonction Inngest : gestion des échecs de publication.
 *   Déclenchée automatiquement par Inngest sur "inngest/function.failed"
 *   quand publishScheduledPost échoue après ses 3 retries.
 *
 *   Workflow :
 *   1. Vérifier que c'est bien publish-scheduled-post qui a échoué
 *   2. Mettre le post en statut FAILED avec la raison de l'échec
 *   3. Si l'utilisateur a activé emailOnFailure → envoyer l'email via Resend
 *
 * @example
 *   // Déclenché automatiquement par Inngest — ne pas appeler directement.
 */

import { PublicationFailedEmail } from '@/emails/PublicationFailed'
import { inngest } from '@/lib/inngest/client'
import { prisma } from '@/lib/prisma'
import { getResend } from '@/lib/resend'

/** ID de la fonction qui déclenche cette gestion d'échec */
const PUBLISHER_FUNCTION_ID = 'publish-scheduled-post'

/**
 * Fonction Inngest de gestion des échecs de publication.
 * Écoute l'événement système "inngest/function.failed" émis par Inngest
 * quand une fonction dépasse son nombre de retries.
 */
export const handlePostFailure = inngest.createFunction(
  {
    id: 'handle-post-failure',
    name: 'Gérer un échec de publication',
  },
  // Événement système Inngest émis quand une fonction épuise ses retries
  { event: 'inngest/function.failed' },
  async ({ event, step }) => {
    // Vérifier que c'est bien la fonction de publication qui a échoué
    if (!event.data.function_id?.includes(PUBLISHER_FUNCTION_ID)) {
      return { skipped: true, reason: 'Autre fonction' }
    }

    // Extraire le postId depuis l'événement original
    const postId = event.data.event?.data?.postId as string | undefined
    if (!postId) {
      return { skipped: true, reason: 'postId manquant' }
    }

    const failureReason =
      (event.data.error as { message?: string } | undefined)?.message ?? 'Erreur inconnue'

    // ── Étape 1 : Marquer le post comme FAILED en DB ─────────────────────────
    const post = await step.run('marquer-echec', async () => {
      return prisma.post.update({
        where: { id: postId },
        data: {
          status: 'FAILED',
          failureReason,
        },
        // Récupérer les infos utilisateur pour l'email
        include: {
          user: {
            select: { email: true, name: true },
          },
        },
      })
    })

    // ── Étape 2 : Vérifier les préférences de notification ───────────────────
    const prefs = await step.run('verifier-prefs-notification', async () => {
      return prisma.notificationPrefs.findUnique({
        where: { userId: post.userId },
        select: { emailOnFailure: true },
      })
    })

    // Si l'utilisateur a désactivé les emails d'échec → on s'arrête ici
    if (!prefs?.emailOnFailure) {
      return { postMarkedFailed: true, emailSent: false }
    }

    // ── Étape 3 : Envoyer l'email d'alerte via Resend ─────────────────────────
    await step.run('envoyer-email-echec', async () => {
      const baseUrl = process.env.BETTER_AUTH_URL ?? 'https://rabb.com'

      return getResend().emails.send({
        from: process.env.RESEND_FROM_EMAIL ?? 'noreply@rabb.com',
        to: post.user.email,
        subject: '⚠️ Échec de publication — rabb',
        react: PublicationFailedEmail({
          userName: post.user.name ?? 'Utilisateur',
          // Extrait du texte (max 100 chars pour ne pas surcharger l'email)
          postText: post.text.substring(0, 100),
          platforms: post.platforms,
          failureReason,
          // Lien direct vers le post dans le compositeur
          postUrl: `${baseUrl}/compose?postId=${postId}`,
        }),
      })
    })

    return { postMarkedFailed: true, emailSent: true }
  },
)
