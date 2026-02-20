/**
 * @file store/app.store.ts
 * @description Store Zustand global de l'application (cross-modules).
 *   Gère l'état UI global : sidebar ouverte/fermée, thème, etc.
 *   Ce store ne contient pas de logique de fetch (déléguée à TanStack Query).
 *
 * @example
 *   // Dans un composant Client :
 *   const { isSidebarOpen, toggleSidebar } = useAppStore()
 */

import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'

// ─── Types ────────────────────────────────────────────────────────────────────

interface AppState {
  /** Sidebar ouverte (desktop) ou réduite */
  isSidebarOpen: boolean
  /** Ouvre ou ferme la sidebar */
  toggleSidebar: () => void
  /** Force l'état de la sidebar */
  setSidebarOpen: (open: boolean) => void
}

// ─── Store ────────────────────────────────────────────────────────────────────

/**
 * Store global de l'application.
 * Utilise Immer pour les mutations immuables lisibles (cf. CLAUDE.md §5.2).
 *
 * @returns Instance du store Zustand avec état et actions
 */
export const useAppStore = create<AppState>()(
  immer((set) => ({
    // ── État initial ───────────────────────────────────────────────────────
    isSidebarOpen: true,

    // ── Actions ───────────────────────────────────────────────────────────

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
  }))
)
