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
 *   - INNGEST_SIGNING_KEY : clé pour valider les webhooks entrants
 *
 * @see https://www.inngest.com/docs/sdk/serve
 */

import { serve } from 'inngest/next'

import { inngest } from '@/lib/inngest/client'
import { handlePostFailure } from '@/lib/inngest/functions/handle-post-failure'
import { publishScheduledPost } from '@/lib/inngest/functions/publish-scheduled-post'

/**
 * Handler Inngest exposant toutes les fonctions déclarées.
 * GET  : connexion de l'Inngest Dashboard (introspection des fonctions)
 * POST : réception des événements entrants
 * PUT  : synchronisation des fonctions avec le Dashboard Inngest
 */
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    // Publie un post à la date planifiée via getlate.dev
    publishScheduledPost,
    // Gère les échecs après épuisement des retries → post FAILED + email
    handlePostFailure,
  ],
})
