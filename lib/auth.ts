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

  // ─── Rate limiting better-auth ────────────────────────────────────────────
  // Protection des endpoints /api/auth/* contre le brute-force (login, register, reset).
  // Stockage in-memory (par défaut) : suffisant pour l'auth car les tentatives proviennent
  // en général d'une même instance. Pour un multi-instance strict, utiliser 'database'.
  rateLimit: {
    enabled: true,
    // Fenêtre de 15 minutes : aligne sur les recommandations OWASP pour l'anti brute-force
    window: 60 * 15,
    // 10 requêtes max par fenêtre de 15 min — bloque les attaques par dictionnaire
    max: 10,
  },

  // ─── Session ──────────────────────────────────────────────────────────────
  session: {
    /**
     * Durée de vie de la session : 48 heures (fenêtre glissante).
     * Si l'utilisateur est actif, la session est automatiquement prolongée de 48h
     * à chaque fois que le seuil `updateAge` est franchi.
     * Si l'utilisateur est inactif pendant 48h, la session expire définitivement.
     *
     * Ancienne valeur : 30 jours — trop longue pour un SaaS (surface d'attaque élevée
     * si un token de session est compromis).
     */
    expiresIn: 60 * 60 * 48,

    /**
     * Seuil de rotation de session : 1 heure.
     * Lorsqu'une requête arrive et que `now - session.updatedAt > updateAge`,
     * better-auth génère un nouveau token de session (rotation), invalide l'ancien,
     * et reporte l'expiration de 48h à partir de maintenant.
     *
     * Effet glissant : tant que l'utilisateur fait au moins une requête par heure,
     * sa session ne expire jamais. S'il disparaît > 48h, elle expire.
     *
     * Ancienne valeur : 24h — rotation trop rare, fenêtre d'exploitation trop large
     * en cas de vol de cookie.
     */
    updateAge: 60 * 60,

    /**
     * Cache du cookie de session : 5 minutes.
     * Better-auth signe et stocke les données de session directement dans le cookie
     * (en plus de la DB) pour éviter une lecture Supabase/Prisma à chaque requête.
     * Toutes les 5 minutes, le cookie cache est expiré et la session est re-validée
     * en base → équilibre entre performance et fraîcheur des données.
     */
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
