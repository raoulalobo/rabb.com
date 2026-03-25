/**
 * @file app/api/posts/route.ts
 * @description Route Handler GET : liste les posts depuis l'API Zernio.
 *   Zernio est la source de vérité unique pour tous les posts.
 *   Cette route sert de proxy authentifié entre le client et Zernio.
 *
 *   Mode calendrier (défaut) :
 *     GET /api/posts?year=2026&month=3
 *     → Posts du mois (convertis en ?from=...&to=... pour Zernio)
 *
 *   Mode filtre par statut :
 *     GET /api/posts?status=draft
 *     → Posts avec ce statut
 *
 * @example
 *   // Calendrier mars 2026
 *   const res = await fetch('/api/posts?year=2026&month=3')
 *   const posts = await res.json() // Post[] normalisé
 */

import { headers } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

import { auth } from '@/lib/auth'
import { late } from '@/lib/late'
import { prisma } from '@/lib/prisma'
import { mapZernioPost } from '@/modules/posts/types'
import type { ZernioRawPost } from '@/modules/posts/types'

// ─── Types réponse Zernio ────────────────────────────────────────────────────

/** Réponse de GET /v1/posts côté Zernio */
interface ZernioListResponse {
  posts: ZernioRawPost[]
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
  }
}

/**
 * GET /api/posts
 * Proxy vers Zernio GET /v1/posts avec normalisation de la réponse.
 *
 * @param request - Requête avec query params (year, month, status, platform)
 * @returns 200 avec Post[] normalisé | 400 si params invalides | 401 si non authentifié
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  // ─── Authentification ─────────────────────────────────────────────────────
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  const { searchParams } = request.nextUrl

  // ─── Récupérer le profileId Zernio de l'utilisateur ─────────────────────
  // Chaque utilisateur est lié à un workspace Zernio (lateWorkspaceId sur User).
  // On filtre les posts par profileId pour ne montrer que ceux du profil connecté.
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { lateWorkspaceId: true },
  })

  if (!user?.lateWorkspaceId) {
    return NextResponse.json({ error: 'Profil Zernio non configuré' }, { status: 400 })
  }

  // ─── Construction des paramètres Zernio ─────────────────────────────────
  const zernioParams = new URLSearchParams()

  // Filtre par profil — ne montrer que les posts du workspace de l'utilisateur
  zernioParams.set('profileId', user.lateWorkspaceId)

  // Pagination — récupérer tous les posts du mois (limit élevé pour le calendrier)
  zernioParams.set('limit', '100')

  // Filtre par statut (optionnel)
  const statusParam = searchParams.get('status')
  if (statusParam) {
    // Zernio utilise des statuts lowercase (draft, scheduled, published, failed)
    zernioParams.set('status', statusParam.toLowerCase())
  }

  // Filtre par plateforme (optionnel)
  const platformParam = searchParams.get('platform')
  if (platformParam) {
    zernioParams.set('platform', platformParam)
  }

  // ─── Mode calendrier : convertir year/month en from/to ───────────────────
  const yearParam = searchParams.get('year')
  const monthParam = searchParams.get('month')

  if (yearParam && monthParam) {
    const year = parseInt(yearParam, 10)
    const month = parseInt(monthParam, 10)

    // Validation des paramètres
    if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
      return NextResponse.json({ error: 'Paramètres invalides' }, { status: 400 })
    }

    // Premier jour du mois (YYYY-MM-DD)
    const from = `${year}-${String(month).padStart(2, '0')}-01`
    // Dernier jour du mois
    const lastDay = new Date(year, month, 0).getDate()
    const to = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

    zernioParams.set('from', from)
    zernioParams.set('to', to)
  }

  // ─── Appel Zernio ───────────────────────────────────────────────────────
  try {
    const data = await late.posts.list(zernioParams)

    // Normaliser chaque post Zernio vers notre interface Post
    const posts = (data as ZernioListResponse).posts.map(mapZernioPost)

    return NextResponse.json(posts)
  } catch (error) {
    console.error('[GET /api/posts] Erreur Zernio :', error)
    const message = error instanceof Error ? error.message : 'Erreur inconnue'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
