/**
 * @file app/api/posts/route.ts
 * @description Route Handler GET : liste les posts de l'utilisateur pour le calendrier.
 *   Accepte les paramètres de filtre : year, month (pour afficher un mois donné).
 *
 *   GET /api/posts?year=2024&month=3
 *   → Response : Post[] (posts du mois, triés par scheduledFor)
 *
 * @example
 *   const res = await fetch('/api/posts?year=2024&month=3')
 *   const posts = await res.json()
 */

import { headers } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/posts
 * Retourne les posts d'un mois donné pour le calendrier.
 *
 * @param request - Requête avec query params year et month (optionnels, défaut: mois actuel)
 * @returns 200 avec la liste des posts ou 401 si non authentifié
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  // ─── Authentification ─────────────────────────────────────────────────────
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  // ─── Paramètres de filtre (mois courant par défaut) ───────────────────────
  const { searchParams } = request.nextUrl
  const now = new Date()
  const year = parseInt(searchParams.get('year') ?? String(now.getFullYear()), 10)
  const month = parseInt(searchParams.get('month') ?? String(now.getMonth() + 1), 10)

  // Validation des paramètres (éviter des requêtes aberrantes)
  if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
    return NextResponse.json({ error: 'Paramètres invalides' }, { status: 400 })
  }

  // ─── Calcul de la plage de dates du mois ──────────────────────────────────
  // Inclure les 7 jours avant/après pour afficher les semaines complètes du calendrier
  const firstDay = new Date(year, month - 1, 1)
  const lastDay = new Date(year, month, 0, 23, 59, 59)

  // ─── Requête DB ───────────────────────────────────────────────────────────
  const posts = await prisma.post.findMany({
    where: {
      userId: session.user.id,
      // Inclure les posts qui ont une date dans ce mois (planifiés OU publiés)
      OR: [
        // Posts planifiés dans ce mois
        {
          scheduledFor: { gte: firstDay, lte: lastDay },
        },
        // Posts publiés dans ce mois
        {
          publishedAt: { gte: firstDay, lte: lastDay },
        },
        // Brouillons créés dans ce mois (sans date de planification)
        {
          scheduledFor: null,
          createdAt: { gte: firstDay, lte: lastDay },
        },
      ],
    },
    select: {
      id: true,
      text: true,
      platforms: true,
      mediaUrls: true,
      status: true,
      scheduledFor: true,
      publishedAt: true,
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
