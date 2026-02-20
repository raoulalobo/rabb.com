/**
 * @file lib/resend.ts
 * @description Client Resend singleton pour l'envoi d'emails transactionnels.
 *   Toutes les interactions avec Resend passent par ce fichier.
 *   Ne jamais instancier Resend directement dans les fonctions Inngest ou Server Actions.
 *
 *   ⚠️  Utilise une initialisation lazy (via getResend()) pour éviter que
 *   `new Resend(undefined)` plante à l'évaluation du module lors du build Next.js,
 *   quand RESEND_API_KEY n'est pas défini dans l'environnement de build.
 *
 * @example
 *   import { getResend } from '@/lib/resend'
 *   await getResend().emails.send({
 *     from: process.env.RESEND_FROM_EMAIL!,
 *     to: 'user@example.com',
 *     subject: 'Bienvenue sur rabb',
 *     react: <WelcomeEmail name="Marie" />,
 *   })
 */

import { Resend } from 'resend'

/** Instance singleton Resend — initialisée au premier appel de getResend() */
let _resend: Resend | null = null

/**
 * Retourne l'instance singleton du client Resend.
 * Instancie le client au premier appel (lazy) pour éviter les erreurs de build
 * quand RESEND_API_KEY n'est pas disponible dans l'environnement de compilation.
 *
 * @returns Instance Resend prête à l'emploi
 *
 * @example
 *   const result = await getResend().emails.send({ from, to, subject, react })
 */
export function getResend(): Resend {
  if (!_resend) {
    // Instanciation reportée au premier appel (runtime uniquement)
    _resend = new Resend(process.env.RESEND_API_KEY)
  }

  return _resend
}
