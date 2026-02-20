/**
 * @file lib/auth-client.ts
 * @description Client better-auth pour les composants côté navigateur (Client Components).
 *   Exporte les méthodes d'authentification et le hook de session.
 *
 *   À utiliser uniquement dans les Client Components ('use client').
 *   Pour les Server Components/Actions, utiliser auth.api.getSession().
 *
 * @example
 *   // Connexion email
 *   import { authClient } from '@/lib/auth-client'
 *   await authClient.signIn.email({ email, password })
 *
 *   // Hook session
 *   const { data: session, isPending } = authClient.useSession()
 */

import { createAuthClient } from 'better-auth/react'

/**
 * Client better-auth singleton pour le navigateur.
 * La baseURL est déduite automatiquement depuis window.location en développement.
 * En production, BETTER_AUTH_URL est utilisé.
 */
export const authClient = createAuthClient({
  // URL de base de l'API d'auth (doit correspondre à BETTER_AUTH_URL)
  baseURL: process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
})

// ─── Exports nommés pour une utilisation directe ──────────────────────────────

/** Hook React pour accéder à la session courante (Client Components uniquement) */
export const { useSession } = authClient

/** Méthodes de connexion : email, social (Google), etc. */
export const { signIn } = authClient

/** Méthode d'inscription email */
export const { signUp } = authClient

/** Méthode de déconnexion */
export const { signOut } = authClient
