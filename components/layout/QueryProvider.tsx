/**
 * @file QueryProvider.tsx
 * @module layout
 * @description Provider TanStack Query côté client.
 *   Encapsule QueryClientProvider pour qu'il soit utilisable dans le layout
 *   racine (Server Component) via un sous-composant 'use client'.
 *
 *   Configuration :
 *   - staleTime: 60s — les données restent fraîches 60s (évite les refetch inutiles)
 *   - retry: 1 — un seul retry en cas d'erreur réseau
 *
 * @example
 *   // app/layout.tsx
 *   <QueryProvider>{children}</QueryProvider>
 */

'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'

interface QueryProviderProps {
  children: React.ReactNode
}

/**
 * Fournit le contexte TanStack Query à toute l'application.
 * Crée un QueryClient stable par rendu (useState garantit une seule instance par session).
 *
 * @param props.children - Arborescence React à envelopper
 * @returns Provider TanStack Query avec QueryClient configuré
 */
export function QueryProvider({ children }: QueryProviderProps): React.JSX.Element {
  // useState garantit que le QueryClient n'est instancié qu'une seule fois
  // (et non à chaque rendu, ce qui viderait le cache)
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Données considérées fraîches pendant 60s → pas de refetch automatique
            staleTime: 60 * 1000,
            // Un seul retry en cas d'erreur (évite les boucles sur erreur 4xx)
            retry: 1,
          },
        },
      })
  )

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}
