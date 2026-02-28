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
    // Le type LateFollowerStatsResponse est maintenant complet : accounts + stats + total?
    const raw = await late.accounts.followerStats({
      from: searchParams.get('from') ?? undefined,
      to: searchParams.get('to') ?? undefined,
      platform: platformFilter,
    })

    // Normalisation : l'API retourne { accounts: [...], stats: [...] }
    // `accounts` = snapshot courant par plateforme (currentFollowers, growth)
    // `stats`    = historique quotidien (si add-on analytics actif)
    const accounts = Array.isArray(raw?.accounts) ? raw.accounts : []
    const rawStats = Array.isArray(raw?.stats) ? raw.stats : []

    // Si l'API fournit un historique dans `stats`, on l'utilise directement.
    // Sinon on construit un point synthétique par compte à partir de `accounts`.
    let normalizedStats: { date: string; platform: string; count: number; growth: number }[]

    if (rawStats.length > 0) {
      normalizedStats = rawStats.map((s) => ({
        date: s.date,
        platform: s.platform,
        count: s.count,
        growth: s.growth,
      }))
    } else {
      // Fallback : reconstruction quotidienne sur toute la période
      // `stats` étant vide, on interpole linéairement depuis `accounts`
      // qui contient currentFollowers (valeur finale) et growth (delta sur la période).

      const todayDate = new Date()

      // Date de début : paramètre `from` ou 6 jours en arrière (fenêtre 7 jours)
      const fromDate = searchParams.get('from')
        ? new Date(searchParams.get('from')!)
        : (() => {
            const d = new Date(todayDate)
            d.setDate(d.getDate() - 6)
            return d
          })()

      // Nombre de jours dans la période (min 1 pour éviter division par zéro)
      const totalDays = Math.max(
        1,
        Math.round((todayDate.getTime() - fromDate.getTime()) / 86_400_000)
      )

      normalizedStats = accounts.flatMap((a) => {
        // Point de départ = followers AVANT la période (currentFollowers - growth)
        const startCount = a.currentFollowers - a.growth

        // Un point par jour : interpolation linéaire de startCount → currentFollowers
        // Exemple TikTok : growth=7, currentFollowers=268 sur 7 jours
        //   Feb 21 → 261, Feb 22 → 262, ..., Feb 28 → 268
        return Array.from({ length: totalDays + 1 }, (_, i) => {
          const d = new Date(fromDate)
          d.setDate(fromDate.getDate() + i)
          return {
            date: d.toISOString().slice(0, 10),
            platform: a.platform,
            count: Math.round(startCount + (a.growth * i) / totalDays),
            growth: a.growth,
          }
        })
      })
    }

    // Filtrage côté proxy : exclure les autres plateformes si un filtre est actif.
    // Garantit la cohérence même si l'API Late ignore le paramètre `platform`.
    const filteredStats = platformFilter
      ? normalizedStats.filter(
          (s) => s.platform.toLowerCase() === platformFilter.toLowerCase()
        )
      : normalizedStats

    // Total = somme des followers courants des comptes filtrés
    const filteredAccounts = platformFilter
      ? accounts.filter(
          (a) => a.platform.toLowerCase() === platformFilter.toLowerCase()
        )
      : accounts
    const total = filteredAccounts.reduce((sum, a) => sum + a.currentFollowers, 0)

    return NextResponse.json({ stats: filteredStats, total })
  } catch (error) {
    console.error('[/api/accounts/follower-stats] Erreur :', error)
    return NextResponse.json({ error: 'Erreur stats followers' }, { status: 500 })
  }
}
