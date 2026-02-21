/**
 * @file app/(dashboard)/compose/loading.tsx
 * @description Skeleton de chargement de la page /compose.
 *   Affiché par Next.js App Router pendant que la page se charge
 *   (avant le premier rendu de ComposePage).
 *
 *   Reproduit fidèlement la mise en page de compose/page.tsx :
 *   - En-tête avec titre + description
 *   - Bouton "Nouveau post" (skeleton)
 *   - 4 cartes de posts DRAFT skeleton
 */

import { Skeleton } from '@/components/ui/skeleton'
import { PostComposeListSkeleton } from '@/modules/posts/components/PostComposeList/PostComposeListSkeleton'

/**
 * Skeleton de la page /compose.
 * Correspond au layout de ComposePage : en-tête + bouton + liste de posts.
 */
export default function ComposeLoading(): React.JSX.Element {
  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6">
      {/* En-tête skeleton : titre + sous-titre */}
      <div className="space-y-2">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-4 w-72" />
      </div>

      {/* Bouton "Nouveau post" skeleton */}
      <div className="flex justify-end">
        <Skeleton className="h-9 w-32 rounded-md" />
      </div>

      {/* Liste des posts skeleton */}
      <PostComposeListSkeleton />
    </div>
  )
}
