/**
 * @file app/(dashboard)/calendar/CalendarClient.tsx
 * @description Wrapper Client Component pour la grille calendrier.
 *   Séparé de page.tsx (Server Component) car CalendarGrid utilise
 *   des hooks React (useState, TanStack Query).
 *
 *   Même pattern que PostComposerCard pour la page /compose.
 */

'use client'

import { CalendarGrid } from '@/modules/posts/components/CalendarGrid/CalendarGrid'

/**
 * Wrapper client pour CalendarGrid.
 * Rendu dans une Suspense boundary côté serveur (page.tsx).
 */
export function CalendarClient(): React.JSX.Element {
  return <CalendarGrid />
}
