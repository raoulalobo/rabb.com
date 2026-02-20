/**
 * @file modules/auth/hooks/useSession.ts
 * @module auth
 * @description Hook wrapper autour de better-auth useSession.
 *   Fournit un accès typé à la session et à l'utilisateur courant.
 *   À utiliser uniquement dans les Client Components.
 *
 * @example
 *   const { user, isLoading, isAuthenticated } = useSession()
 *   if (isLoading) return <Spinner />
 *   if (!isAuthenticated) return <LoginPrompt />
 */

'use client'

import type { AuthUser } from '@/lib/auth'
import { useSession as useBetterAuthSession } from '@/lib/auth-client'


// ─── Types ────────────────────────────────────────────────────────────────────

interface UseSessionReturn {
  /** Données de l'utilisateur connecté, null si non connecté */
  user: AuthUser | null
  /** Vrai pendant la récupération de la session (premier rendu) */
  isLoading: boolean
  /** Vrai si l'utilisateur est authentifié */
  isAuthenticated: boolean
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Accède à la session et à l'utilisateur courant depuis un Client Component.
 * Wrapper typé autour de better-auth useSession.
 *
 * @returns Objet avec l'utilisateur, l'état de chargement et l'état d'auth
 *
 * @example
 *   const { user, isLoading } = useSession()
 *   if (isLoading) return <Skeleton />
 *   return <p>Bonjour {user?.name}</p>
 */
export function useSession(): UseSessionReturn {
  const { data: session, isPending } = useBetterAuthSession()

  return {
    user: session?.user ?? null,
    isLoading: isPending,
    isAuthenticated: !!session?.user,
  }
}
