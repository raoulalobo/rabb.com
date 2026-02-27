/**
 * @file modules/analytics/store/analytics.store.ts
 * @module analytics
 * @description Store Zustand pour les filtres de la page analytics.
 *   Gère : plateforme filtrée, fenêtre temporelle, tri.
 *   Utilisé par AnalyticsFilters (UI) et useAnalytics (queries).
 *
 * @example
 *   const { platform, setDateRange } = useAnalyticsStore()
 *   setDateRange('30d') // → toutes les queries se recalculent
 */

import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'

import type { AnalyticsFiltersState } from '@/modules/analytics/types'
import { dateRangeToFrom } from '@/modules/analytics/types'

// ─── Interface du store ───────────────────────────────────────────────────────

interface AnalyticsStore extends AnalyticsFiltersState {
  // ── Actions ──────────────────────────────────────────────────────────────
  /** Définit la plateforme filtrée ("all" = toutes) */
  setPlatform: (platform: string) => void
  /** Définit la fenêtre temporelle */
  setDateRange: (range: '7d' | '30d' | '90d' | '180d') => void
  /** Définit le critère de tri */
  setSortBy: (sortBy: 'newest' | 'engagement' | 'views') => void

  // ── Computed ─────────────────────────────────────────────────────────────
  /**
   * Retourne la date de début calculée depuis dateRange.
   * Utilisée dans les appels API comme paramètre `from`.
   *
   * @example
   *   const { getFromDate } = useAnalyticsStore()
   *   const from = getFromDate() // → "2026-01-28T00:00:00.000Z" (si dateRange='30d')
   */
  getFromDate: () => string
}

// ─── Implémentation ───────────────────────────────────────────────────────────

/**
 * Store des filtres analytics.
 * Valeurs initiales : toutes les plateformes, 30 derniers jours, tri par date.
 */
export const useAnalyticsStore = create<AnalyticsStore>()(
  immer((set, get) => ({
    // ── État initial ────────────────────────────────────────────────────────
    platform: 'all',
    dateRange: '30d',
    sortBy: 'newest',

    // ── Actions ─────────────────────────────────────────────────────────────
    setPlatform: (platform) =>
      set((state) => {
        state.platform = platform
      }),

    setDateRange: (range) =>
      set((state) => {
        state.dateRange = range
      }),

    setSortBy: (sortBy) =>
      set((state) => {
        state.sortBy = sortBy
      }),

    // ── Computed ─────────────────────────────────────────────────────────────
    getFromDate: () => dateRangeToFrom(get().dateRange),
  }))
)
