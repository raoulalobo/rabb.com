/**
 * @file modules/analytics/queries/analytics.queries.ts
 * @module analytics
 * @description Clés et fetchers TanStack Query pour le module analytics.
 *   Chaque fetcher appelle les API routes proxy correspondantes.
 *   Les query keys sont hiérarchiques pour faciliter l'invalidation ciblée.
 *
 * @example
 *   // Invalider toutes les analytics
 *   queryClient.invalidateQueries({ queryKey: analyticsKeys.all })
 *
 *   // Invalider uniquement les daily metrics
 *   queryClient.invalidateQueries({ queryKey: analyticsKeys.dailyMetrics() })
 */

import type {
  AnalyticsListResponse,
  BestTimeResponse,
  ContentDecayResponse,
  DailyMetricsResponse,
  FollowerStatsResponse,
  PostingFrequencyResponse,
} from '@/modules/analytics/types'

// ─── Query Keys ───────────────────────────────────────────────────────────────

/**
 * Clés de cache TanStack Query pour le module analytics.
 * Structure hiérarchique : all > section > [params]
 */
export const analyticsKeys = {
  /** Toutes les queries analytics (pour invalidation globale) */
  all: ['analytics'] as const,

  /** Posts analytics avec leurs métriques individuelles */
  posts: (params: { from?: string; to?: string; platform?: string }) =>
    ['analytics', 'posts', params] as const,

  /** Métriques agrégées par jour */
  dailyMetrics: (params: { from?: string; to?: string; platform?: string } = {}) =>
    ['analytics', 'daily-metrics', params] as const,

  /** Historique des followers par plateforme */
  followerStats: (params: { from?: string; to?: string; platform?: string } = {}) =>
    ['analytics', 'follower-stats', params] as const,

  /** Meilleurs créneaux de publication */
  bestTime: (params: { platform?: string } = {}) =>
    ['analytics', 'best-time', params] as const,

  /** Décroissance de performance du contenu */
  contentDecay: (params: { platform?: string } = {}) =>
    ['analytics', 'content-decay', params] as const,

  /** Fréquence de publication vs engagement */
  postingFrequency: (params: { platform?: string } = {}) =>
    ['analytics', 'posting-frequency', params] as const,
}

// ─── Fetchers ─────────────────────────────────────────────────────────────────

/**
 * Construit une query string à partir d'un objet de paramètres (sans les undefined/vide).
 * @param params - Paramètres à sérialiser
 * @returns Query string (sans le "?")
 */
function buildQuery(params: Record<string, string | undefined>): string {
  const filtered = Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== '')
  ) as Record<string, string>
  return new URLSearchParams(filtered).toString()
}

/**
 * Récupère la liste des posts avec leurs analytics.
 * Utilisé par MetricsPanel, PostDetailsGrid et TopPerformingPosts.
 */
export async function fetchAnalyticsPosts(params: {
  from?: string
  to?: string
  platform?: string
}): Promise<AnalyticsListResponse> {
  const query = buildQuery(params)
  const res = await fetch(`/api/analytics${query ? `?${query}` : ''}`, {
    // Abandonne la requête après 10s — évite le hang si Late API ne répond pas
    signal: AbortSignal.timeout(10_000),
  })
  if (!res.ok) throw new Error('Impossible de charger les analytics posts')
  return res.json() as Promise<AnalyticsListResponse>
}

/**
 * Récupère les métriques quotidiennes agrégées.
 * Utilisé par ActivityHeatmap et MetricsPanel (bar chart).
 */
export async function fetchDailyMetrics(params: {
  from?: string
  to?: string
  platform?: string
} = {}): Promise<DailyMetricsResponse> {
  const query = buildQuery(params)
  const res = await fetch(`/api/analytics/daily-metrics${query ? `?${query}` : ''}`, {
    // Abandonne la requête après 10s — évite le hang si Late API ne répond pas
    signal: AbortSignal.timeout(10_000),
  })
  if (!res.ok) throw new Error('Impossible de charger les métriques quotidiennes')
  return res.json() as Promise<DailyMetricsResponse>
}

/**
 * Récupère l'historique des followers par plateforme.
 * Utilisé par FollowersChart.
 */
export async function fetchFollowerStats(params: {
  from?: string
  to?: string
  platform?: string
} = {}): Promise<FollowerStatsResponse> {
  const query = buildQuery(params)
  const res = await fetch(`/api/accounts/follower-stats${query ? `?${query}` : ''}`, {
    // Abandonne la requête après 10s — évite le hang si Late API ne répond pas
    signal: AbortSignal.timeout(10_000),
  })
  if (!res.ok) throw new Error('Impossible de charger les stats followers')
  return res.json() as Promise<FollowerStatsResponse>
}

/**
 * Récupère les meilleurs créneaux de publication.
 * Utilisé par BestTimeHeatmap.
 */
export async function fetchBestTime(params: {
  platform?: string
} = {}): Promise<BestTimeResponse> {
  const query = buildQuery(params)
  const res = await fetch(`/api/analytics/best-time${query ? `?${query}` : ''}`, {
    // Abandonne la requête après 10s — évite le hang si Late API ne répond pas
    signal: AbortSignal.timeout(10_000),
  })
  if (!res.ok) throw new Error('Impossible de charger les meilleurs créneaux')
  return res.json() as Promise<BestTimeResponse>
}

/**
 * Récupère la décroissance de performance du contenu.
 * Utilisé par ContentDecay.
 */
export async function fetchContentDecay(params: {
  platform?: string
} = {}): Promise<ContentDecayResponse> {
  const query = buildQuery(params)
  const res = await fetch(`/api/analytics/content-decay${query ? `?${query}` : ''}`, {
    // Abandonne la requête après 10s — évite le hang si Late API ne répond pas
    signal: AbortSignal.timeout(10_000),
  })
  if (!res.ok) throw new Error('Impossible de charger le content decay')
  return res.json() as Promise<ContentDecayResponse>
}

/**
 * Récupère la fréquence de publication vs engagement.
 * Utilisé par PostingFrequency.
 */
export async function fetchPostingFrequency(params: {
  platform?: string
} = {}): Promise<PostingFrequencyResponse> {
  const query = buildQuery(params)
  const res = await fetch(`/api/analytics/posting-frequency${query ? `?${query}` : ''}`, {
    // Abandonne la requête après 10s — évite le hang si Late API ne répond pas
    signal: AbortSignal.timeout(10_000),
  })
  if (!res.ok) throw new Error('Impossible de charger la fréquence de publication')
  return res.json() as Promise<PostingFrequencyResponse>
}
