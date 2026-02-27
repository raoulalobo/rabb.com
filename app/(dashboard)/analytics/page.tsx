/**
 * @file app/(dashboard)/analytics/page.tsx
 * @description Page analytics — tableau de bord des performances de publication.
 *
 *   Sections :
 *   1. Heatmap d'activité (GitHub-style)
 *   2. Évolution des followers par plateforme
 *   3. Métriques d'engagement (toggles + bar chart quotidien)
 *   4. Répartition par plateforme
 *   5. Meilleurs créneaux de publication (heatmap jour×heure)
 *   6. Top posts (classement ER / vues / likes)
 *   7. Fréquence de publication vs engagement
 *   8. Durée de vie du contenu (content decay)
 *   9. Grille des posts détaillés
 *
 *   Architecture :
 *   - page.tsx : Server Component (auth + métadonnées)
 *   - AnalyticsContent : Client Component (toutes les queries TanStack)
 *   - Filtres : AnalyticsFilters (Zustand store)
 *
 * @example
 *   // Route : GET /analytics
 */

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

import { auth } from '@/lib/auth'
import { AnalyticsContent } from '@/modules/analytics/components/AnalyticsContent'
import { AnalyticsFilters } from '@/modules/analytics/components/AnalyticsFilters'

import type { Metadata } from 'next'

// ─── Métadonnées ──────────────────────────────────────────────────────────────

export const metadata: Metadata = {
  title: 'Analytics — ogolong',
  description: 'Analysez les performances de vos publications sur tous vos réseaux sociaux.',
}

// ─── Page ─────────────────────────────────────────────────────────────────────

/**
 * Page analytics — Server Component.
 * Vérifie l'authentification, puis délègue le rendu à AnalyticsContent (Client).
 */
export default async function AnalyticsPage(): Promise<React.JSX.Element> {
  // ── Authentification ───────────────────────────────────────────────────────
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) redirect('/login')

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6">
      {/* ── En-tête ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Performances de vos publications sur tous vos réseaux sociaux.
          </p>
        </div>

        {/* Filtres (Client Component — accède au store Zustand) */}
        <AnalyticsFilters />
      </div>

      {/* ── Contenu principal (Client Component) ─────────────────────────── */}
      {/*
       * AnalyticsContent charge les 6 queries en parallèle via useAnalytics.
       * Affiche un skeleton par section pendant le chargement.
       */}
      <AnalyticsContent />
    </div>
  )
}
