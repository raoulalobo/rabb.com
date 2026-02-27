/**
 * @file app/api/accounts/follower-stats/route.ts
 * @description Proxy GET /v1/accounts/follower-stats.
 *   Retourne l'historique des followers et les métriques de croissance par plateforme.
 *   Rafraîchi une fois par jour. Nécessite l'add-on Analytics.
 *   Utilisé par FollowersChart.
 *
 * @example
 *   GET /api/accounts/follower-stats?from=2026-02-01&to=2026-02-27
 */

import { headers } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

import { auth } from '@/lib/auth'
import { late } from '@/lib/late'

export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { searchParams } = req.nextUrl
  const platformFilter = searchParams.get('platform') ?? undefined

  try {
    const raw = await late.accounts.followerStats({
      from: searchParams.get('from') ?? undefined,
      to: searchParams.get('to') ?? undefined,
      platform: platformFilter,
    }) as Record<string, unknown>

    // Normalisation : l'API retourne { accounts: [...], stats: [...], dateRange, granularity }
    // `accounts` = snapshot courant par plateforme (currentFollowers, growth)
    // `stats` = historique quotidien (si disponible)
    const accounts = Array.isArray(raw?.accounts) ? raw.accounts as Record<string, unknown>[] : []
    const rawStats = Array.isArray(raw?.stats) ? raw.stats as Record<string, unknown>[] : []

    // Si l'API fournit un historique dans `stats`, on l'utilise directement
    // Sinon on construit un point synthétique par compte à partir de `accounts`
    let normalizedStats: { date: string; platform: string; count: number; growth: number }[]

    if (rawStats.length > 0) {
      normalizedStats = rawStats.map((s) => ({
        date: String(s.date ?? ''),
        platform: String(s.platform ?? ''),
        count: Number(s.count ?? s.followers ?? 0),
        growth: Number(s.growth ?? 0),
      }))
    } else {
      // Fallback : un point par compte (date = aujourd'hui)
      const today = new Date().toISOString().slice(0, 10)
      normalizedStats = accounts.map((a) => ({
        date: today,
        platform: String(a.platform ?? ''),
        count: Number(a.currentFollowers ?? 0),
        growth: Number(a.growth ?? 0),
      }))
    }

    // Filtrage côté proxy : exclure les stats des autres plateformes si un filtre est actif.
    // Garantit la cohérence même si l'API Late ignore le paramètre `platform`.
    const filteredStats = platformFilter
      ? normalizedStats.filter(
          (s) => s.platform.toLowerCase() === platformFilter.toLowerCase()
        )
      : normalizedStats

    // Total = somme des followers courants des comptes filtrés
    const filteredAccounts = platformFilter
      ? accounts.filter(
          (a) => String(a.platform ?? '').toLowerCase() === platformFilter.toLowerCase()
        )
      : accounts
    const total = filteredAccounts.reduce((sum, a) => sum + Number(a.currentFollowers ?? 0), 0)

    return NextResponse.json({ stats: filteredStats, total })
  } catch (error) {
    console.error('[/api/accounts/follower-stats] Erreur :', error)
    return NextResponse.json({ error: 'Erreur stats followers' }, { status: 500 })
  }
}
