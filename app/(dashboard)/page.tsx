/**
 * @file app/(dashboard)/page.tsx
 * @description Page d'accueil du dashboard (/dashboard).
 *   Affiche un résumé rapide (stats, posts récents).
 *   Phase 01 : placeholder — sera enrichi en phase 06 (analytics).
 */

import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Dashboard',
}

/**
 * Page principale du dashboard.
 * Server Component — pas d'état client, pas de 'use client'.
 */
export default function DashboardPage(): React.JSX.Element {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Bonjour 👋</h1>
        <p className="text-muted-foreground mt-1">
          Voici un aperçu de votre activité.
        </p>
      </div>

      {/* Placeholder — statistiques rapides (phase 06) */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {['Posts publiés', 'Posts planifiés', 'Impressions', 'Engagement'].map((label) => (
          <div key={label} className="rounded-lg border bg-card p-6">
            <p className="text-sm font-medium text-muted-foreground">{label}</p>
            <p className="text-3xl font-bold mt-2">—</p>
          </div>
        ))}
      </div>
    </div>
  )
}
