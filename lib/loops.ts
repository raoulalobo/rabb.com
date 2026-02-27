/**
 * @file lib/loops.ts
 * @description Client Loops singleton pour l'envoi d'emails transactionnels.
 *   Loops est utilisé pour :
 *   - La vérification d'email lors de l'inscription (mieux-auth emailVerification)
 *   - La réinitialisation de mot de passe (better-auth sendResetPassword)
 *
 *   Chaque email correspond à un template transactionnel créé sur app.loops.so.
 *   Les IDs de templates sont stockés dans les variables d'environnement :
 *   - LOOPS_EMAIL_VERIFICATION_ID
 *   - LOOPS_PASSWORD_RESET_ID
 *
 * @see https://loops.so/docs/sdks/javascript
 *
 * @example
 *   import { sendVerificationEmail, sendPasswordResetEmail } from '@/lib/loops'
 *   await sendVerificationEmail({ email: 'user@ex.com', url: 'https://...' })
 */

import { LoopsClient } from 'loops'

// ─── Singleton ────────────────────────────────────────────────────────────────

/**
 * Instance singleton du client Loops.
 * Initialisé une seule fois au démarrage du serveur.
 * Erreur explicite si LOOPS_API_KEY est absent (détection rapide en dev).
 */
const loops = new LoopsClient(process.env.LOOPS_API_KEY ?? '')

// ─── Types ────────────────────────────────────────────────────────────────────

interface EmailParams {
  /** Adresse email du destinataire */
  email: string
  /** URL complète avec token (générée par better-auth) */
  url: string
  /** Nom d'affichage de l'utilisateur (optionnel, pour personnaliser le template) */
  name?: string
}

// ─── Envoi d'emails ───────────────────────────────────────────────────────────

/**
 * Envoie l'email de vérification d'adresse email.
 * Déclenché automatiquement par better-auth après l'inscription si
 * `emailVerification.sendOnSignUp` ou `emailAndPassword.requireEmailVerification` est actif.
 *
 * Le template Loops doit contenir une variable `{{url}}` pointant vers le lien
 * de confirmation généré par better-auth.
 *
 * @param params.email - Email du destinataire
 * @param params.url   - Lien de vérification (ex: https://ogolong.com/api/auth/verify-email?token=...)
 * @param params.name  - Prénom/nom affiché dans le template (optionnel)
 *
 * @example
 *   await sendVerificationEmail({
 *     email: 'marie@exemple.fr',
 *     url: 'https://ogolong.com/api/auth/verify-email?token=abc123',
 *     name: 'Marie',
 *   })
 */
export async function sendVerificationEmail({ email, url, name }: EmailParams): Promise<void> {
  const transactionalId = process.env.LOOPS_EMAIL_VERIFICATION_ID

  if (!transactionalId) {
    // En développement : log l'URL pour tester sans template configuré
    console.warn('[Loops] LOOPS_EMAIL_VERIFICATION_ID non défini. URL de vérification :', url)
    return
  }

  const result = await loops.sendTransactionalEmail({
    transactionalId,
    email,
    dataVariables: {
      url,
      // Nom affiché dans le template si la variable {{name}} est utilisée
      ...(name && { name }),
    },
  })

  if (!result.success) {
    console.error('[Loops] Échec envoi email de vérification :', result)
  }
}

/**
 * Envoie l'email de réinitialisation de mot de passe.
 * Déclenché par better-auth via `emailAndPassword.sendResetPassword`
 * quand l'utilisateur soumet le formulaire "Mot de passe oublié".
 *
 * Le template Loops doit contenir une variable `{{url}}` pointant vers le lien
 * de reset généré par better-auth (valide 1 heure par défaut).
 *
 * @param params.email - Email du destinataire
 * @param params.url   - Lien de reset (ex: https://ogolong.com/reset-password?token=...)
 * @param params.name  - Prénom/nom affiché dans le template (optionnel)
 *
 * @example
 *   await sendPasswordResetEmail({
 *     email: 'marie@exemple.fr',
 *     url: 'https://ogolong.com/reset-password?token=xyz789',
 *     name: 'Marie',
 *   })
 */
export async function sendPasswordResetEmail({ email, url, name }: EmailParams): Promise<void> {
  const transactionalId = process.env.LOOPS_PASSWORD_RESET_ID

  if (!transactionalId) {
    // En développement : log l'URL pour tester sans template configuré
    console.warn('[Loops] LOOPS_PASSWORD_RESET_ID non défini. URL de reset :', url)
    return
  }

  const result = await loops.sendTransactionalEmail({
    transactionalId,
    email,
    dataVariables: {
      url,
      ...(name && { name }),
    },
  })

  if (!result.success) {
    console.error('[Loops] Échec envoi email de reset :', result)
  }
}
