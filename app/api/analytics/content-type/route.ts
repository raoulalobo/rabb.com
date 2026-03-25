/**
 * @file app/api/analytics/content-type/route.ts
 * @description Route Handler GET : breakdown des performances par type de contenu.
 *   Agrège les posts DB (Prisma) par contentType et calcule les moyennes de métriques.
 *   Les métriques proviennent des posts publiés (status = PUBLISHED) uniquement.
 *
 *   Paramètres acceptés (query string) :
 *   - from : date ISO de début (ex: "2026-02-21")
 *   - platform : filtre par plateforme (optionnel)
 *
 *   Retourne :
 *   { breakdown: [{ type, postCount, avgLikes, avgComments, avgShares, avgViews, avgER }] }
 *
 * @example
 *   GET /api/analytics/content-type?from=2026-02-21&platform=instagram
 */

import { headers } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// ─── Types ───────────────────────────────────────────────────────────────────

/** Breakdown d'un type de contenu */
interface ContentTypeStats {
  /** Type de contenu (feed, story, reel, thread, carousel) */
  type: string
  /** Nombre de posts de ce type */
  postCount: number
}

// ─── Labels en français ──────────────────────────────────────────────────────

const CONTENT_TYPE_LABELS: Record<string, string> = {
  feed: 'Publication',
  story: 'Story',
  reel: 'Reel / Short',
  thread: 'Thread',
  carousel: 'Carrousel',
}

// ─── Route Handler ───────────────────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  // ── Authentification ────────────────────────────────────────────────────────
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  // ── Extraction des filtres ──────────────────────────────────────────────────
  const { searchParams } = req.nextUrl
  const from = searchParams.get('from')
  const platformFilter = searchParams.get('platform') ?? undefined

  // ── TODO: Migrer vers les données Zernio ───────────────────────────────────
  // L'ancienne logique utilisait prisma.post.groupBy — la table posts a été supprimée.
  // Les données de contentType ne sont pas disponibles côté Zernio nativement.
  // Retourner un tableau vide en attendant une implémentation basée sur l'API Zernio.
  const breakdown: ContentTypeStats[] = []
  return NextResponse.json({ breakdown })
}
