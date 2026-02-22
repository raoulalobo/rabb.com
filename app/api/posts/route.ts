/**
 * @file app/api/posts/route.ts
 * @description Route Handler GET : liste les posts de l'utilisateur.
 *   Supporte trois modes de filtrage :
 *
 *   Mode compose (infinite scroll) :
 *     GET /api/posts?compose=1&cursor=clxxx&limit=25&platforms=instagram,tiktok&statuses=DRAFT&from=ISO&to=ISO
 *     → { posts: [...], nextCursor: "clxxx" | null }
 *     Utilisé par /compose avec useInfiniteQuery.
 *     Filtre serveur : platform (platforms) + statuts (statuses) + date (from/to sur scheduledFor).
 *     Tri : scheduledFor DESC NULLS LAST, puis createdAt DESC.
 *
 *   Mode brouillons (liste simple, héritage) :
 *     GET /api/posts?status=DRAFT
 *     → Posts avec ce statut (pour rétrocompatibilité)
 *
 *   Mode calendrier (défaut) :
 *     GET /api/posts?year=2024&month=3
 *     → Posts du mois (planifiés ou publiés dans cette période)
 *
 * @example
 *   // Compose infinite scroll — 1ère page
 *   const res = await fetch('/api/posts?compose=1')
 *   const { posts, nextCursor } = await res.json()
 *
 *   // Compose infinite scroll — page suivante
 *   const res = await fetch(`/api/posts?compose=1&cursor=${nextCursor}`)
 *
 *   // Compose avec filtre plateforme
 *   const res = await fetch('/api/posts?compose=1&platforms=instagram,tiktok')
 *
 *   // Calendrier
 *   const res = await fetch('/api/posts?year=2024&month=3')
 *
 *   // Brouillons
 *   const res = await fetch('/api/posts?status=DRAFT')
 */

import { endOfDay, startOfDay } from 'date-fns'
import { headers } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// ─── Sélection commune des champs Post ────────────────────────────────────────

/**
 * Champs sélectionnés dans toutes les requêtes posts.
 * Centralisé pour garantir la cohérence et éviter la duplication.
 */
const POST_SELECT = {
  id: true,
  userId: true,
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
} as const

/**
 * GET /api/posts
 * Retourne les posts selon le mode demandé (compose, brouillons ou calendrier).
 *
 * @param request - Requête avec query params selon le mode
 * @returns 200 avec les posts | 400 si params invalides | 401 si non authentifié
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  // ─── Authentification ─────────────────────────────────────────────────────
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  const { searchParams } = request.nextUrl
  const userId = session.user.id

  // ─── Mode compose : pagination cursor infinie ──────────────────────────────
  // Activé par ?compose=1 — utilisé par useInfiniteQuery sur /compose
  if (searchParams.get('compose') === '1') {
    return handleComposeMode(searchParams, userId)
  }

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
        userId,
        status: statusParam as 'DRAFT' | 'SCHEDULED' | 'PUBLISHED' | 'FAILED',
      },
      select: POST_SELECT,
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
      userId,
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
    select: POST_SELECT,
    orderBy: [
      // Trier par date de planification, puis par date de création
      { scheduledFor: 'asc' },
      { createdAt: 'desc' },
    ],
  })

  return NextResponse.json(posts)
}

// ─── Handler mode compose ──────────────────────────────────────────────────────

/**
 * Gère la pagination cursor pour la page /compose.
 *
 * Filtre serveur :
 * - `platforms` : liste de plateformes séparées par virgule (ex: "instagram,tiktok")
 * - `from` / `to` : borne de date sur scheduledFor (ISO 8601)
 *
 * Pagination cursor :
 * - `cursor` : ID du dernier post de la page précédente
 * - `limit` : nombre de posts par page (1–50, défaut 25)
 *
 * Réponse :
 * - `posts` : tableau de posts
 * - `nextCursor` : ID du dernier post retourné, ou null si dernière page
 *
 * @param searchParams - Paramètres de la requête
 * @param userId - ID de l'utilisateur authentifié
 * @returns NextResponse avec { posts, nextCursor }
 *
 * @example
 *   // 1ère page
 *   GET /api/posts?compose=1
 *   → { posts: [...25 items...], nextCursor: "clxxx" }
 *
 *   // Page suivante
 *   GET /api/posts?compose=1&cursor=clxxx
 *   → { posts: [...25 items...], nextCursor: "clyyy" }
 *
 *   // Dernière page
 *   GET /api/posts?compose=1&cursor=clyyy
 *   → { posts: [...12 items...], nextCursor: null }
 *
 *   // Avec filtre plateforme + date
 *   GET /api/posts?compose=1&platforms=instagram&from=2026-02-01T00:00:00Z&to=2026-02-28T23:59:59Z
 */
// ─── Statuts valides en mode compose ──────────────────────────────────────────

/** DRAFT, SCHEDULED, PUBLISHED et FAILED sont des statuts valides en mode compose */
const COMPOSE_STATUSES = ['DRAFT', 'SCHEDULED', 'PUBLISHED', 'FAILED'] as const
type ComposeStatus = (typeof COMPOSE_STATUSES)[number]

async function handleComposeMode(
  searchParams: URLSearchParams,
  userId: string,
): Promise<NextResponse> {
  // ── Parsing des paramètres ─────────────────────────────────────────────────

  // Limite : 1–50, défaut 25
  const limitRaw = parseInt(searchParams.get('limit') ?? '25', 10)
  const limit = Math.min(Math.max(isNaN(limitRaw) ? 25 : limitRaw, 1), 50)

  // Cursor : ID du dernier post de la page précédente (absent = 1ère page)
  const cursor = searchParams.get('cursor') ?? undefined

  // Filtre plateforme : "instagram,tiktok" → ["instagram", "tiktok"]
  const platformFilter = (searchParams.get('platforms') ?? '')
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean)

  // Filtre statuts : "DRAFT,SCHEDULED,FAILED" → ["DRAFT", "SCHEDULED", "FAILED"]
  // Absent ou vide = tout afficher (DRAFT + SCHEDULED + PUBLISHED + FAILED par défaut)
  const rawStatuses = searchParams.get('statuses')
  const statusFilter: ComposeStatus[] = rawStatuses
    ? rawStatuses
        .split(',')
        .map((s) => s.trim())
        // Valider chaque statut — ignorer les valeurs invalides (sécurité)
        .filter((s): s is ComposeStatus =>
          COMPOSE_STATUSES.includes(s as ComposeStatus),
        )
    : [...COMPOSE_STATUSES] // Défaut : DRAFT + SCHEDULED

  // Si tous les statuts ont été filtrés (valeurs invalides uniquement) → défaut
  const resolvedStatuses: ComposeStatus[] =
    statusFilter.length > 0 ? statusFilter : [...COMPOSE_STATUSES]

  // Filtre date : bornes sur scheduledFor
  const fromParam = searchParams.get('from')
  const toParam = searchParams.get('to')

  // ── Construction du filtre WHERE ───────────────────────────────────────────

  // Filtre de date — appliqué uniquement si `from` est présent
  const dateFilter =
    fromParam
      ? {
          scheduledFor: {
            // Début du jour de `from` jusqu'à la fin du jour de `to` (ou `from` si absent)
            gte: startOfDay(new Date(fromParam)),
            lte: endOfDay(new Date(toParam ?? fromParam)),
          },
        }
      : {}

  try {
    // ── Requête Prisma — pagination cursor ──────────────────────────────────
    const posts = await prisma.post.findMany({
      where: {
        userId,
        // Filtre statuts dynamique (DRAFT, SCHEDULED, ou les deux selon le paramètre)
        status: { in: resolvedStatuses },
        // Filtre plateforme optionnel — OR inclusif sur la plateforme du post
        ...(platformFilter.length > 0 && { platform: { in: platformFilter } }),
        // Filtre date optionnel — sur scheduledFor
        ...dateFilter,
      },
      select: POST_SELECT,
      orderBy: [
        // Posts planifiés d'abord (nulls en dernier), puis par création décroissante
        { scheduledFor: { sort: 'desc', nulls: 'last' } },
        { createdAt: 'desc' },
      ],
      // Pagination cursor : sauter le post dont l'ID est le cursor
      ...(cursor !== undefined && {
        cursor: { id: cursor },
        skip: 1,
      }),
      // Récupérer `limit` posts
      take: limit,
    })

    // nextCursor = ID du dernier post si la page est complète, null sinon
    const nextCursor = posts.length === limit ? posts[posts.length - 1].id : null

    return NextResponse.json({ posts, nextCursor })
  } catch (error) {
    // Le cursor est invalide (post supprimé entre deux pages)
    // Retourner une erreur 400 plutôt que de planter silencieusement
    const message = error instanceof Error ? error.message : 'Erreur inconnue'
    if (message.includes('Record to fetch does not exist') || cursor !== undefined) {
      return NextResponse.json({ error: 'cursor_invalid' }, { status: 400 })
    }
    throw error
  }
}
