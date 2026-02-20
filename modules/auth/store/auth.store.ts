/**
 * @file modules/auth/store/auth.store.ts
 * @module auth
 * @description Store Zustand pour l'état d'interface des flux d'authentification.
 *   Gère uniquement l'état UI (chargement, erreurs) — PAS la session.
 *   La session est gérée par better-auth via authClient.useSession().
 *
 * @example
 *   const { isLoading, error, setLoading, setError, reset } = useAuthStore()
 */

import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'

// ─── Types ────────────────────────────────────────────────────────────────────

interface AuthState {
  /** Indique si une opération d'auth est en cours (login, register, reset) */
  isLoading: boolean
  /** Message d'erreur affiché sous le formulaire (null = pas d'erreur) */
  error: string | null
  /** Démarre l'état de chargement */
  setLoading: (loading: boolean) => void
  /** Définit le message d'erreur */
  setError: (error: string | null) => void
  /** Réinitialise l'état (après navigation ou succès) */
  reset: () => void
}

// ─── Store ────────────────────────────────────────────────────────────────────

/**
 * Store d'état UI pour les flux d'authentification.
 * Utilise Immer pour les mutations immuables lisibles (cf. CLAUDE.md §5.2).
 *
 * @returns Instance du store avec état et actions
 */
export const useAuthStore = create<AuthState>()(
  immer((set) => ({
    // ── État initial ───────────────────────────────────────────────────────
    isLoading: false,
    error: null,

    // ── Actions ───────────────────────────────────────────────────────────

    /** Active ou désactive l'indicateur de chargement */
    setLoading: (loading) =>
      set((state) => {
        state.isLoading = loading
      }),

    /** Définit ou efface le message d'erreur */
    setError: (error) =>
      set((state) => {
        state.error = error
      }),

    /** Remet l'état à zéro (à appeler après navigation ou succès) */
    reset: () =>
      set((state) => {
        state.isLoading = false
        state.error = null
      }),
  }))
)
