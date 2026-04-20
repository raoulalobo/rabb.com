/**
 * @file app/(dashboard)/biolink/loading.tsx
 * @description Skeleton affiché pendant le chargement de `/biolink`.
 *
 *   Reproduit fidèlement la structure visuelle de l'éditeur :
 *   - En-tête (titre + URL + badge statut)
 *   - Barre d'onglets (4 onglets)
 *   - Card active (Infos par défaut) — avatar + champs texte + bouton save
 *
 *   Règle CLAUDE.md §11 : jamais de spinner générique.
 */

import { Skeleton } from '@/components/ui/skeleton'

/**
 * Skeleton de la page `/biolink`. Rendu statique — aucun état à gérer,
 * le layout Next.js le montre tant que le Server Component parent est en cours.
 *
 * @returns Skeleton fidèle à la forme finale de l'éditeur
 */
export default function BioLinkDashboardLoading(): React.JSX.Element {
  return (
    <div className="space-y-6">
      {/* ── Header : titre + URL + badge ─────────────────────────────────── */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-6 w-24 rounded-full" />
      </div>

      {/* ── Onglets ─────────────────────────────────────────────────────── */}
      <div className="flex gap-1 rounded-md border bg-muted/40 p-1">
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-8 w-20" />
      </div>

      {/* ── Card principale : Infos ─────────────────────────────────────── */}
      <div className="rounded-lg border bg-card p-6 space-y-6">
        {/* Card header */}
        <div className="space-y-2">
          <Skeleton className="h-6 w-20" />
          <Skeleton className="h-4 w-80" />
        </div>

        {/* Avatar + bouton upload */}
        <div className="flex items-center gap-4">
          <Skeleton className="size-16 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-3 w-40" />
            <Skeleton className="h-9 w-36" />
          </div>
        </div>

        {/* Textarea titre */}
        <div className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-16 w-full" />
        </div>

        {/* Textarea bio */}
        <div className="space-y-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-16 w-full" />
        </div>

        {/* Input handle */}
        <div className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-9 w-full" />
        </div>

        {/* Textarea tagline */}
        <div className="space-y-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-16 w-full" />
        </div>

        {/* Bouton save */}
        <div className="flex justify-end">
          <Skeleton className="h-9 w-40" />
        </div>

        {/* Bloc slug en bas */}
        <div className="border-t pt-6 space-y-2">
          <Skeleton className="h-4 w-48" />
          <div className="flex gap-2">
            <Skeleton className="h-9 flex-1" />
            <Skeleton className="h-9 w-28" />
          </div>
        </div>
      </div>
    </div>
  )
}
