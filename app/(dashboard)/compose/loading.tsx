/**
 * @file app/(dashboard)/compose/loading.tsx
 * @description Skeleton de chargement de la page /compose.
 *   Affiché par Next.js App Router pendant que la page se charge
 *   (avant le premier rendu de ComposePage).
 *
 *   Reproduit fidèlement la mise en page de compose/page.tsx :
 *   - En-tête avec titre + description
 *   - Card de l'AgentComposer avec skeleton interne
 */

import { Skeleton } from '@/components/ui/skeleton'
import { AgentComposerSkeleton } from '@/modules/posts/components/AgentComposer/AgentComposerSkeleton'

/**
 * Skeleton de la page /compose.
 * Correspond pixel-perfect au layout de ComposePage.
 */
export default function ComposeLoading(): React.JSX.Element {
  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6">
      {/* En-tête skeleton : titre + sous-titre */}
      <div className="space-y-2">
        <Skeleton className="h-8 w-36" />
        <Skeleton className="h-4 w-80" />
      </div>

      {/* Skeleton de l'AgentComposer */}
      <AgentComposerSkeleton />
    </div>
  )
}
