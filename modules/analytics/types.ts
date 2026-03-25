/**
 * @file modules/analytics/types.ts
 * @module analytics
 * @description Types TypeScript du module analytics.
 *   Basés sur les réponses des endpoints GET /v1/analytics/* de Zernio.
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

// ─── Types Post Timeline ─────────────────────────────────────────────────────

/**
 * Point de données pour un jour dans la timeline d'un post.
 * Retourné par GET /v1/analytics/post-timeline.
 */
export interface PostTimelineDataPoint {
  date: string
  platform: string
  platformPostId?: string
  impressions: number
  reach: number
  likes: number
  comments: number
  shares: number
  saves: number
  clicks: number
  views: number
}

/**
 * Réponse de GET /api/analytics/post-timeline.
 */
export interface PostTimelineResponse {
  postId: string
  timeline: PostTimelineDataPoint[]
}

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

/**
 * Calcule les bornes de la période précédente (même durée, juste avant).
 * Ex: si dateRange='30d' et aujourd'hui = 2026-03-23 :
 *   - période actuelle  : 2026-02-21 → 2026-03-23
 *   - période précédente : 2026-01-22 → 2026-02-21
 *
 * @param range - Fenêtre temporelle
 * @returns { from, to } en YYYY-MM-DD pour la période précédente
 *
 * @example
 *   getPreviousRange('30d')
 *   // → { from: '2026-01-22', to: '2026-02-21' }
 */
export function getPreviousRange(range: '7d' | '30d' | '90d' | '180d'): { from: string; to: string } {
  const days = parseInt(range, 10)
  const toDate = new Date()
  toDate.setDate(toDate.getDate() - days)
  const fromDate = new Date(toDate)
  fromDate.setDate(fromDate.getDate() - days)
  return {
    from: fromDate.toISOString().slice(0, 10),
    to: toDate.toISOString().slice(0, 10),
  }
}

/** Overview des métriques agrégées (retourné par /api/analytics) */
export interface AnalyticsOverview {
  likes: number
  comments: number
  shares: number
  views: number
  impressions: number
  reach: number
  clicks: number
  engagementRate: number
}
