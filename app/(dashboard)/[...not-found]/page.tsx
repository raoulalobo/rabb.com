/**
 * @file app/(dashboard)/[...not-found]/page.tsx
 * @module app/dashboard
 * @description Catch-all route pour intercepter toutes les URL inconnues
 *   sous le groupe de routes (dashboard).
 *
 *   Rôle unique : appeler `notFound()` de Next.js, ce qui déclenche
 *   le rendu de `app/(dashboard)/not-found.tsx` — lequel hérite du layout
 *   dashboard (Sidebar + Header).
 *
 *   Sans ce fichier, les routes inconnues sous /dashboard/* remonteraient
 *   jusqu'au `app/not-found.tsx` racine (sans sidebar ni header).
 *
 *   Exemples de routes interceptées par ce catch-all :
 *   - /dashboard/une-page-inconnue
 *   - /compose/blah/blah
 *   - /calendar/2025/semaine/99
 *   - /n-importe-quoi-sous-le-dashboard
 *
 *   Le paramètre `not-found` (tableau de segments) est ignoré volontairement :
 *   peu importe le chemin, la réponse est toujours la même — une 404.
 *
 * @example
 *   // Navigation vers une URL inconnue :
 *   // → /dashboard/inexistant
 *   // → Ce composant est rendu (Server Component)
 *   // → notFound() est appelé
 *   // → Next.js rend app/(dashboard)/not-found.tsx avec le layout dashboard
 */

import { notFound } from 'next/navigation'

/**
 * Page catch-all — intercepte toutes les routes inconnues du dashboard.
 * Ne retourne rien : `notFound()` lève une erreur interne Next.js
 * qui déclenche immédiatement le rendu de `not-found.tsx`.
 *
 * @returns never — `notFound()` interrompt le rendu avant tout return
 */
export default function DashboardCatchAll(): never {
  // notFound() déclenche le not-found.tsx le plus proche dans l'arborescence,
  // soit app/(dashboard)/not-found.tsx — rendu avec Sidebar + Header.
  notFound()
}
