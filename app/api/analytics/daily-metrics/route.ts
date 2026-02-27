/**
 * @file app/api/analytics/daily-metrics/route.ts
 * @description Proxy GET /v1/analytics/daily-metrics.
 *   Retourne les métriques agrégées par jour.
 *
 *   Chaque réseau social a son propre lateProfileId → appels parallèles puis fusion par date.
 *   Fusion : pour le même jour, on somme les métriques et on merge les maps platforms.
 *
 * @example
 *   GET /api/analytics/daily-metrics?from=2026-01-01&platform=youtube
 */

import { headers } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

import { auth } from '@/lib/auth'
import { late } from '@/lib/late'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { searchParams } = req.nextUrl
  const platformFilter = searchParams.get('platform') ?? undefined
  const from = searchParams.get('from') ?? undefined
  const to   = searchParams.get('to')   ?? undefined

  // Source de vérité : User.lateWorkspaceId (Prisma).
  // IMPORTANT : late.profiles.list() retourne TOUS les workspaces liés à LATE_API_KEY,
  // y compris ceux d'autres utilisateurs rabb → exposition inter-utilisateurs interdite.
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { lateWorkspaceId: true },
  })
  if (!user?.lateWorkspaceId) return NextResponse.json({ days: [] })
  const profileIds = [user.lateWorkspaceId]

  try {
    // Appels parallèles Late API
    const rawResults = await Promise.all(
      profileIds.map((profileId) =>
        // On passe platform à Late (filtre best-effort) même si Late peut l'ignorer
        late.analytics.getDailyMetrics({ profileId, platform: platformFilter, from, to }) as Promise<Record<string, unknown>>
      )
    )

    // Fusion par date : même date depuis plusieurs profils → somme des métriques
    const dayMap = new Map<string, {
      date: unknown
      postCount: number
      platforms: Record<string, number>
      impressions: number; reach: number; likes: number; comments: number
      shares: number; saves: number; clicks: number; views: number
    }>()

    for (const raw of rawResults) {
      const rawDays = Array.isArray(raw?.dailyData)
        ? raw.dailyData
        : Array.isArray(raw?.days)
          ? raw.days
          : []

      for (const item of rawDays as Record<string, unknown>[]) {
        const dateKey = String(item.date)
        const m = (item.metrics ?? {}) as Record<string, number>
        const platformsMap = (item.platforms ?? {}) as Record<string, number>
        const rawPostCount = Number(item.postCount ?? 0)

        const existing = dayMap.get(dateKey)
        if (existing) {
          // Agréger les métriques du même jour sur plusieurs profils
          existing.postCount   += rawPostCount
          existing.impressions += m.impressions ?? 0
          existing.reach       += m.reach       ?? 0
          existing.likes       += m.likes       ?? 0
          existing.comments    += m.comments    ?? 0
          existing.shares      += m.shares      ?? 0
          existing.saves       += m.saves       ?? 0
          existing.clicks      += m.clicks      ?? 0
          existing.views       += m.views       ?? 0
          // Merge de la map platforms (ex: { tiktok: 1 } + { youtube: 2 } = { tiktok: 1, youtube: 2 })
          for (const [plat, count] of Object.entries(platformsMap)) {
            existing.platforms[plat] = (existing.platforms[plat] ?? 0) + count
          }
        } else {
          dayMap.set(dateKey, {
            date:        item.date,
            postCount:   rawPostCount,
            platforms:   { ...platformsMap },
            impressions: m.impressions ?? 0,
            reach:       m.reach       ?? 0,
            likes:       m.likes       ?? 0,
            comments:    m.comments    ?? 0,
            shares:      m.shares      ?? 0,
            saves:       m.saves       ?? 0,
            clicks:      m.clicks      ?? 0,
            views:       m.views       ?? 0,
          })
        }
      }
    }

    // Filtrage postCount par plateforme si filtre actif
    const days = [...dayMap.values()].map((day) => {
      if (platformFilter) {
        const key = Object.keys(day.platforms).find(
          (k) => k.toLowerCase() === platformFilter.toLowerCase()
        )
        return { ...day, postCount: key ? (day.platforms[key] ?? 0) : 0 }
      }
      return day
    })

    return NextResponse.json({ days })
  } catch (error) {
    console.error('[/api/analytics/daily-metrics] Erreur :', error)
    return NextResponse.json({ error: 'Erreur métriques quotidiennes' }, { status: 500 })
  }
}
