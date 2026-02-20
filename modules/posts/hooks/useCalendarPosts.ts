/**
 * @file modules/posts/hooks/useCalendarPosts.ts
 * @module posts
 * @description Hook TanStack Query pour charger les posts d'un mois donné.
 *   Utilisé par la vue calendrier pour afficher les posts par date.
 *
 * @example
 *   const { posts, isLoading } = useCalendarPosts(2024, 3)
 *   // posts : Post[] groupés par date
 */

'use client'

import { useQuery } from '@tanstack/react-query'

import { fetchCalendarPosts, postQueryKeys } from '@/modules/posts/queries/posts.queries'
import type { Post } from '@/modules/posts/types'

// ─── Types ────────────────────────────────────────────────────────────────────

interface UseCalendarPostsReturn {
  /** Posts du mois chargés depuis l'API */
  posts: Post[]
  /** Vrai pendant le premier chargement */
  isLoading: boolean
  /** Erreur éventuelle */
  error: Error | null
  /** Posts groupés par date (clé: "YYYY-MM-DD") */
  postsByDate: Map<string, Post[]>
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Formate une date en clé "YYYY-MM-DD" pour le regroupement.
 * Utilise la date locale (pas UTC) pour coller à l'affichage utilisateur.
 *
 * @param date - Date à formater
 * @returns Clé de date au format "YYYY-MM-DD"
 *
 * @example
 *   toDateKey(new Date('2024-03-15T10:00:00')) // → "2024-03-15"
 */
function toDateKey(date: Date | null): string | null {
  if (!date) return null
  const d = new Date(date)
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/**
 * Groupe une liste de posts par date de planification ou de publication.
 *
 * @param posts - Liste de posts à regrouper
 * @returns Map clé=YYYY-MM-DD, valeur=Post[]
 */
function groupPostsByDate(posts: Post[]): Map<string, Post[]> {
  const map = new Map<string, Post[]>()

  for (const post of posts) {
    // Priorité : scheduledFor > publishedAt > createdAt
    const dateToUse = post.scheduledFor ?? post.publishedAt ?? post.createdAt
    const key = toDateKey(dateToUse)
    if (!key) continue

    const existing = map.get(key) ?? []
    map.set(key, [...existing, post])
  }

  return map
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Hook TanStack Query pour les posts du calendrier.
 * Met en cache les résultats pendant 5 minutes.
 * Recharge automatiquement quand la fenêtre reprend le focus.
 *
 * @param year - Année (ex: 2024)
 * @param month - Mois 1-indexé (ex: 3 pour mars)
 * @returns Posts du mois avec groupement par date
 *
 * @example
 *   const { posts, postsByDate, isLoading } = useCalendarPosts(2024, 3)
 *
 *   // Accéder aux posts du 15 mars :
 *   const postsOnMarch15 = postsByDate.get('2024-03-15') ?? []
 */
export function useCalendarPosts(year: number, month: number): UseCalendarPostsReturn {
  const { data, isLoading, error } = useQuery({
    queryKey: postQueryKeys.calendar(year, month),
    queryFn: () => fetchCalendarPosts(year, month),
    // Cache de 5 minutes : évite les re-fetches fréquents lors de la navigation
    staleTime: 5 * 60 * 1000,
    // Ne pas recharger en arrière-plan à chaque focus (calendrier peu dynamique)
    refetchOnWindowFocus: false,
  })

  const posts = data ?? []
  const postsByDate = groupPostsByDate(posts)

  return {
    posts,
    isLoading,
    error: error as Error | null,
    postsByDate,
  }
}
