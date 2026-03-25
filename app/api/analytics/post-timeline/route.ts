/**
 * @file app/api/analytics/post-timeline/route.ts
 * @description Route Handler GET : évolution jour par jour des métriques d'un post.
 *   Proxy vers GET /v1/analytics/post-timeline de l'API Zernio.
 *
 *   Paramètres :
 *   - postId (requis) : ID du post Zernio
 *   - fromDate (optionnel) : début de la période (défaut : 90 jours)
 *   - toDate (optionnel) : fin de la période (défaut : aujourd'hui)
 *
 * @example
 *   GET /api/analytics/post-timeline?postId=69b43106...
 *   → { postId, timeline: [{ date, impressions, likes, comments, ... }] }
 */

import { headers } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

import { auth } from '@/lib/auth'
import { late } from '@/lib/late'

export async function GET(request: NextRequest): Promise<NextResponse> {
  // ── Authentification ─────────────────────────────────────────────────────
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  const { searchParams } = request.nextUrl
  const postId = searchParams.get('postId')

  if (!postId) {
    return NextResponse.json({ error: 'postId requis' }, { status: 400 })
  }

  try {
    const data = await late.analytics.getPostTimeline({
      postId,
      fromDate: searchParams.get('fromDate') ?? undefined,
      toDate: searchParams.get('toDate') ?? undefined,
    })

    return NextResponse.json(data)
  } catch (error) {
    console.error('[/api/analytics/post-timeline] Erreur Zernio :', error)
    const message = error instanceof Error ? error.message : 'Erreur inconnue'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
