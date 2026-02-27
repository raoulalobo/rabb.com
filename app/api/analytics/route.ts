/**
 * @file app/api/analytics/route.ts
 * @description Route Handler GET : proxy vers GET /v1/analytics de getlate.dev.
 *   Retourne la liste paginée des posts avec leurs analytics (likes, ER, vues…).
 *
 *   Chaque réseau social connecté a son propre `lateProfileId` dans ConnectedPlatform.
 *   Quand un filtre plateforme est actif, on utilise le `lateProfileId` de cette plateforme.
 *   Sans filtre, on appelle l'API en parallèle pour chaque profileId unique et on fusionne.
 *
 *   Paramètres acceptés (query string) :
 *   - platform : filtre par plateforme (ex: "youtube")
 *   - from / to : fenêtre temporelle ISO 8601
 *   - limit     : nb de posts par page (défaut: 20)
 *   - cursor    : curseur de pagination
 *
 * @example
 *   GET /api/analytics?from=2026-01-01&platform=youtube
 */

import { headers } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

import { auth } from '@/lib/auth'
import { late } from '@/lib/late'
import { prisma } from '@/lib/prisma'

// ── Types internes ─────────────────────────────────────────────────────────────

type RawPost = Record<string, unknown>
type RawAnalytics = Record<string, number>

/** Réponse vide normalisée (aucune plateforme connectée ou aucun résultat) */
const EMPTY_RESPONSE = {
  posts: [],
  overview: { likes: 0, comments: 0, shares: 0, views: 0, impressions: 0, reach: 0, clicks: 0, engagementRate: 0 },
  platforms: [],
  nextCursor: null,
}

/**
 * Normalise un tableau de posts bruts Late API en posts frontend.
 * @param rawPosts - Posts bruts de la réponse Late API
 */
function normalizePosts(rawPosts: RawPost[]) {
  return rawPosts.map((p) => {
    const a = (p.analytics ?? p.metrics ?? {}) as RawAnalytics
    // La plateforme peut être au top-level ou dans platforms[0]
    const rawPlatforms = Array.isArray(p.platforms) ? (p.platforms as RawPost[]) : []
    const platform = String(
      p.platform ?? rawPlatforms[0]?.platform ?? rawPlatforms[0]?.accountId ?? ''
    )
    return {
      id: String(p._id ?? p.id ?? ''),
      text: String(p.content ?? p.text ?? ''),
      platform,
      publishedAt: String(p.publishedAt ?? ''),
      mediaUrl: p.mediaUrl ?? p.thumbnail ?? undefined,
      metrics: {
        likes:          Number(a.likes ?? 0),
        comments:       Number(a.comments ?? 0),
        shares:         Number(a.shares ?? 0),
        views:          Number(a.views ?? 0),
        impressions:    Number(a.impressions ?? 0),
        reach:          Number(a.reach ?? 0),
        clicks:         Number(a.clicks ?? 0),
        engagementRate: Number(a.engagementRate ?? a.engagement_rate ?? 0),
      },
    }
  })
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  // ── Authentification ────────────────────────────────────────────────────────
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  // ── Extraction des filtres ──────────────────────────────────────────────────
  const { searchParams } = req.nextUrl
  const platformFilter = searchParams.get('platform') ?? undefined
  const from    = searchParams.get('from')   ?? undefined
  const to      = searchParams.get('to')     ?? undefined
  const limit   = searchParams.get('limit')  ? Number(searchParams.get('limit')) : undefined
  const cursor  = searchParams.get('cursor') ?? undefined

  // ── Récupération du workspace Late de l'utilisateur ────────────────────────
  // Source de vérité : User.lateWorkspaceId (Prisma).
  // IMPORTANT : late.profiles.list() retourne TOUS les workspaces liés à LATE_API_KEY,
  // y compris ceux d'autres utilisateurs rabb → exposition inter-utilisateurs interdite.
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { lateWorkspaceId: true },
  })
  if (!user?.lateWorkspaceId) return NextResponse.json(EMPTY_RESPONSE)
  const profileIds = [user.lateWorkspaceId]

  // ── Appels parallèles Late API (un par profileId) ──────────────────────────
  try {
    const rawResults = await Promise.all(
      profileIds.map((profileId) =>
        // On passe platform à Late (filtre best-effort) même si Late peut l'ignorer
        late.analytics.getPosts({ profileId, platform: platformFilter, from, to, limit, cursor }) as unknown as Promise<Record<string, unknown>>
      )
    )

    // Fusion des posts de tous les profils (dédupliqués par _id)
    const seenIds = new Set<string>()
    const mergedRawPosts: RawPost[] = []
    for (const raw of rawResults) {
      const posts = Array.isArray(raw?.posts) ? (raw.posts as RawPost[]) : []
      for (const p of posts) {
        const id = String(p._id ?? p.id ?? '')
        if (!seenIds.has(id)) {
          seenIds.add(id)
          mergedRawPosts.push(p)
        }
      }
    }

    const allPosts = normalizePosts(mergedRawPosts)

    // Filtre défensif côté proxy : un profil Late peut contenir des posts d'autres
    // plateformes (ex: TikTok importé via isExternal dans un profil Twitter).
    // Ce filtre garantit que seuls les posts de la plateforme demandée sont retournés.
    const posts = platformFilter
      ? allPosts.filter((p) => p.platform.toLowerCase() === platformFilter.toLowerCase())
      : allPosts

    // Calcul de l'overview agrégé depuis les posts normalisés
    const overview = posts.reduce(
      (acc, p) => ({
        likes:          acc.likes          + p.metrics.likes,
        comments:       acc.comments       + p.metrics.comments,
        shares:         acc.shares         + p.metrics.shares,
        views:          acc.views          + p.metrics.views,
        impressions:    acc.impressions    + p.metrics.impressions,
        reach:          acc.reach          + p.metrics.reach,
        clicks:         acc.clicks         + p.metrics.clicks,
        engagementRate: acc.engagementRate + p.metrics.engagementRate,
      }),
      { likes: 0, comments: 0, shares: 0, views: 0, impressions: 0, reach: 0, clicks: 0, engagementRate: 0 }
    )
    // ER = moyenne sur tous les posts (pas somme)
    if (posts.length > 0) overview.engagementRate = overview.engagementRate / posts.length

    // Répartition par plateforme depuis les posts normalisés
    const platformMap = new Map<string, {
      platform: string; postCount: number; likes: number; comments: number
      shares: number; views: number; impressions: number; reach: number
      clicks: number; erSum: number
    }>()
    for (const p of posts) {
      if (!p.platform) continue
      const existing = platformMap.get(p.platform) ?? {
        platform: p.platform, postCount: 0, likes: 0, comments: 0, shares: 0,
        views: 0, impressions: 0, reach: 0, clicks: 0, erSum: 0,
      }
      existing.postCount++
      existing.likes       += p.metrics.likes
      existing.comments    += p.metrics.comments
      existing.shares      += p.metrics.shares
      existing.views       += p.metrics.views
      existing.impressions += p.metrics.impressions
      existing.reach       += p.metrics.reach
      existing.clicks      += p.metrics.clicks
      existing.erSum       += p.metrics.engagementRate
      platformMap.set(p.platform, existing)
    }
    const platforms = [...platformMap.values()].map((p) => ({
      ...p,
      engagementRate: p.postCount > 0 ? p.erSum / p.postCount : 0,
    }))

    return NextResponse.json({ posts, overview, platforms, nextCursor: null })
  } catch (error) {
    console.error('[/api/analytics] Erreur Late API :', error)
    return NextResponse.json({ error: 'Erreur lors de la récupération des analytics' }, { status: 500 })
  }
}
