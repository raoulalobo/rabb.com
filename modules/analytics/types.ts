/**
 * @file modules/analytics/types.ts
 * @module analytics
 * @description Types TypeScript du module analytics.
 *   Basés sur les réponses des endpoints GET /v1/analytics/* de getlate.dev.
 *   Re-exports des types Late pour éviter les imports croisés depuis lib/late.ts.
 */

export type {
  LateAnalyticsPost as AnalyticsPost,
  LateAnalyticsListResponse as AnalyticsListResponse,
  LatePostMetrics as PostMetrics,
  LatePlatformStats as PlatformStats,
  LateDailyMetric as DailyMetric,
  LateDailyMetricsResponse as DailyMetricsResponse,
  LateFollowerDataPoint as FollowerDataPoint,
  LateFollowerStatsResponse as FollowerStatsResponse,
  LateBestTimeSlot as BestTimeSlot,
  LateBestTimeResponse as BestTimeResponse,
  LateContentDecayBucket as ContentDecayBucket,
  LateContentDecayResponse as ContentDecayResponse,
  LatePostingFrequencyData as PostingFrequencyData,
  LatePostingFrequencyResponse as PostingFrequencyResponse,
} from '@/lib/late'

// ─── Types UI spécifiques au module ──────────────────────────────────────────

/**
 * Filtres appliqués sur la page analytics.
 * Gérés par le store Zustand analyticsStore.
 */
export interface AnalyticsFiltersState {
  /** Plateforme filtrée : "all" ou identifiant plateforme (ex: "tiktok") */
  platform: string
  /** Fenêtre temporelle */
  dateRange: '7d' | '30d' | '90d' | '180d'
  /** Tri des posts */
  sortBy: 'newest' | 'engagement' | 'views'
}

/**
 * Métriques affichables dans MetricsPanel.
 * Chaque clé correspond à une checkbox toggle.
 */
export type MetricKey =
  | 'likes'
  | 'comments'
  | 'shares'
  | 'views'
  | 'impressions'
  | 'reach'
  | 'clicks'
  | 'engagementRate'

/** Configuration d'affichage d'une métrique */
export interface MetricConfig {
  key: MetricKey
  label: string
  /** Emoji ou icône de la métrique */
  icon: string
  color: string
}

/**
 * Calcule la date de début selon la fenêtre temporelle.
 * Retourne une date ISO 8601 UTC.
 *
 * @param range - Fenêtre temporelle ('7d' | '30d' | '90d' | '180d')
 * @returns Date ISO 8601 (début de la période)
 *
 * @example
 *   dateRangeToFrom('30d') // → "2026-01-28T00:00:00.000Z"
 */
export function dateRangeToFrom(range: '7d' | '30d' | '90d' | '180d'): string {
  const days = parseInt(range, 10)
  const date = new Date()
  date.setDate(date.getDate() - days)
  // Format YYYY-MM-DD (plus compatible avec l'API Late que ISO complet)
  return date.toISOString().slice(0, 10)
}
