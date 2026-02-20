/**
 * @file app/(dashboard)/compose/AgentComposerCard.tsx
 * @description Assemblage de l'AgentComposer dans une card — Client Component.
 *
 *   Ce fichier est un Client Component distinct de page.tsx (Server Component)
 *   pour permettre l'utilisation des hooks React (state, router) dans AgentComposer.
 *
 *   Il remplace entièrement l'ancien PostComposerCard.
 *
 * @example
 *   // Depuis page.tsx (Server Component) :
 *   <Suspense fallback={<AgentComposerSkeleton />}>
 *     <AgentComposerCard />
 *   </Suspense>
 */

'use client'

import { AgentComposer } from '@/modules/posts/components/AgentComposer'

/**
 * Wrapper client de l'AgentComposer.
 * Séparé de page.tsx pour permettre l'usage de hooks côté client
 * tout en gardant page.tsx comme Server Component (métadonnées, SSR).
 */
export function AgentComposerCard(): React.JSX.Element {
  return (
    <AgentComposer className="rounded-xl border border-border bg-card shadow-sm" />
  )
}
