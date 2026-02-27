/**
 * @file lib/auth.ts
 * @description Configuration better-auth pour ogolong.com.
 *   Providers : email/password (avec vérification email) + Google OAuth.
 *   Persistance : adaptateur Prisma → Supabase PostgreSQL.
 *   Emails transactionnels : Plunk + React Email (vérification email + reset mot de passe).
 *
 *   Comportements conditionnels selon l'environnement :
 *   - Google OAuth : activé uniquement si GOOGLE_CLIENT_ID/SECRET sont définis
 *   - Emails Plunk : envoi via plunk.emails.send() avec HTML rendu par React Email
 *
 *   Hooks de base de données :
 *   - Après inscription → création automatique des NotificationPrefs par défaut
 *
 *   Note : le workspace Late (lateWorkspaceId) n'est plus créé à l'inscription.
 *   Il est créé à la demande (lazy) lors du premier connectPlatform().
 *   → Évite de consommer des ressources Late pour les utilisateurs inactifs.
 *
 * @see https://better-auth.com/docs
 * @see https://docs.useplunk.com/api-reference/transactional
 */

import { betterAuth } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'

import { prisma } from '@/lib/prisma'
import { sendPasswordResetEmail, sendVerificationEmail } from '@/lib/plunk'

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Vrai si Google OAuth est configuré (les deux clés sont présentes) */
const hasGoogleOAuth =
  !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET

// ─── Config ───────────────────────────────────────────────────────────────────

export const auth = betterAuth({
  // ─── Adaptateur base de données ───────────────────────────────────────────
  database: prismaAdapter(prisma, {
    provider: 'postgresql',
  }),

  // ─── Email & Mot de passe ─────────────────────────────────────────────────
  emailAndPassword: {
    enabled: true,
    /**
     * sendResetPassword : appelé par better-auth quand l'utilisateur soumet
     * "Mot de passe oublié" (POST /api/auth/request-password-reset).
     * Le paramètre `url` contient le lien complet avec token, valide 1h.
     *
     * @param user - Objet utilisateur better-auth
     * @param url  - Lien de reset complet (ex: http://localhost:3000/reset-password?token=...)
     */
    sendResetPassword: async ({ user, url }: { user: { email: string; name: string }; url: string }) => {
      await sendPasswordResetEmail({ email: user.email, url, name: user.name })
    },
  },

  // ─── Vérification email ───────────────────────────────────────────────────
  emailVerification: {
    /**
     * sendOnSignUp : déclenche l'envoi de l'email de vérification automatiquement
     * après chaque inscription email/password.
     */
    sendOnSignUp: true,
    /**
     * autoSignInAfterVerification : connecte automatiquement l'utilisateur après
     * qu'il ait cliqué sur le lien de vérification, sans repasser par le login.
     */
    autoSignInAfterVerification: true,
    /**
     * sendVerificationEmail : appelé par better-auth pour envoyer le lien de
     * confirmation d'email. Le paramètre `url` contient le lien complet avec token.
     *
     * @param user - Objet utilisateur better-auth
     * @param url  - Lien de vérification (ex: http://localhost:3000/api/auth/verify-email?token=...)
     */
    sendVerificationEmail: async ({ user, url }: { user: { email: string; name: string }; url: string }) => {
      await sendVerificationEmail({ email: user.email, url, name: user.name })
    },
  },

  // ─── OAuth Google (conditionnel) ──────────────────────────────────────────
  // Activé uniquement si GOOGLE_CLIENT_ID et GOOGLE_CLIENT_SECRET sont définis.
  // Évite le warning better-auth "Social provider google is missing clientId".
  ...(hasGoogleOAuth && {
    socialProviders: {
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      },
    },
  }),

  // ─── Session ──────────────────────────────────────────────────────────────
  session: {
    // Durée de vie d'une session : 30 jours
    expiresIn: 60 * 60 * 24 * 30,
    // Renouvellement du cookie de session : 1 fois par jour
    updateAge: 60 * 60 * 24,
    // Cache du cookie pour réduire les lectures DB (stratégie compacte)
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5,
    },
  },

  // ─── Hooks base de données ────────────────────────────────────────────────
  databaseHooks: {
    user: {
      create: {
        /**
         * Après la création d'un utilisateur, crée ses préférences de notifications
         * avec les valeurs par défaut (emailOnFailure: true, emailWeeklyRecap: true).
         *
         * Note : lateWorkspaceId reste null à ce stade — le workspace Late est créé
         * à la demande (lazy) lors du premier connectPlatform() dans
         * modules/platforms/actions/connect-platform.action.ts.
         *
         * @param user - L'utilisateur nouvellement créé
         */
        after: async (user) => {
          await prisma.notificationPrefs.create({
            data: {
              userId: user.id,
              emailOnFailure: true,
              emailWeeklyRecap: true,
            },
          })
        },
      },
    },
  },
})

// ─── Types inférés ────────────────────────────────────────────────────────────

/** Type de session tel qu'inféré par better-auth */
export type Session = typeof auth.$Infer.Session

/** Type utilisateur tel qu'inféré par better-auth */
export type AuthUser = typeof auth.$Infer.Session.user
