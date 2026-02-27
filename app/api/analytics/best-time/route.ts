/**
 * @file app/api/analytics/best-time/route.ts
 * @description Proxy GET /v1/analytics/best-time.
 *   Retourne les meilleurs créneaux de publication par jour et heure (UTC).
 *
 *   Chaque réseau social a son propre lateProfileId → appels parallèles puis fusion.
 *   Fusion des slots : même (dayOfWeek, hour) → somme des postCount, moyenne d'engagement pondérée.
 *
 * @example
 *   GET /api/analytics/best-time?platform=youtube
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
  // y compris ceux d'autres utilisateurs ogolong → exposition inter-utilisateurs interdite.
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { lateWorkspaceId: true },
  })
  if (!user?.lateWorkspaceId) return NextResponse.json({ slots: [], bestTimes: [] })
  const profileIds = [user.lateWorkspaceId]

  try {
    const rawResults = await Promise.all(
      profileIds.map((profileId) =>
        late.analytics.getBestTime({ profileId, platform: platformFilter }) as unknown as Promise<Record<string, unknown>>
      )
    )

    // Fusion des slots : même créneau (dayOfWeek × hour) → somme postCount + moyenne ER pondérée
    type SlotKey = string // `${dayOfWeek}-${hour}`
    const slotMap = new Map<SlotKey, { dayOfWeek: number; hour: number; totalEngagement: number; postCount: number }>()

    for (const raw of rawResults) {
      type RawSlot = Record<string, unknown>
      const rawSlots = Array.isArray(raw?.slots) ? (raw.slots as RawSlot[]) : []
      for (const s of rawSlots) {
        const dow  = Number(s.day_of_week ?? s.dayOfWeek ?? 0)
        const hour = Number(s.hour ?? 0)
        const eng  = Number(s.avg_engagement ?? s.avgEngagement ?? 0)
        const cnt  = Number(s.post_count ?? s.postCount ?? 0)
        const key: SlotKey = `${dow}-${hour}`

        const existing = slotMap.get(key)
        if (existing) {
          // Somme pondérée pour recalculer la moyenne d'engagement
          existing.totalEngagement += eng * cnt
          existing.postCount       += cnt
        } else {
          slotMap.set(key, { dayOfWeek: dow, hour, totalEngagement: eng * cnt, postCount: cnt })
        }
      }
    }

    const slots = [...slotMap.values()]
      .map((s) => ({
        dayOfWeek:     s.dayOfWeek,
        hour:          s.hour,
        avgEngagement: s.postCount > 0 ? s.totalEngagement / s.postCount : 0,
        postCount:     s.postCount,
      }))
      .sort((a, b) => b.avgEngagement - a.avgEngagement)

    // Labels lisibles pour le top 3
    const DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
    const bestTimes = slots.slice(0, 3).map((s) => {
      const day  = DAYS[s.dayOfWeek] ?? `J${s.dayOfWeek}`
      const ampm = s.hour >= 12 ? 'pm' : 'am'
      const h    = s.hour > 12 ? s.hour - 12 : s.hour === 0 ? 12 : s.hour
      return `${day} ${h}${ampm}`
    })

    return NextResponse.json({ slots, bestTimes })
  } catch (error) {
    console.error('[/api/analytics/best-time] Erreur :', error)
    return NextResponse.json({ error: 'Erreur meilleurs créneaux' }, { status: 500 })
  }
}
