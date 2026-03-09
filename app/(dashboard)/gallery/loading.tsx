/**
 * @file app/(dashboard)/gallery/loading.tsx
 * @description Skeleton de la page Media Library (chargement SSR).
 *
 *   Activé automatiquement par Next.js App Router via le Suspense natif.
 *   Reproduit fidèlement la structure de gallery/page.tsx (v2 Media Library) :
 *   - En-tête : titre + description
 *   - Bande de tabs dossiers (1 tab + bouton "+")
 *   - Zone d'upload (rectangle arrondi)
 *   - Barre de filtres (type toggle + tri + vue)
 *   - 6 lignes de tableau (vue liste par défaut du skeleton)
 *
 * @see app/(dashboard)/gallery/page.tsx
 */

import { Skeleton } from '@/components/ui/skeleton'

/**
 * Skeleton de la page Media Library.
 * Reproduit la disposition complète : header, tabs, upload, filtres, tableau.
 */
export default function GalleryLoading(): React.JSX.Element {
  return (
    <div className="space-y-6">
      {/* ── Skeleton en-tête ─────────────────────────────────────────────── */}
      <div className="space-y-2">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-4 w-96" />
      </div>

      {/* ── Skeleton tabs dossiers ───────────────────────────────────────── */}
      <div className="flex items-center gap-2 border-b border-border pb-0">
        {/* Tab "Tous" actif */}
        <Skeleton className="h-9 w-14 rounded-none rounded-t" />
        {/* 2 tabs dossiers */}
        <Skeleton className="h-9 w-28 rounded-none rounded-t" />
        <Skeleton className="h-9 w-24 rounded-none rounded-t" />
        {/* Bouton "Nouveau dossier" */}
        <Skeleton className="ml-1 h-7 w-32 rounded" />
      </div>

      {/* ── Skeleton zone d'upload ────────────────────────────────────────── */}
      <Skeleton className="h-28 w-full rounded-lg" />

      {/* ── Skeleton barre de filtres ─────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        {/* Toggle type */}
        <Skeleton className="h-8 w-36 rounded-md" />
        {/* 2 badges de tag */}
        <Skeleton className="h-6 w-16 rounded-full" />
        <Skeleton className="h-6 w-20 rounded-full" />
        {/* Spacer */}
        <div className="flex-1" />
        {/* Count */}
        <Skeleton className="h-4 w-16 rounded" />
        {/* Bouton sélection */}
        <Skeleton className="h-8 w-28 rounded-md" />
        {/* Dropdown tri */}
        <Skeleton className="h-8 w-28 rounded-md" />
        {/* Toggle vue */}
        <Skeleton className="h-8 w-16 rounded-md" />
      </div>

      {/* ── Skeleton vue liste (6 lignes) ────────────────────────────────── */}
      <div className="overflow-hidden rounded-lg border border-border">
        {/* En-tête du tableau */}
        <div className="flex items-center gap-4 border-b border-border bg-muted/50 px-3 py-2.5">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-20" />
          <div className="flex-1" />
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-4 w-20" />
        </div>

        {/* 6 lignes de données */}
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 border-b border-border/60 px-3 py-3 last:border-0"
          >
            {/* Miniature + nom */}
            <div className="flex items-center gap-2.5">
              <Skeleton className="size-8 rounded" />
              <Skeleton className="h-4 w-36" />
            </div>
            {/* Dossier */}
            <Skeleton className="hidden h-4 w-24 md:block" />
            {/* Tags */}
            <Skeleton className="hidden h-5 w-14 rounded-full lg:block" />
            {/* Spacer */}
            <div className="flex-1" />
            {/* Type */}
            <Skeleton className="h-4 w-12" />
            {/* Taille */}
            <Skeleton className="hidden h-4 w-14 sm:block" />
            {/* Date */}
            <Skeleton className="hidden h-4 w-20 md:block" />
          </div>
        ))}
      </div>
    </div>
  )
}
