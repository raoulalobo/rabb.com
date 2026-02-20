/**
 * @file app/(dashboard)/calendar/page.tsx
 * @description Page du calendrier de planification.
 *   Affiche la grille mensuelle des posts (DRAFT, SCHEDULED, PUBLISHED, FAILED).
 *   Navigation entre les mois directement dans le composant CalendarGrid.
 *
 * @example
 *   // Route : GET /calendar
 */

import { Suspense } from 'react'


import { CalendarGridSkeleton } from '@/modules/posts/components/CalendarGrid/CalendarGridSkeleton'

import { CalendarClient } from './CalendarClient'

import type { Metadata } from 'next'

// ─── Métadonnées ──────────────────────────────────────────────────────────────

export const metadata: Metadata = {
  title: 'Calendrier — rabb',
  description: 'Visualisez et gérez tous vos posts planifiés sur un seul calendrier.',
}

// ─── Page ─────────────────────────────────────────────────────────────────────

/**
 * Page /calendar : vue mensuelle des posts planifiés.
 * CalendarClient est un Client Component (navigation de mois, TanStack Query).
 */
export default function CalendarPage(): React.JSX.Element {
  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6">
      {/* ── En-tête ───────────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Calendrier</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Tous vos posts planifiés, au même endroit.
        </p>
      </div>

      {/* ── Légende des statuts ───────────────────────────────────────────── */}
      <StatusLegend />

      {/* ── Grille calendrier (Client Component) ─────────────────────────── */}
      <Suspense fallback={<CalendarGridSkeleton />}>
        <CalendarClient />
      </Suspense>
    </div>
  )
}

// ─── Légende ──────────────────────────────────────────────────────────────────

/**
 * Légende des couleurs de statut affichée au-dessus de la grille.
 */
function StatusLegend(): React.JSX.Element {
  const statuses = [
    { label: 'Brouillon', className: 'bg-muted/80 text-muted-foreground' },
    { label: 'Planifié', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
    { label: 'Publié', className: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' },
    { label: 'Échoué', className: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' },
  ]

  return (
    <div className="flex flex-wrap gap-2">
      {statuses.map(({ label, className }) => (
        <span
          key={label}
          className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${className}`}
        >
          {label}
        </span>
      ))}
    </div>
  )
}
