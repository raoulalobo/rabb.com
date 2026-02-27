/**
 * @file app/api/analytics/content-decay/route.ts
 * @description Proxy GET /v1/analytics/content-decay.
 *   Retourne la décroissance de performance du contenu par fenêtre temporelle.
 *
 *   Chaque réseau social a son propre lateProfileId → appels parallèles puis fusion.
 *   Fusion des buckets : même label → moyenne des pourcentages pondérée.
 *
 * @example
 *   GET /api/analytics/content-decay?platform=youtube
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
  if (!user?.lateWorkspaceId) return NextResponse.json({ buckets: [] })
  const profileIds = [user.lateWorkspaceId]

  try {
    const rawResults = await Promise.all(
      profileIds.map((profileId) =>
        late.analytics.getContentDecay({ profileId, platform: platformFilter }) as unknown as Promise<Record<string, unknown>>
      )
    )

    // Fusion des buckets : même label → moyenne des pourcentages sur tous les profils
    type BucketAcc = { label: string; order: number; percentageSum: number; count: number }
    const bucketMap = new Map<string, BucketAcc>()

    for (const raw of rawResults) {
      type RawBucket = Record<string, unknown>
      const rawBuckets = Array.isArray(raw?.buckets) ? (raw.buckets as RawBucket[]) : []
      for (const b of rawBuckets) {
        const label = String(b.bucket_label ?? b.bucket ?? '')
        const order = Number(b.bucket_order ?? 0)
        const pct   = Number(b.avg_pct_of_final ?? b.percentage ?? 0)

        const existing = bucketMap.get(label)
        if (existing) {
          existing.percentageSum += pct
          existing.count         += 1
        } else {
          bucketMap.set(label, { label, order, percentageSum: pct, count: 1 })
        }
      }
    }

    const buckets = [...bucketMap.values()]
      .sort((a, b) => a.order - b.order)
      .map((b) => ({
        bucket:     b.label,
        percentage: b.count > 0 ? b.percentageSum / b.count : 0,
      }))

    return NextResponse.json({ buckets })
  } catch (error) {
    console.error('[/api/analytics/content-decay] Erreur :', error)
    return NextResponse.json({ error: 'Erreur content decay' }, { status: 500 })
  }
}
