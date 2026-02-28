/**
 * @file lib/inngest/functions/handle-post-failure.ts
 * @description Fonction Inngest : gestion des échecs de publication.
 *   Déclenchée automatiquement par Inngest sur "inngest/function.failed"
 *   quand publishScheduledPost échoue après ses retries.
 *
 *   Workflow :
 *   1. Vérifier que c'est bien publish-scheduled-post qui a échoué
 *   2. Mettre le post en statut FAILED (step critique, sans include user)
 *   3. Vérifier les prefs notification de l'utilisateur
 *   4. Si emailOnFailure → charger le user séparément puis envoyer l'email via Resend
 *
 *   Pourquoi séparer DB et email en deux steps ?
 *   Si l'envoi d'email échoue (ex: Resend indisponible), Inngest retry uniquement
 *   le step "envoyer-email-echec" — pas l'update DB qui est déjà committé.
 *   Sans cette séparation, un retry réexécuterait l'update DB (idempotent mais inutile)
 *   ET pourrait échouer si `include: { user }` retourne null (relation brisée).
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
    // (on récupère userId via select, suffisant pour les steps suivants)
    const updatedPost = await step.run('marquer-echec', async () => {
      return prisma.post.update({
        where: { id: postId },
        data: { status: 'FAILED', failureReason },
        select: { userId: true, text: true, platform: true },
      })
    })

    // ── Étape 2 : Vérifier les préférences de notification ───────────────────
    const prefs = await step.run('verifier-prefs-notification', async () => {
      return prisma.notificationPrefs.findUnique({
        where: { userId: updatedPost.userId },
        select: { emailOnFailure: true },
      })
    })

    // Si l'utilisateur a désactivé les emails d'échec → on s'arrête ici
    if (!prefs?.emailOnFailure) {
      return { postMarkedFailed: true, emailSent: false }
    }

    // ── Étape 3 : Envoyer l'email d'alerte via Resend ─────────────────────────
    // User chargé séparément de l'update DB pour isoler les erreurs potentielles
    await step.run('envoyer-email-echec', async () => {
      const user = await prisma.user.findUnique({
        where: { id: updatedPost.userId },
        select: { email: true, name: true },
      })

      // Si le compte est supprimé entre-temps, on ne peut pas envoyer l'email
      if (!user) {
        console.warn(`[handle-post-failure] Utilisateur ${updatedPost.userId} introuvable`)
        return
      }

      const baseUrl = process.env.BETTER_AUTH_URL ?? 'https://ogolong.com'

      return getResend().emails.send({
        from: process.env.RESEND_FROM_EMAIL ?? 'noreply@ogolong.com',
        to: user.email,
        subject: '⚠️ Échec de publication — ogolong',
        react: PublicationFailedEmail({
          userName: user.name ?? 'Utilisateur',
          // Extrait du texte (max 100 chars pour ne pas surcharger l'email)
          postText: updatedPost.text.substring(0, 100),
          platform: updatedPost.platform,
          failureReason,
          // Lien direct vers le post dans le compositeur
          postUrl: `${baseUrl}/compose?postId=${postId}`,
        }),
      })
    })

    return { postMarkedFailed: true, emailSent: true }
  },
)
