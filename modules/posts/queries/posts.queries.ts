/**
 * @file modules/posts/queries/posts.queries.ts
 * @module posts
 * @description Clés et fetchers TanStack Query pour le module posts.
 *   Centralise la définition des queryKeys pour garantir la cohérence du cache.
 *
 * @example
 *   import { postQueryKeys, fetchCalendarPosts } from '@/modules/posts/queries/posts.queries'
 *   useQuery(postQueryKeys.calendar(2024, 3))
 *
 *   import { composeQueryKey, fetchComposePage } from '@/modules/posts/queries/posts.queries'
 *   useInfiniteQuery({ queryKey: composeQueryKey(filters), ... })
 */

import type { Post } from '@/modules/posts/types'

import type { DateRange } from 'react-day-picker'


// ─── Types pour le mode compose (infinite scroll) ────────────────────────────

/**
 * Une page de résultats de l'endpoint /api/posts?compose=1.
 * Utilisée comme type de page dans useInfiniteQuery<ComposePage>.
 */
export interface ComposePage {
  /** Posts de cette page */
  posts: Post[]
  /** ID du dernier post pour récupérer la page suivante, ou null si dernière page */
  nextCursor: string | null
}

/**
 * Filtres serveur appliqués à la requête /compose.
 * Chaque changement de filtre réinitialise TanStack Query à la page 1
 * car les filtres font partie de la queryKey.
 *
 * @example
 *   const filters: ComposeFilters = {
 *     platforms: ['instagram', 'tiktok'],
 *     dateRange: { from: new Date('2026-02-01'), to: new Date('2026-02-28') },
 *     statuses: ['DRAFT'],
 *   }
 */
export interface ComposeFilters {
  /** Plateformes sélectionnées (vide = tout afficher) */
  platforms: string[]
  /** Intervalle de date sur scheduledFor (undefined = tout afficher) */
  dateRange: DateRange | undefined
  /**
   * Statuts sélectionnés (vide = DRAFT + SCHEDULED par défaut côté serveur).
   * Appliqué côté serveur via le paramètre `statuses` de /api/posts.
   */
  statuses: Post['status'][]
  /**
   * Mot-clé de recherche dans le contenu des posts (vide = pas de filtre texte).
   * Transmis à l'API via ?search=<mot> → filtre Prisma ILIKE '%mot%'.
   */
  queryText: string
}

// ─── Clés de cache TanStack Query ─────────────────────────────────────────────

/**
 * Hiérarchie de clés pour le module posts.
 * Structure : ['posts'] → ['posts', 'calendar'] → ['posts', 'calendar', year, month]
 *
 * Cette hiérarchie permet d'invalider sélectivement :
 * - Tous les posts : invalidate(['posts'])
 * - Tous les calendriers : invalidate(['posts', 'calendar'])
 * - Un mois précis : invalidate(['posts', 'calendar', 2024, 3])
 */
export const postQueryKeys = {
  /** Clé racine de tous les posts */
  all: () => ['posts'] as const,

  /** Toutes les vues calendrier */
  calendars: () => ['posts', 'calendar'] as const,

  /**
   * Vue calendrier d'un mois précis.
   *
   * @param year - Année (ex: 2024)
   * @param month - Mois 1-indexé (ex: 3 pour mars)
   */
  calendar: (year: number, month: number) => ['posts', 'calendar', year, month] as const,
}

/**
 * Clé de query pour le mode compose.
 * Inclut les filtres pour que TanStack Query réinitialise automatiquement
 * à la page 1 quand platform, dateRange ou statuses change.
 *
 * @param filters - Filtres serveur actifs (platforms + dateRange + statuses)
 * @returns Clé de query stable et sérialisable
 *
 * @example
 *   const key = composeQueryKey({ platforms: ['instagram'], dateRange: undefined, statuses: ['DRAFT'] })
 *   // → ['posts', 'compose', ['instagram'], undefined, ['DRAFT']]
 */
export const composeQueryKey = (filters: ComposeFilters): readonly unknown[] =>
  // queryText inclus dans la clé → TanStack Query recharge la page 1 à chaque nouveau mot-clé
  ['posts', 'compose', filters.platforms, filters.dateRange, filters.statuses, filters.queryText] as const

// ─── Fetchers ─────────────────────────────────────────────────────────────────

/**
 * Fetche les posts d'un mois pour le calendrier.
 * Appelle GET /api/posts?year=...&month=...
 *
 * @param year - Année
 * @param month - Mois 1-indexé
 * @returns Liste des posts du mois
 * @throws Error si la réponse n'est pas OK
 *
 * @example
 *   const posts = await fetchCalendarPosts(2024, 3)
 */
export async function fetchCalendarPosts(year: number, month: number): Promise<Post[]> {
  const response = await fetch(`/api/posts?year=${year}&month=${month}`, {
    // Revalider les données en arrière-plan après 1 minute
    next: { revalidate: 60 },
  })

  if (!response.ok) {
    throw new Error(`Erreur lors du chargement des posts : ${response.statusText}`)
  }

  return response.json() as Promise<Post[]>
}

/**
 * Fetche une page de posts pour /compose (mode infinite scroll).
 * Appelé par useInfiniteQuery avec pageParam = cursor | undefined.
 *
 * Construit les query params selon les filtres serveur actifs :
 * - `platforms` : filtre par plateforme (OR inclusif)
 * - `from` / `to` : filtre par intervalle de date sur scheduledFor
 * - `cursor` : ID du dernier post de la page précédente (absent = 1ère page)
 *
 * Désérialise les dates JSON (string → Date) avant de retourner les posts.
 *
 * @param filters - Filtres serveur (platforms + dateRange)
 * @param cursor - ID du dernier post de la page précédente (undefined = 1ère page)
 * @returns Page de posts avec curseur pour la page suivante
 * @throws Error si la réponse n'est pas OK
 *
 * @example
 *   // 1ère page, aucun filtre
 *   const page = await fetchComposePage({ platforms: [], dateRange: undefined }, undefined)
 *   // → { posts: [...25 items...], nextCursor: "clxxx" }
 *
 *   // Page suivante avec filtre instagram
 *   const page = await fetchComposePage({ platforms: ['instagram'], dateRange: undefined }, 'clxxx')
 *   // → { posts: [...25 items...], nextCursor: "clyyy" }
 */
export async function fetchComposePage(
  filters: ComposeFilters,
  cursor: string | undefined,
): Promise<ComposePage> {
  const params = new URLSearchParams({ compose: '1', limit: '25' })

  // Cursor de pagination (absent = 1ère page)
  if (cursor) params.set('cursor', cursor)

  // Filtre plateforme — liste séparée par virgule
  if (filters.platforms.length > 0) {
    params.set('platforms', filters.platforms.join(','))
  }

  // Filtre date — bornes sur scheduledFor
  if (filters.dateRange?.from) {
    params.set('from', filters.dateRange.from.toISOString())
    // Si `to` absent (sélection d'un seul jour) → utiliser `from` comme borne de fin
    params.set('to', (filters.dateRange.to ?? filters.dateRange.from).toISOString())
  }

  // Filtre statuts — appliqué côté serveur (remplace le filtre client-side)
  // Vide = serveur applique DRAFT+SCHEDULED par défaut
  if (filters.statuses.length > 0) {
    params.set('statuses', filters.statuses.join(','))
  }

  // Filtre texte libre — mot-clé extrait par IA (vide = pas de filtre texte)
  if (filters.queryText) {
    params.set('search', filters.queryText)
  }

  const res = await fetch(`/api/posts?${params.toString()}`)
  if (!res.ok) {
    throw new Error(`Erreur chargement /compose : ${res.status} ${res.statusText}`)
  }

  const data = (await res.json()) as { posts: unknown[]; nextCursor: string | null }

  // ── Désérialisation des dates ──────────────────────────────────────────────
  // JSON transporte les dates en string ISO — on les reconvertit en Date objects
  // pour que les comparaisons (>= / <=) fonctionnent correctement côté client.
  const posts = data.posts.map((p: unknown): Post => {
    // Double assertion unknown → Post pour la fusion de spread — TS strict ne permet pas
    // de spread directement Record<string,unknown> sur un type structurel précis.
    const raw = p as unknown as Post
    return {
      ...raw,
      scheduledFor: raw.scheduledFor ? new Date(raw.scheduledFor as unknown as string) : null,
      publishedAt: raw.publishedAt ? new Date(raw.publishedAt as unknown as string) : null,
      createdAt: new Date(raw.createdAt as unknown as string),
      updatedAt: new Date(raw.updatedAt as unknown as string),
    }
  })

  return { posts, nextCursor: data.nextCursor }
}
