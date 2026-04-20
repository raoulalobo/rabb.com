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
 *
 * baseURL strategy :
 * - En production : NEXT_PUBLIC_APP_URL (ex: https://socialtdl.net)
 * - En dev (navigateur) : window.location.origin → s'adapte automatiquement
 *   que l'on accède via localhost:3000 ou via l'IP LAN (10.x.x.x:3000),
 *   ce qui évite les erreurs "Failed to fetch" depuis un autre appareil.
 * - En dev (SSR/build) : fallback localhost:3000 (window n'existe pas)
 */
export const authClient = createAuthClient({
  baseURL:
    process.env.NEXT_PUBLIC_APP_URL ??
    (typeof window !== 'undefined'
      ? window.location.origin
      : 'http://localhost:3000'),
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
