/**
 * @file modules/analytics/hooks/useAnalytics.ts
 * @module analytics
 * @description Hook principal du module analytics.
 *   Agrège toutes les queries TanStack Query en un seul hook.
 *   Lit les filtres depuis analyticsStore (Zustand) et les passe aux queries.
 *
 *   Utilise `placeholderData: keepPreviousData` sur chaque query pour conserver
 *   l'ancien contenu visible lors d'un changement de filtre (pas de skeleton flash).
 *   `isLoading` = premier chargement uniquement (aucune donnée en cache).
 *   `isFetching` = rechargement en cours (filtre changé, données précédentes visibles).
 *
 * @example
 *   const { analyticsPosts, dailyMetrics, isLoading, isFetching } = useAnalytics()
 *   if (isLoading) return <Skeleton />
 *   // isFetching → afficher un indicateur discret sans masquer le contenu
 *   analyticsPosts?.posts.forEach(p => console.log(p.metrics.engagementRate))
 */

'use client'

import { keepPreviousData, useQueries } from '@tanstack/react-query'

import {
  analyticsKeys,
  fetchAnalyticsPosts,
  fetchBestTime,
  fetchContentDecay,
  fetchDailyMetrics,
  fetchFollowerStats,
  fetchPostingFrequency,
} from '@/modules/analytics/queries/analytics.queries'
import { useAnalyticsStore } from '@/modules/analytics/store/analytics.store'
import type {
  AnalyticsListResponse,
  BestTimeResponse,
  ContentDecayResponse,
  DailyMetricsResponse,
  FollowerStatsResponse,
  PostingFrequencyResponse,
} from '@/modules/analytics/types'

// ─── Types retournés ──────────────────────────────────────────────────────────

export interface UseAnalyticsReturn {
  /** Posts avec leurs métriques (MetricsPanel, PostDetailsGrid, TopPerformingPosts) */
  analyticsPosts: AnalyticsListResponse | undefined
  /** Métriques agrégées par jour (ActivityHeatmap, MetricsPanel bar chart) */
  dailyMetrics: DailyMetricsResponse | undefined
  /** Historique des followers (FollowersChart) */
  followerStats: FollowerStatsResponse | undefined
  /** Meilleurs créneaux de publication (BestTimeHeatmap) */
  bestTime: BestTimeResponse | undefined
  /** Décroissance de performance (ContentDecay) */
  contentDecay: ContentDecayResponse | undefined
  /** Fréquence de publication vs engagement (PostingFrequency) */
  postingFrequency: PostingFrequencyResponse | undefined
  /** Vrai si au moins une query est en chargement initial (aucune donnée en cache) */
  isLoading: boolean
  /** Vrai si au moins une query re-fetche (filtre changé, données précédentes toujours visibles) */
  isFetching: boolean
  /** Vrai si toutes les queries ont réussi */
  isSuccess: boolean
  /** Erreur de la première query en échec (ou undefined) */
  error: Error | null
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Hook principal analytics : agrège 6 queries TanStack en un seul appel.
 * Lit les filtres (platform, dateRange) depuis le store Zustand.
 * Toutes les queries sont parallèles (useQueries).
 *
 * @returns Données de toutes les sections analytics + états de chargement
 *
 * @example
 *   function AnalyticsContent() {
 *     const { dailyMetrics, followerStats, isLoading } = useAnalytics()
 *     if (isLoading) return <AnalyticsSkeleton />
 *     return <FollowersChart data={followerStats} />
 *   }
 */
export function useAnalytics(): UseAnalyticsReturn {
  // Abonnement explicite à dateRange pour déclencher un re-render quand la période change
  const { platform, dateRange, getFromDate } = useAnalyticsStore()

  // Paramètres communs à toutes les queries (recalculés à chaque changement de période)
  const from = getFromDate()
  const platformParam = platform === 'all' ? undefined : platform

  // ── Toutes les queries en parallèle ──────────────────────────────────────
  const results = useQueries({
    queries: [
      // 0 — Posts analytics
      {
        queryKey: analyticsKeys.posts({ from, platform: platformParam }),
        queryFn: () => fetchAnalyticsPosts({ from, platform: platformParam }),
        staleTime: 60 * 60 * 1000, // 1h (données mises en cache par Late)
        // Conserve les données précédentes pendant le re-fetch → pas de flash skeleton au changement de filtre
        placeholderData: keepPreviousData,
      },
      // 1 — Daily metrics
      {
        queryKey: analyticsKeys.dailyMetrics({ from, platform: platformParam }),
        queryFn: () => fetchDailyMetrics({ from, platform: platformParam }),
        staleTime: 60 * 60 * 1000,
        placeholderData: keepPreviousData,
      },
      // 2 — Follower stats (dateRange dans la key pour invalider le cache au changement)
      {
        queryKey: analyticsKeys.followerStats({ from, platform: platformParam }),
        queryFn: () => fetchFollowerStats({ from, platform: platformParam }),
        staleTime: 60 * 60 * 1000,
        placeholderData: keepPreviousData,
      },
      // 3 — Best time (pas de filtre date — basé sur tout l'historique)
      {
        queryKey: analyticsKeys.bestTime({ platform: platformParam }),
        queryFn: () => fetchBestTime({ platform: platformParam }),
        staleTime: 24 * 60 * 60 * 1000,
        placeholderData: keepPreviousData,
      },
      // 4 — Content decay
      {
        queryKey: analyticsKeys.contentDecay({ platform: platformParam }),
        queryFn: () => fetchContentDecay({ platform: platformParam }),
        staleTime: 24 * 60 * 60 * 1000,
        placeholderData: keepPreviousData,
      },
      // 5 — Posting frequency
      {
        queryKey: analyticsKeys.postingFrequency({ platform: platformParam }),
        queryFn: () => fetchPostingFrequency({ platform: platformParam }),
        staleTime: 24 * 60 * 60 * 1000,
        placeholderData: keepPreviousData,
      },
    ],
  })

  const [postsQ, dailyQ, followersQ, bestTimeQ, decayQ, freqQ] = results

  return {
    analyticsPosts: postsQ.data,
    dailyMetrics: dailyQ.data,
    followerStats: followersQ.data,
    bestTime: bestTimeQ.data,
    contentDecay: decayQ.data,
    postingFrequency: freqQ.data,
    // isPending = true uniquement au premier chargement (aucune donnée en cache ni placeholder)
    isLoading: results.some((r) => r.isPending),
    // isFetching = true dès qu'une query est en vol (initial ET re-fetch après changement de filtre)
    isFetching: results.some((r) => r.isFetching),
    isSuccess: results.every((r) => r.isSuccess),
    error: (results.find((r) => r.error)?.error as Error | null) ?? null,
  }
}
