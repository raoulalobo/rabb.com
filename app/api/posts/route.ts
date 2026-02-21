/**
 * @file app/api/posts/route.ts
 * @description Route Handler GET : liste les posts de l'utilisateur.
 *   Supporte deux modes de filtrage :
 *
 *   Mode calendrier (défaut) :
 *     GET /api/posts?year=2024&month=3
 *     → Posts du mois (planifiés ou publiés dans cette période)
 *
 *   Mode brouillons :
 *     GET /api/posts?status=DRAFT
 *     → Posts DRAFT de l'utilisateur (pour /compose)
 *
 * @example
 *   // Calendrier
 *   const res = await fetch('/api/posts?year=2024&month=3')
 *   const posts = await res.json()
 *
 *   // Brouillons
 *   const res = await fetch('/api/posts?status=DRAFT')
 *   const posts = await res.json()
 */

import { headers } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/posts
 * Retourne les posts selon le mode demandé (calendrier ou brouillons).
 *
 * @param request - Requête avec query params year, month (calendrier) ou status (brouillons)
 * @returns 200 avec la liste des posts ou 401 si non authentifié
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  // ─── Authentification ─────────────────────────────────────────────────────
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  const { searchParams } = request.nextUrl

  // ─── Mode brouillons : filtre par statut ──────────────────────────────────
  // Activé si le paramètre `status` est présent (ex: ?status=DRAFT)
  const statusParam = searchParams.get('status')
  if (statusParam) {
    const allowedStatuses = ['DRAFT', 'SCHEDULED', 'PUBLISHED', 'FAILED']
    if (!allowedStatuses.includes(statusParam)) {
      return NextResponse.json({ error: 'Statut invalide' }, { status: 400 })
    }

    const posts = await prisma.post.findMany({
      where: {
        userId: session.user.id,
        status: statusParam as 'DRAFT' | 'SCHEDULED' | 'PUBLISHED' | 'FAILED',
      },
      select: {
        id: true,
        text: true,
        platform: true,
        mediaUrls: true,
        status: true,
        scheduledFor: true,
        publishedAt: true,
        latePostId: true,
        failureReason: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    return NextResponse.json(posts)
  }

  // ─── Mode calendrier : filtre par mois ────────────────────────────────────
  const now = new Date()
  const year = parseInt(searchParams.get('year') ?? String(now.getFullYear()), 10)
  const month = parseInt(searchParams.get('month') ?? String(now.getMonth() + 1), 10)

  // Validation des paramètres (éviter des requêtes aberrantes)
  if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
    return NextResponse.json({ error: 'Paramètres invalides' }, { status: 400 })
  }

  // ─── Calcul de la plage de dates du mois ──────────────────────────────────
  const firstDay = new Date(year, month - 1, 1)
  const lastDay = new Date(year, month, 0, 23, 59, 59)

  // ─── Requête DB — mode calendrier ─────────────────────────────────────────
  const posts = await prisma.post.findMany({
    where: {
      userId: session.user.id,
      // Inclure les posts qui ont une date dans ce mois (planifiés OU publiés)
      OR: [
        // Posts planifiés dans ce mois
        { scheduledFor: { gte: firstDay, lte: lastDay } },
        // Posts publiés dans ce mois
        { publishedAt: { gte: firstDay, lte: lastDay } },
        // Brouillons créés dans ce mois (sans date de planification)
        { scheduledFor: null, createdAt: { gte: firstDay, lte: lastDay } },
      ],
    },
    select: {
      id: true,
      text: true,
      platform: true,
      mediaUrls: true,
      status: true,
      scheduledFor: true,
      publishedAt: true,
      latePostId: true,
      failureReason: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: [
      // Trier par date de planification, puis par date de création
      { scheduledFor: 'asc' },
      { createdAt: 'desc' },
    ],
  })

  return NextResponse.json(posts)
}
