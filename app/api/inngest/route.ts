/**
 * @file app/api/inngest/route.ts
 * @description Route Handler pour le webhook Inngest.
 *   Inngest envoie ses événements ici (GET pour la connexion, POST/PUT pour les events).
 *
 *   ⚠️  Cette route est PUBLIQUE : elle ne doit PAS être protégée par le middleware
 *   d'authentification (proxy.ts). Inngest valide les requêtes avec INNGEST_SIGNING_KEY.
 *
 *   Variables d'environnement requises :
 *   - INNGEST_EVENT_KEY   : clé pour envoyer des events
 *   - INNGEST_SIGNING_KEY : clé pour valider les webhooks entrants (OBLIGATOIRE en prod Vercel)
 *
 * @see https://www.inngest.com/docs/sdk/serve
 */

import { serve } from 'inngest/next'

import { inngest } from '@/lib/inngest/client'
import { handlePostFailure } from '@/lib/inngest/functions/handle-post-failure'
import { publishScheduledPost } from '@/lib/inngest/functions/publish-scheduled-post'
import { watchdogScheduledPost } from '@/lib/inngest/functions/watchdog-scheduled-post'

/**
 * Durée maximale d'exécution Lambda Vercel en secondes.
 * - Hobby plan : 60s max
 * - Pro plan   : 300s max
 *
 * Inngest checkpointe après chaque step.run() donc les fonctions longues
 * (ex: appel Late API > 10s, sleepUntil) ne provoquent pas de timeout :
 * chaque step est une nouvelle invocation Lambda indépendante.
 */
export const maxDuration = 300

/**
 * Handler Inngest exposant toutes les fonctions déclarées.
 * GET  : connexion de l'Inngest Dashboard (introspection des fonctions)
 * POST : réception des événements entrants (signature validée avec INNGEST_SIGNING_KEY)
 * PUT  : synchronisation des fonctions avec le Dashboard Inngest
 */
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    // Publie un post à la date planifiée via getlate.dev
    publishScheduledPost,
    // Gère les échecs après épuisement des retries → post FAILED + email
    handlePostFailure,
    // Watchdog : vérifie 5 min après scheduledFor que le post a bien été publié
    watchdogScheduledPost,
  ],
})
