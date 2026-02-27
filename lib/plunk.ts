/**
 * @file lib/plunk.ts
 * @description Client Plunk singleton pour l'envoi d'emails transactionnels.
 *   Plunk est utilisé pour :
 *   - La vérification d'email lors de l'inscription
 *   - La réinitialisation de mot de passe
 *
 *   Les templates sont des composants React Email rendus en HTML côté serveur
 *   via @react-email/render, puis passés à plunk.emails.send({ body: html }).
 *
 * @see https://docs.useplunk.com/api-reference/transactional
 * @see https://docs.useplunk.com/guides/react-email
 *
 * @example
 *   import { sendVerificationEmail, sendPasswordResetEmail } from '@/lib/plunk'
 *   await sendVerificationEmail({ email: 'user@ex.com', url: 'https://...', name: 'Marie' })
 */

import Plunk from '@plunk/node'
import { render } from '@react-email/render'

import { ResetPasswordEmail } from '@/emails/ResetPasswordEmail'
import { VerificationEmail } from '@/emails/VerificationEmail'

// ─── Singleton ────────────────────────────────────────────────────────────────

/**
 * Instance singleton du client Plunk (serveur uniquement).
 * Utilise la clé secrète PLUNK_SECRET_KEY — jamais exposée côté client.
 */
const plunk = new Plunk(process.env.PLUNK_SECRET_KEY ?? '')

// ─── Types ────────────────────────────────────────────────────────────────────

interface EmailParams {
  /** Adresse email du destinataire */
  email: string
  /** URL complète avec token générée par better-auth */
  url: string
  /** Nom d'affichage de l'utilisateur (optionnel) */
  name?: string
}

// ─── Envoi d'emails ───────────────────────────────────────────────────────────

/**
 * Envoie l'email de vérification d'adresse email.
 * Déclenché par better-auth après l'inscription (emailVerification.sendOnSignUp).
 * Le template React Email est rendu en HTML avant envoi via Plunk.
 *
 * @param params.email - Email du destinataire
 * @param params.url   - Lien de vérification (ex: https://ogolong.com/api/auth/verify-email?token=...)
 * @param params.name  - Prénom affiché dans le template (optionnel)
 *
 * @example
 *   await sendVerificationEmail({
 *     email: 'marie@exemple.fr',
 *     url: 'https://ogolong.com/api/auth/verify-email?token=abc123',
 *     name: 'Marie',
 *   })
 */
export async function sendVerificationEmail({ email, url, name }: EmailParams): Promise<void> {
  // Rendu du template React Email en HTML statique
  const html = await render(VerificationEmail({ url, name }))

  const result = await plunk.emails.send({
    to: email,
    subject: 'Confirme ton adresse email — ogolong',
    body: html,
  })

  if (!result.success) {
    console.error('[Plunk] Échec envoi email de vérification :', result)
  }
}

/**
 * Envoie l'email de réinitialisation de mot de passe.
 * Déclenché par better-auth via emailAndPassword.sendResetPassword.
 * Le token est valide 1 heure par défaut (configurable via resetPasswordTokenExpiresIn).
 *
 * @param params.email - Email du destinataire
 * @param params.url   - Lien de reset (ex: https://ogolong.com/reset-password?token=...)
 * @param params.name  - Prénom affiché dans le template (optionnel)
 *
 * @example
 *   await sendPasswordResetEmail({
 *     email: 'marie@exemple.fr',
 *     url: 'https://ogolong.com/reset-password?token=xyz789',
 *     name: 'Marie',
 *   })
 */
export async function sendPasswordResetEmail({ email, url, name }: EmailParams): Promise<void> {
  // Rendu du template React Email en HTML statique
  const html = await render(ResetPasswordEmail({ url, name }))

  const result = await plunk.emails.send({
    to: email,
    subject: 'Réinitialise ton mot de passe — ogolong',
    body: html,
  })

  if (!result.success) {
    console.error('[Plunk] Échec envoi email de reset :', result)
  }
}
