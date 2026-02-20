/**
 * @file modules/posts/components/PostComposer/PostComposerSkeleton.tsx
 * @module posts
 * @description Skeleton du PostComposer qui reproduit fidèlement la mise en page
 *   du composant réel pendant le chargement initial.
 *
 *   Structure miroir de PostComposer :
 *   - Card header avec label
 *   - Zone de texte (textarea skeleton de 6 lignes)
 *   - Ligne séparatrice
 *   - Badges de plateformes
 *   - Ligne de médias
 *   - Ligne de planification
 *   - Séparateur
 *   - Footer avec boutons
 *
 * @example
 *   // Dans loading.tsx de la page /compose :
 *   export default function Loading() {
 *     return <PostComposerSkeleton />
 *   }
 *
 *   // Ou avec Suspense :
 *   <Suspense fallback={<PostComposerSkeleton />}>
 *     <PostComposer />
 *   </Suspense>
 */

import { Skeleton } from '@/components/ui/skeleton'

// ─── Composant ────────────────────────────────────────────────────────────────

/**
 * Skeleton du PostComposer.
 * Reproduit la structure card + éditeur + sélecteur + footer avec des blocs
 * animés (pulse) de dimensions correspondant au composant réel.
 */
export function PostComposerSkeleton(): React.JSX.Element {
  return (
    <div className="rounded-xl border border-border bg-card shadow-sm">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="border-b border-border p-4">
        {/* Label "Nouveau post" */}
        <Skeleton className="h-4 w-28" />
      </div>

      {/* ── Corps ──────────────────────────────────────────────────────────── */}
      <div className="space-y-5 p-4">
        {/* Zone de texte (6 lignes approximées) */}
        <div className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-[95%]" />
          <Skeleton className="h-4 w-[88%]" />
          <Skeleton className="h-4 w-[92%]" />
          <Skeleton className="h-4 w-[75%]" />
          <Skeleton className="h-4 w-[60%]" />
        </div>

        {/* Compteur de caractères (à droite) */}
        <div className="flex justify-end">
          <Skeleton className="h-3 w-8" />
        </div>

        {/* Séparateur */}
        <Skeleton className="h-px w-full" />

        {/* Section plateformes : label + 3 badges */}
        <div className="space-y-2">
          <Skeleton className="h-3 w-16" />
          <div className="flex gap-2">
            {/* Badges de plateforme (3 badges de largeurs variables) */}
            <Skeleton className="h-7 w-24 rounded-full" />
            <Skeleton className="h-7 w-20 rounded-full" />
            <Skeleton className="h-7 w-28 rounded-full" />
          </div>
        </div>

        {/* Section médias : bouton d'ajout */}
        <Skeleton className="h-9 w-40 rounded-lg" />

        {/* Section planification : label + input */}
        <div className="space-y-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-9 w-52 rounded-md" />
        </div>
      </div>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <div className="border-t border-border p-4">
        <div className="flex items-center justify-end gap-2">
          {/* Bouton Brouillon */}
          <Skeleton className="h-9 w-24 rounded-md" />
          {/* Bouton Planifier */}
          <Skeleton className="h-9 w-24 rounded-md" />
        </div>
      </div>
    </div>
  )
}
