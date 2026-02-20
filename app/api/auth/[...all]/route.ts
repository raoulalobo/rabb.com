/**
 * @file app/api/auth/[...all]/route.ts
 * @description Route handler universel pour better-auth.
 *   Gère toutes les requêtes d'authentification :
 *   - POST /api/auth/sign-in/email         → connexion email/password
 *   - POST /api/auth/sign-up/email         → inscription
 *   - POST /api/auth/sign-out              → déconnexion
 *   - GET  /api/auth/callback/google       → callback OAuth Google
 *   - GET  /api/auth/get-session           → récupération de la session courante
 *   - POST /api/auth/forget-password       → demande de reset password
 *   - POST /api/auth/reset-password        → reset password avec token
 *   - POST /api/auth/send-verification-email → renvoi de l'email de vérification
 *
 *   Le handler est généré automatiquement par better-auth via toNextJsHandler.
 */

import { toNextJsHandler } from 'better-auth/next-js'

import { auth } from '@/lib/auth'

/**
 * Handlers GET et POST pour toutes les routes better-auth.
 * Next.js App Router exporte les méthodes HTTP nommément.
 */
export const { GET, POST } = toNextJsHandler(auth)
