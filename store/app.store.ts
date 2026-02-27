/**
 * @file store/app.store.ts
 * @description Store Zustand global de l'application (cross-modules).
 *   Gère l'état UI global (sidebar) et les préférences utilisateur persistées.
 *   Ce store ne contient pas de logique de fetch (déléguée à TanStack Query).
 *
 *   Persistance :
 *   Le middleware `persist` sauvegarde uniquement les préférences utilisateur
 *   dans localStorage (clé "ogolong-app-preferences"). L'état UI transitoire
 *   (isSidebarOpen) n'est PAS persisté — il se réinitialise à chaque session.
 *
 * @example
 *   // Dans un composant Client :
 *   const { isSidebarOpen, toggleSidebar } = useAppStore()
 *   const { speechSilenceTimeoutMs, setSpeechSilenceTimeout } = useAppStore()
 */

import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { persist, createJSONStorage } from 'zustand/middleware'

// ─── Types ────────────────────────────────────────────────────────────────────

interface AppState {
  // ── État UI transitoire (non persisté) ───────────────────────────────────

  /**
   * Contrôle l'ouverture du MobileSidebar (Sheet) sur mobile.
   * Sur desktop, la sidebar est toujours visible via CSS (`hidden md:flex`) —
   * cet état n'est utilisé que pour le drawer mobile.
   */
  isSidebarOpen: boolean
  /** Bascule l'état du menu mobile */
  toggleSidebar: () => void
  /** Définit explicitement l'état du menu mobile (ex: fermer après navigation) */
  setSidebarOpen: (open: boolean) => void

  // ── Préférences utilisateur (persistées dans localStorage) ───────────────

  /**
   * Durée de silence (en ms) avant arrêt automatique de la dictée vocale.
   * Configurable par l'utilisateur dans /settings → section "Dictée vocale".
   * Défaut : 5000ms (5 secondes).
   * Plage autorisée : 1000–10000ms (1s à 10s), pas de 1s.
   *
   * @example
   *   speechSilenceTimeoutMs = 5000  // → arrêt après 5s de silence
   */
  speechSilenceTimeoutMs: number
  /**
   * Définit la durée de silence pour la dictée vocale.
   *
   * @param ms - Durée en millisecondes (ex: 3000 pour 3s)
   */
  setSpeechSilenceTimeout: (ms: number) => void
}

// ─── Store ────────────────────────────────────────────────────────────────────

/**
 * Store global de l'application.
 * Compose Immer (mutations lisibles) + Persist (préférences en localStorage).
 *
 * Seule la clé `speechSilenceTimeoutMs` est persistée via `partialize`,
 * car `isSidebarOpen` doit toujours commencer à `false` au démarrage.
 *
 * @returns Instance du store Zustand avec état et actions
 */
export const useAppStore = create<AppState>()(
  persist(
    immer((set) => ({
      // ── État UI initial (non persisté) ──────────────────────────────────

      // false : le Sheet mobile commence fermé (desktop utilise CSS hidden md:flex)
      isSidebarOpen: false,

      /** Inverse l'état de la sidebar (toggle) */
      toggleSidebar: () =>
        set((state) => {
          // Immer : mutation directe → immutabilité garantie en coulisses
          state.isSidebarOpen = !state.isSidebarOpen
        }),

      /** Définit explicitement l'état de la sidebar */
      setSidebarOpen: (open) =>
        set((state) => {
          state.isSidebarOpen = open
        }),

      // ── Préférences utilisateur ──────────────────────────────────────────

      // 5000ms = 5 secondes de silence avant arrêt automatique de la dictée
      speechSilenceTimeoutMs: 5000,

      /** Met à jour la durée de silence et la persiste dans localStorage */
      setSpeechSilenceTimeout: (ms) =>
        set((state) => {
          state.speechSilenceTimeoutMs = ms
        }),
    })),
    {
      // Clé de stockage dans localStorage
      name: 'ogolong-app-preferences',
      storage: createJSONStorage(() => localStorage),
      /**
       * Persiste uniquement les préférences utilisateur.
       * Exclut l'état UI transitoire (isSidebarOpen, toggleSidebar, setSidebarOpen).
       */
      partialize: (state) => ({
        speechSilenceTimeoutMs: state.speechSilenceTimeoutMs,
      }),
    }
  )
)
