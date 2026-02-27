/**
 * @file app/api/analytics/posting-frequency/route.ts
 * @description Proxy GET /v1/analytics/posting-frequency.
 *   Retourne la corrélation entre fréquence de publication et engagement par plateforme.
 *
 *   Chaque réseau social a son propre lateProfileId → appels parallèles puis concaténation.
 *   Chaque ligne a un champ `platform` → on déduplique par (platform, postsPerWeek).
 *
 * @example
 *   GET /api/analytics/posting-frequency?platform=youtube
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

  // Source de vérité : User.lateWorkspaceId (Prisma).
  // IMPORTANT : late.profiles.list() retourne TOUS les workspaces liés à LATE_API_KEY,
  // y compris ceux d'autres utilisateurs rabb → exposition inter-utilisateurs interdite.
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { lateWorkspaceId: true },
  })
  if (!user?.lateWorkspaceId) return NextResponse.json({ data: [], optimal: [] })
  const profileIds = [user.lateWorkspaceId]

  try {
    const rawResults = await Promise.all(
      profileIds.map((profileId) =>
        late.analytics.getPostingFrequency({ profileId, platform: platformFilter }) as Promise<Record<string, unknown>>
      )
    )

    // Concaténation de toutes les lignes (chacune a un champ `platform`)
    type RawFreq = Record<string, unknown>
    const allData = rawResults.flatMap((raw) => {
      const rawFreq = Array.isArray(raw?.frequency) ? (raw.frequency as RawFreq[]) : []
      return rawFreq.map((f) => ({
        platform:          String(f.platform ?? ''),
        postsPerWeek:      String(f.posts_per_week ?? f.postsPerWeek ?? ''),
        avgEngagementRate: Number(f.avg_engagement_rate ?? f.avgEngagementRate ?? 0),
      }))
    })

    // Filtrage côté proxy si la plateforme filtre est spécifiée (defensive)
    const data = platformFilter
      ? allData.filter((d) => d.platform.toLowerCase() === platformFilter.toLowerCase())
      : allData

    // Optimal = meilleur ER par plateforme
    const byPlatform = new Map<string, typeof data[0]>()
    for (const item of data) {
      const existing = byPlatform.get(item.platform)
      if (!existing || item.avgEngagementRate > existing.avgEngagementRate) {
        byPlatform.set(item.platform, item)
      }
    }
    const optimal = [...byPlatform.values()]

    return NextResponse.json({ data, optimal })
  } catch (error) {
    console.error('[/api/analytics/posting-frequency] Erreur :', error)
    return NextResponse.json({ error: 'Erreur fréquence de publication' }, { status: 500 })
  }
}
