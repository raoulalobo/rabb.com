/**
 * @file modules/posts/components/PostComposeList/PostComposeListSkeleton.tsx
 * @module posts
 * @description Skeleton de la liste des brouillons sur /compose.
 *   Reproduit fidèlement la structure de PostComposeList (même layout flex, mêmes proportions).
 *   Affiché pendant le chargement initial des posts DRAFT.
 *
 * @example
 *   import { PostComposeListSkeleton } from '@/modules/posts/components/PostComposeList/PostComposeListSkeleton'
 *   // Dans loading.tsx ou Suspense fallback
 *   <PostComposeListSkeleton />
 */

import { Skeleton } from '@/components/ui/skeleton'

/**
 * Skeleton de la liste des brouillons.
 * Affiche 4 cartes skeleton avec la même structure que PostComposeCard.
 */
export function PostComposeListSkeleton(): React.JSX.Element {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="flex gap-3 rounded-xl border border-border bg-card p-4"
        >
          {/* Icône plateforme (carré 32px) */}
          <Skeleton className="size-8 shrink-0 rounded-md" />

          {/* Contenu */}
          <div className="flex-1 space-y-2 min-w-0">
            {/* Nom de la plateforme + badge statut */}
            <div className="flex items-center gap-2">
              <Skeleton className="h-3.5 w-20" />
              <Skeleton className="h-5 w-14 rounded-full" />
            </div>

            {/* Texte tronqué (2 lignes) */}
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />

            {/* Date planifiée (optionnelle) */}
            <Skeleton className="h-3 w-32" />
          </div>

          {/* Actions (3 boutons) */}
          <div className="flex shrink-0 items-start gap-1.5">
            <Skeleton className="h-7 w-16 rounded-md" />
            <Skeleton className="h-7 w-7 rounded-md" />
          </div>
        </div>
      ))}
    </div>
  )
}
