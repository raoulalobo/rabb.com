/**
 * @file lib/inngest/client.ts
 * @description Client Inngest singleton pour ogolong.com.
 *   Toutes les fonctions Inngest et les appels inngest.send() passent par ce fichier.
 *
 *   Configurer les variables d'environnement :
 *   - INNGEST_EVENT_KEY   : clé pour envoyer des events depuis le serveur
 *   - INNGEST_SIGNING_KEY : clé pour valider les webhooks Inngest
 *
 * @example
 *   import { inngest } from '@/lib/inngest/client'
 *
 *   // Envoyer un event depuis une Server Action :
 *   await inngest.send({ name: 'post/schedule', data: { postId: '...', scheduledFor: '...' } })
 *
 *   // Déclarer une fonction Inngest :
 *   export const myFn = inngest.createFunction(...)
 */

import { Inngest } from 'inngest'

/**
 * Instance singleton du client Inngest.
 * L'identifiant 'rabb' correspond à l'app enregistrée dans Inngest Cloud.
 * ⚠️  Ne pas changer cet ID sans re-syncer Inngest (dashboard → Apps → Sync) :
 *     les fnId stockés par Inngest sont préfixés par cet identifiant
 *     (ex: 'rabb-publish-scheduled-post'). Un changement d'ID crée une nouvelle
 *     app dans Inngest et rend tous les runs en cours introuvables.
 *
 * eventKey est passé explicitement pour éviter que l'auto-détection de INNGEST_EVENT_KEY
 * échoue silencieusement sur Vercel (notamment dans les Server Actions où l'env peut être
 * lu différemment selon le contexte d'exécution Edge vs Lambda).
 */
export const inngest = new Inngest({
  id: 'rabb',
  name: 'ogolong.com',
  // Lecture explicite au runtime — garantit que la clé est disponible
  // que le code s'exécute en Lambda Vercel, en local ou via Inngest Dev Server.
  eventKey: process.env.INNGEST_EVENT_KEY,
})

// ─── Types des événements Inngest ─────────────────────────────────────────────

/**
 * Événement déclenché quand un post est planifié.
 * Écouté par la fonction publishScheduledPost.
 */
export interface PostScheduleEvent {
  name: 'post/schedule'
  data: {
    /** ID du post en DB */
    postId: string
    /** Date de publication planifiée (ISO 8601) */
    scheduledFor: string
  }
}
