/**
 * @file modules/posts/queries/posts.queries.ts
 * @module posts
 * @description Clés et fetchers TanStack Query pour le module posts.
 *   Les posts sont stockés chez Zernio — les fetchers appellent notre proxy
 *   /api/posts qui normalise la réponse Zernio.
 *
 * @example
 *   import { postQueryKeys, fetchCalendarPosts } from '@/modules/posts/queries/posts.queries'
 *   useQuery(postQueryKeys.calendar(2024, 3))
 */

import type { Post } from '@/modules/posts/types'

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

// ─── Fetchers ─────────────────────────────────────────────────────────────────

/**
 * Fetche les posts d'un mois pour le calendrier.
 * Appelle GET /api/posts?year=...&month=... (proxy vers Zernio).
 * La réponse est déjà normalisée par l'API route (mapZernioPost).
 *
 * Les dates sont reçues en JSON string et doivent être désérialisées
 * en objets Date côté client pour le groupement par date.
 *
 * @param year - Année
 * @param month - Mois 1-indexé
 * @returns Liste des posts du mois
 * @throws Error si la réponse n'est pas OK
 *
 * @example
 *   const posts = await fetchCalendarPosts(2026, 3)
 */
export async function fetchCalendarPosts(year: number, month: number): Promise<Post[]> {
  const response = await fetch(`/api/posts?year=${year}&month=${month}`)

  if (!response.ok) {
    throw new Error(`Erreur lors du chargement des posts : ${response.statusText}`)
  }

  // L'API route retourne Post[] normalisé, mais les dates sont des strings JSON
  const rawPosts = (await response.json()) as Post[]

  // Désérialiser les dates JSON string → Date objects
  return rawPosts.map((post) => ({
    ...post,
    scheduledFor: post.scheduledFor ? new Date(post.scheduledFor as unknown as string) : null,
    publishedAt: post.publishedAt ? new Date(post.publishedAt as unknown as string) : null,
    createdAt: new Date(post.createdAt as unknown as string),
    updatedAt: new Date(post.updatedAt as unknown as string),
  }))
}
