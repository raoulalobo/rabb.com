/**
 * @file lib/inngest/functions/watchdog-scheduled-post.ts
 * @description Fonction Inngest de surveillance post-publication.
 *   Déclenchée à chaque planification (event "post/watchdog"), elle dort
 *   jusqu'à scheduledFor + 5 min puis vérifie si le post a bien été publié.
 *
 *   Si le post est encore SCHEDULED et sa date est dans le passé →
 *   désynchronisation DB ↔ Inngest détectée → post marqué FAILED.
 *
 *   Pourquoi cette approche (watchdog par post) plutôt qu'un cron global ?
 *   - Coût : 1 requête DB par post, uniquement 5 min après la date prévue
 *   - Zéro polling continu (contrairement à un cron toutes les minutes)
 *   - Coût proportionnel au volume de posts planifiés, pas au temps écoulé
 *   - Le cron global lirait TOUS les posts SCHEDULED en permanence (O(n) requêtes)
 *
 *   Pourquoi 5 min de délai ?
 *   publishScheduledPost a 3 retries avec backoff exponentiel.
 *   Delay total max ≈ 1s + 2s + 4s = 7s de délai + 3 appels Late API (< 10s chacun).
 *   5 min est largement suffisant pour que publishScheduledPost termine ou échoue.
 *
 * @example
 *   // Déclenché automatiquement depuis schedulePost.action.ts — ne pas appeler directement.
 *   // En production : Inngest envoie ["post/schedule", "post/watchdog"] en batch.
 */

import { inngest } from '@/lib/inngest/client'
import { prisma } from '@/lib/prisma'

/**
 * Fonction Inngest de watchdog pour les posts planifiés.
 *
 * cancelOn : si l'utilisateur annule le post (event "post/cancel"), le watchdog
 * est annulé automatiquement (même mécanisme que publishScheduledPost).
 * La condition `match: 'data.postId'` compare event.data.postId du cancel
 * avec event.data.postId du watchdog courant.
 *
 * retries: 1 — un seul retry (si Prisma est indisponible au moment de la vérification).
 * Pas besoin de plus : le watchdog est une sécurité, pas un mécanisme critique.
 */
export const watchdogScheduledPost = inngest.createFunction(
  {
    id: 'watchdog-scheduled-post',
    name: 'Surveillance post planifié',
    retries: 1,
    // Annuler ce watchdog si le post est annulé (même cancelOn que publishScheduledPost)
    cancelOn: [{ event: 'post/cancel', match: 'data.postId' }],
  },
  // Déclenché en même temps que "post/schedule" depuis schedulePost.action.ts
  { event: 'post/watchdog' },
  async ({ event, step }) => {
    const { postId, scheduledFor } = event.data as { postId: string; scheduledFor: string }

    // ── Étape 1 : Attendre scheduledFor + 5 min ──────────────────────────────
    // On attend que publishScheduledPost ait eu le temps de terminer (ou d'échouer)
    // avant de vérifier l'état du post.
    const checkTime = new Date(new Date(scheduledFor).getTime() + 5 * 60 * 1000)
    await step.sleepUntil('attendre-verification', checkTime.toISOString())

    // ── Étape 2 : Vérifier l'état réel du post en DB ─────────────────────────
    const post = await step.run('verifier-statut-post', async () => {
      return prisma.post.findUnique({
        where: { id: postId },
        select: { status: true, scheduledFor: true },
      })
    })

    // Post supprimé entre la planification et la vérification → rien à faire
    if (!post) {
      return { skipped: true, reason: 'Post introuvable' }
    }

    // Post déjà publié ou marqué FAILED (par handlePostFailure) → désync corrigée
    if (post.status !== 'SCHEDULED') {
      return { skipped: true, reason: `Statut actuel : ${post.status}` }
    }

    // Double vérification : si l'utilisateur a re-planifié le post pour une date future,
    // scheduledFor a changé en DB. On ne touche pas un post re-planifié.
    // Note: step.run() sérialise les données via JSON → scheduledFor revient comme string ISO.
    if (post.scheduledFor && new Date(post.scheduledFor) > new Date()) {
      return { skipped: true, reason: 'Post re-planifié pour une date future' }
    }

    // ── Désynchronisation détectée ────────────────────────────────────────────
    // Le post est encore SCHEDULED mais sa date est passée depuis > 5 min.
    // Cause probable : INNGEST_SIGNING_KEY manquante → "No function ID found"
    // → publishScheduledPost n'a jamais été exécuté → post bloqué.
    console.warn(`[watchdog-scheduled-post] Désync détectée pour le post ${postId}`)

    // ── Étape 3 : Marquer FAILED ──────────────────────────────────────────────
    // Condition atomique `status: 'SCHEDULED'` pour éviter une race condition
    // si publishScheduledPost termine exactement au même moment.
    await step.run('marquer-failed', async () => {
      return prisma.post.update({
        where: {
          id: postId,
          status: 'SCHEDULED', // évite d'écraser un PUBLISHED ou FAILED concurrent
        },
        data: {
          status: 'FAILED',
          failureReason:
            "Publication non effectuée — la tâche Inngest a échoué (problème réseau ou configuration). Re-planifie ce post depuis /compose.",
        },
      })
    })

    return { synced: true, postId }
  },
)
