/**
 * @file modules/dashboard/hooks/useDashboardStats.ts
 * @module dashboard
 * @description Hook TanStack Query pour charger les KPIs de la page /dashboard.
 *
 *   Fetche GET /api/dashboard et retourne :
 *   - postsPublished  : nombre de posts publiés
 *   - postsScheduled  : nombre de posts planifiés
 *   - impressions     : total des impressions (30 derniers jours)
 *   - engagementRate  : taux d'engagement moyen en % (30 derniers jours)
 *
 *   Configuration :
 *   - staleTime 5 min : les stats du dashboard n'ont pas besoin d'être temps-réel
 *   - retry 1 : une seule tentative de retry sur erreur réseau
 *
 * @example
 *   const { data, isLoading } = useDashboardStats()
 *   // data.postsPublished → 12
 *   // data.engagementRate → 4.2
 */

import { useQuery } from '@tanstack/react-query'

import type { DashboardStatsResponse } from '@/app/api/dashboard/route'

// ─── Query Key ────────────────────────────────────────────────────────────────

/** Clé stable pour le cache TanStack Query — partagée pour l'invalidation */
export const dashboardStatsKey = ['dashboard', 'stats'] as const

// ─── Fetcher ──────────────────────────────────────────────────────────────────

/**
 * Charge les KPIs du dashboard depuis /api/dashboard.
 * @throws Error si la réponse HTTP n'est pas 2xx
 */
async function fetchDashboardStats(): Promise<DashboardStatsResponse> {
  const res = await fetch('/api/dashboard', {
    // Abandonne après 10s — évite le hang si Late API ou DB ne répond pas
    signal: AbortSignal.timeout(10_000),
  })
  if (!res.ok) throw new Error('Impossible de charger les statistiques du dashboard')
  return res.json() as Promise<DashboardStatsResponse>
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Retourne les 4 KPIs de la page dashboard.
 *
 * @returns Objet TanStack Query avec :
 *   - `data`      : { postsPublished, postsScheduled, impressions, engagementRate }
 *   - `isLoading` : true pendant le premier chargement
 *   - `isError`   : true si la requête a échoué
 *
 * @example
 *   const { data, isLoading } = useDashboardStats()
 *   if (isLoading) return <DashboardStatsSkeleton />
 *   return <p>{data.postsPublished} posts publiés</p>
 */
export function useDashboardStats() {
  return useQuery({
    queryKey: dashboardStatsKey,
    queryFn: fetchDashboardStats,
    // 5 minutes de fraîcheur — les stats du dashboard ne changent pas à la seconde
    staleTime: 5 * 60 * 1000,
    // 1 retry sur erreur réseau passagère
    retry: 1,
  })
}
