/**
 * @file modules/platforms/hooks/usePlatforms.ts
 * @module platforms
 * @description Hook TanStack Query : liste les plateformes connectées de l'utilisateur.
 *   Gère le cache, le refetch automatique et les états de chargement/erreur.
 *
 * @example
 *   const { platforms, isLoading, error } = usePlatforms()
 *   if (isLoading) return <PlatformCardSkeleton />
 *   return platforms.map(p => <PlatformCard key={p.id} platform={p} />)
 */

'use client'

import { useQuery } from '@tanstack/react-query'

import type { PlatformListItem } from '@/modules/platforms/types'

// ─── Types de retour ──────────────────────────────────────────────────────────

interface UsePlatformsReturn {
  platforms: PlatformListItem[]
  isLoading: boolean
  isFetching: boolean
  error: Error | null
  refetch: () => void
}

// ─── Query Keys ───────────────────────────────────────────────────────────────

/**
 * Clés TanStack Query pour le module platforms.
 * Centralise les clés pour une invalidation cohérente du cache.
 */
export const platformQueryKeys = {
  /** Clé racine de toutes les queries platforms */
  all: ['platforms'] as const,
  /** Clé de la liste des plateformes connectées */
  list: () => [...platformQueryKeys.all, 'list'] as const,
}

// ─── Fetcher ──────────────────────────────────────────────────────────────────

/**
 * Récupère la liste des plateformes connectées depuis l'API.
 *
 * @returns Liste des plateformes connectées de l'utilisateur
 * @throws Error si la requête échoue (401, 500, etc.)
 */
async function fetchPlatforms(): Promise<PlatformListItem[]> {
  const response = await fetch('/api/platforms')

  if (!response.ok) {
    throw new Error(`Erreur lors du chargement des plateformes : ${response.status}`)
  }

  return response.json() as Promise<PlatformListItem[]>
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Hook principal pour accéder aux plateformes connectées.
 * Utilise TanStack Query pour le cache et la synchronisation.
 *
 * @returns {
 *   platforms: PlatformListItem[] — Liste des plateformes ([] par défaut)
 *   isLoading: boolean — Chargement initial
 *   isFetching: boolean — Refetch en cours (données déjà présentes)
 *   error: Error | null — Erreur de chargement
 *   refetch: () => void — Force un rechargement
 * }
 *
 * @example
 *   const { platforms, isLoading } = usePlatforms()
 *   const instagramAccount = platforms.find(p => p.platform === 'instagram')
 */
export function usePlatforms(): UsePlatformsReturn {
  const query = useQuery({
    queryKey: platformQueryKeys.list(),
    queryFn: fetchPlatforms,
    // Cache 5 minutes : les plateformes changent rarement
    staleTime: 1000 * 60 * 5,
    // Pas de refetch sur focus window (évite les requêtes inutiles en settings)
    refetchOnWindowFocus: false,
  })

  return {
    platforms: query.data ?? [],
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,
  }
}
