/**
 * @file modules/posts/components/AgentComposer/AgentComposerSkeleton.tsx
 * @module posts
 * @description Skeleton de l'AgentComposer reproduisant fidèlement la mise en page
 *   du composant réel lors du chargement initial de la page /compose.
 *
 *   Structure miroir de l'AgentComposer (étape "input") :
 *   - Header avec icône IA + label
 *   - Label "Votre instruction" + textarea (4 lignes)
 *   - Bouton microphone (fantôme)
 *   - Séparateur
 *   - Section médias : bouton d'ajout
 *   - Bouton "Générer le plan"
 *
 * @example
 *   // Dans app/(dashboard)/compose/loading.tsx :
 *   import { AgentComposerSkeleton } from '@/modules/posts/components/AgentComposer/AgentComposerSkeleton'
 *   export default function Loading() {
 *     return <div className="mx-auto max-w-3xl"><AgentComposerSkeleton /></div>
 *   }
 */

import { Skeleton } from '@/components/ui/skeleton'

// ─── Composant ────────────────────────────────────────────────────────────────

/**
 * Skeleton de l'AgentComposer (étape input).
 * Reproduit la structure card header + instruction + médias + bouton.
 */
export function AgentComposerSkeleton(): React.JSX.Element {
  return (
    <div className="rounded-xl border border-border bg-card shadow-sm">
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2.5 border-b border-border px-5 py-4">
        {/* Icône IA + label */}
        <Skeleton className="size-4 rounded" />
        <Skeleton className="h-4 w-20" />
      </div>

      {/* ── Corps ─────────────────────────────────────────────────────────── */}
      <div className="space-y-5 px-5 py-5">
        {/* Label "Votre instruction" */}
        <div className="space-y-2">
          <Skeleton className="h-3.5 w-32" />

          {/* Textarea (4 lignes) avec bouton microphone en bas à droite */}
          <div className="relative">
            <div className="space-y-2 rounded-lg border border-input p-3 pb-10">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-[90%]" />
              <Skeleton className="h-4 w-[75%]" />
              <Skeleton className="h-4 w-[50%]" />
            </div>
            {/* Bouton microphone fantôme */}
            <Skeleton className="absolute bottom-2.5 right-2.5 size-8 rounded-full" />
          </div>
        </div>

        {/* Séparateur */}
        <Skeleton className="h-px w-full" />

        {/* Section médias */}
        <div className="space-y-2">
          {/* Label "Médias" */}
          <Skeleton className="h-3.5 w-16" />
          {/* Zone de drop */}
          <Skeleton className="h-[72px] w-full rounded-lg" />
        </div>

        {/* Bouton "Générer le plan" à droite */}
        <div className="flex justify-end">
          <Skeleton className="h-10 w-40 rounded-lg" />
        </div>
      </div>
    </div>
  )
}
