/**
 * @file lib/auth.ts
 * @description Configuration better-auth pour rabb.com.
 *   Providers : email/password (avec vérification email) + Google OAuth.
 *   Persistance : adaptateur Prisma → Supabase PostgreSQL.
 *
 *   Comportements conditionnels selon l'environnement :
 *   - Google OAuth : activé uniquement si GOOGLE_CLIENT_ID/SECRET sont définis
 *   - Vérification email : désactivée (requireEmailVerification: false)
 *
 *   Hooks de base de données :
 *   - Après inscription → création automatique des NotificationPrefs par défaut
 *
 * @see https://better-auth.com/docs
 */

import { betterAuth } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'

import { LateApiError, late } from '@/lib/late'
import { prisma } from '@/lib/prisma'

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
    // Vérification email désactivée — l'inscription est directement effective.
    // À activer en production avec sendVerificationEmail + Resend.
    requireEmailVerification: false,
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
         * Avant la création d'un utilisateur : crée son workspace Late (conteneur
         * qui regroupera ses comptes sociaux connectés).
         *
         * Deux comportements :
         * - Si Late accepte (200) → injecte `lateWorkspaceId` dans les données
         *   de l'utilisateur, il sera sauvegardé en DB dès la création.
         * - Si Late refuse (403 capacité atteinte) → lève une erreur qui bloque
         *   l'inscription. Le message "LATE_CAPACITY_REACHED" est intercepté
         *   par RegisterForm pour afficher un message clair à l'utilisateur.
         * - Si Late est indisponible (autre erreur) → log + inscription autorisée
         *   sans workspace (le workspace sera créé au premier connect).
         *
         * @param user - Données de l'utilisateur avant insertion en DB
         * @returns Données enrichies avec `lateWorkspaceId`, ou undefined si erreur non bloquante
         */
        before: async (user) => {
          try {
            const workspace = await late.profiles.create({
              name: user.name ?? user.email,
            })
            // Injecter l'ID du workspace Late directement dans l'enregistrement User
            // → sauvegardé en DB en même temps que le user, sans update supplémentaire
            return {
              data: {
                ...user,
                lateWorkspaceId: workspace._id,
              },
            }
          } catch (error) {
            if (error instanceof LateApiError && error.status === 403) {
              // Capacité Late atteinte → bloquer l'inscription
              // Le code "LATE_CAPACITY_REACHED" est reconnu par RegisterForm
              throw new Error('LATE_CAPACITY_REACHED')
            }
            // Autre erreur (réseau, API down…) → ne pas bloquer l'inscription
            // lateWorkspaceId restera null, créé au premier connect
            console.error('[auth] Impossible de créer le workspace Late:', error)
          }
        },

        /**
         * Après la création d'un utilisateur, crée ses préférences de notifications
         * avec les valeurs par défaut (emailOnFailure: true, emailWeeklyRecap: true).
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
