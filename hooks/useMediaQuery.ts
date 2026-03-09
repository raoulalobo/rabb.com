/**
 * @file hooks/useMediaQuery.ts
 * @description Hook React pour réagir aux media queries CSS.
 *   Permet d'adapter le rendu selon le viewport (ex: mobile vs desktop).
 *   SSR-safe : retourne `false` côté serveur jusqu'au premier mount client.
 *
 * @example
 *   // Détecte si l'écran est en mode mobile (< 768px)
 *   const isMobile = useMediaQuery('(max-width: 767px)')
 *
 *   // Détecte si l'écran est en mode tablette (768px – 1023px)
 *   const isTablet = useMediaQuery('(min-width: 768px) and (max-width: 1023px)')
 */

'use client'

import { useEffect, useState } from 'react'

/**
 * Écoute une media query CSS et retourne `true` si elle est active.
 *
 * @param query - Expression CSS media query (ex: "(max-width: 767px)")
 * @returns `true` si la media query correspond au viewport courant, `false` sinon.
 *          Retourne `false` pendant le SSR (hydratation sécurisée).
 *
 * @example
 *   const isMobile = useMediaQuery('(max-width: 767px)')
 *   if (isMobile) return <CompactView />
 *   return <FullView />
 */
export function useMediaQuery(query: string): boolean {
  // Initialisation à false pour le SSR (window n'existe pas côté serveur)
  const [matches, setMatches] = useState(false)

  useEffect(() => {
    // Crée l'objet MediaQueryList pour la query fournie
    const mql = window.matchMedia(query)

    // Synchronise l'état initial avec la valeur réelle du viewport
    setMatches(mql.matches)

    // Écoute les changements de viewport (resize, rotation écran)
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches)
    mql.addEventListener('change', handler)

    // Cleanup : retire l'écouteur au démontage du composant
    return () => mql.removeEventListener('change', handler)
  }, [query])

  return matches
}
