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
import { STATUS_CHIP_CLASSES, STATUS_LABELS } from '@/modules/posts/utils/status-styles'
import type { Post } from '@/modules/posts/types'

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
/**
 * Légende des couleurs de statut affichée au-dessus de la grille.
 * Les classes et libellés proviennent de status-styles.ts (source de vérité)
 * pour rester cohérents avec les chips de la grille.
 */
function StatusLegend(): React.JSX.Element {
  // Ordre d'affichage souhaité dans la légende
  const orderedStatuses: Post['status'][] = ['DRAFT', 'SCHEDULED', 'PUBLISHED', 'FAILED']

  return (
    <div className="flex flex-wrap gap-2">
      {orderedStatuses.map((status) => (
        <span
          key={status}
          className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${STATUS_CHIP_CLASSES[status]}`}
        >
          {STATUS_LABELS[status]}
        </span>
      ))}
    </div>
  )
}
