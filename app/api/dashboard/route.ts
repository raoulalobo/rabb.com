/**
 * @file app/api/dashboard/route.ts
 * @description Route Handler GET : données agrégées pour la page /dashboard.
 *
 *   Retourne en une seule requête les KPIs affichés dans les cartes du dashboard :
 *   - postsPublished : nombre de posts publiés (via Zernio API)
 *   - postsScheduled : nombre de posts planifiés (via Zernio API)
 *   - postsFailed    : nombre de posts en erreur (via Zernio API)
 *   - impressions    : total des impressions sur les 30 derniers jours (Zernio API)
 *   - engagementRate : taux d'engagement moyen sur les 30 derniers jours (Zernio API)
 *
 *   Source unique : Zernio API (posts + analytics).
 *   Dégradation gracieuse : si Zernio est down, les compteurs retournent 0.
 *
 * @example
 *   GET /api/dashboard
 *   → { postsPublished: 12, postsScheduled: 3, postsFailed: 2, impressions: 45200, engagementRate: 4.2 }
 */

import { headers } from 'next/headers'
import { NextResponse } from 'next/server'

import { auth } from '@/lib/auth'
import { late } from '@/lib/late'
import { prisma } from '@/lib/prisma'

// ─── Types ────────────────────────────────────────────────────────────────────

/** Réponse normalisée retournée au client */
export interface DashboardStatsResponse {
  /** Nombre total de posts avec status PUBLISHED */
  postsPublished: number
  /** Nombre de posts avec status SCHEDULED (planifiés à venir) */
  postsScheduled: number
  /** Nombre de posts avec status FAILED (erreur de publication) */
  postsFailed: number
  /** Total des impressions sur les 30 derniers jours (Zernio API) */
  impressions: number
  /** Taux d'engagement moyen sur les 30 derniers jours, en % (Zernio API) */
  engagementRate: number
  /** failureReason des 2 derniers posts FAILED (pour l'aperçu dans FailedPostsAlert) */
  recentFailures: string[]
}

/** Réponse brute de la Zernio API analytics (structure minimale attendue) */
type LateRawPost = Record<string, unknown>
type LateRawAnalytics = Record<string, number>

export async function GET(): Promise<NextResponse> {
  // ── Authentification ─────────────────────────────────────────────────────
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }
  const userId = session.user.id

  // ── 1. Comptages posts via Zernio (source de vérité unique) ────────────────
  // Récupérer le profileId pour filtrer par workspace
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { lateWorkspaceId: true },
  })
  const profileId = user?.lateWorkspaceId

  // Compter les posts par statut via Zernio (3 appels en parallèle)
  let postsPublished = 0
  let postsScheduled = 0
  let postsFailed = 0
  let recentFailures: string[] = []

  if (profileId) {
    try {
      const [publishedRes, scheduledRes, failedRes] = await Promise.all([
        late.posts.list(new URLSearchParams({ profileId, status: 'published', limit: '1' })),
        late.posts.list(new URLSearchParams({ profileId, status: 'scheduled', limit: '1' })),
        late.posts.list(new URLSearchParams({ profileId, status: 'failed', limit: '2' })),
      ]) as [
        { pagination: { total: number }; posts: Array<{ platforms?: Array<{ errorMessage?: string }> }> },
        { pagination: { total: number } },
        { pagination: { total: number }; posts: Array<{ platforms?: Array<{ errorMessage?: string }> }> },
      ]
      postsPublished = publishedRes.pagination.total
      postsScheduled = scheduledRes.pagination.total
      postsFailed = failedRes.pagination.total
      // Extraire les errorMessage des 2 derniers posts failed
      recentFailures = failedRes.posts
        .map((p) => p.platforms?.[0]?.errorMessage)
        .filter((msg): msg is string => !!msg)
    } catch (error) {
      console.error('[dashboard] Erreur comptage posts Zernio :', error)
    }
  }

  // ── 2. Analytics Zernio API (dégradation gracieuse si aucune plateforme) ────
  let impressions = 0
  let engagementRate = 0

  try {
    // Récupère le workspace Late de l'utilisateur
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { lateWorkspaceId: true },
    })

    if (user?.lateWorkspaceId) {
      // Fenêtre temporelle : 30 derniers jours au format YYYY-MM-DD
      const from = new Date()
      from.setDate(from.getDate() - 30)
      const fromStr = from.toISOString().slice(0, 10)

      // Récupère les posts analytics (impressions + ER) depuis Late
      const raw = await late.analytics.getPosts({
        profileId: user.lateWorkspaceId,
        from: fromStr,
        // Le cast vers unknown puis Record est nécessaire car LateAnalyticsListResponse
        // n'a pas d'index signature — on accède uniquement à `posts` qui est connu.
      }) as unknown as Record<string, unknown>

      const posts = Array.isArray(raw?.posts) ? (raw.posts as LateRawPost[]) : []

      if (posts.length > 0) {
        // Agrège les impressions et somme l'ER pour calculer la moyenne
        let erSum = 0
        for (const p of posts) {
          const a = (p.analytics ?? p.metrics ?? {}) as LateRawAnalytics
          impressions  += Number(a.impressions ?? 0)
          erSum        += Number(a.engagementRate ?? a.engagement_rate ?? 0)
        }
        // ER = moyenne sur tous les posts (pas la somme)
        engagementRate = erSum / posts.length
      }
    }
  } catch (err) {
    // Zernio API indisponible ou aucune plateforme connectée → dégradation gracieuse
    // On loggue mais on ne fait pas échouer la réponse (les counts Prisma restent valides)
    console.warn('[/api/dashboard] Zernio API indisponible :', err)
  }

  return NextResponse.json({
    postsPublished,
    postsScheduled,
    postsFailed,
    impressions,
    engagementRate,
    recentFailures,
  } satisfies DashboardStatsResponse)
}
