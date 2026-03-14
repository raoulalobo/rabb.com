/**
 * @file modules/biolink/components/BioPageStats/ClicksChart.tsx
 * @module biolink
 * @description Graphique en barres horizontales des clics par lien (recharts).
 *   Affiche chaque lien avec son nombre de clics, trié du plus cliqué au moins cliqué.
 *   Utilise recharts BarChart en layout vertical (barres horizontales).
 *
 * @example
 *   <ClicksChart links={bioPage.links} />
 */

'use client'

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import type { BioLink } from '@/modules/biolink/types'

// ─── Props ────────────────────────────────────────────────────────────────────

interface ClicksChartProps {
  /** Liste des liens avec leurs compteurs de clics */
  links: BioLink[]
}

// ─── Composant ────────────────────────────────────────────────────────────────

/**
 * Graphique en barres des clics par lien.
 * Trié par nombre de clics décroissant.
 * Hauteur adaptative selon le nombre de liens (40px par barre + marges).
 *
 * @param links - Tableau de BioLink avec compteur clicks
 * @returns Graphique recharts BarChart ou message si aucun clic
 */
export function ClicksChart({ links }: ClicksChartProps): React.JSX.Element {
  // Trier par clics décroissants et formater pour recharts
  const data = [...links]
    .sort((a, b) => b.clicks - a.clicks)
    .map((link) => ({
      name: link.title.length > 18 ? `${link.title.slice(0, 18)}…` : link.title,
      clics: link.clicks,
      fullTitle: link.title,
    }))

  // Si aucun lien n'a de clics, afficher un message
  const totalClicks = data.reduce((sum, d) => sum + d.clics, 0)
  if (totalClicks === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center">
        <p className="text-sm text-muted-foreground">
          Aucun clic enregistré pour le moment. Partagez votre page Bio Link !
        </p>
      </div>
    )
  }

  // Hauteur dynamique : 40px par barre + 60px de marges
  const chartHeight = Math.max(200, data.length * 40 + 60)

  return (
    <div className="rounded-lg border bg-card p-4">
      <h3 className="text-sm font-semibold text-foreground mb-4">
        Clics par lien
      </h3>
      <ResponsiveContainer width="100%" height={chartHeight}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 0, right: 20, bottom: 0, left: 10 }}
        >
          <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.3} />
          <XAxis type="number" fontSize={12} />
          <YAxis
            type="category"
            dataKey="name"
            width={100}
            fontSize={12}
            tick={{ fill: 'hsl(var(--muted-foreground))' }}
          />
          <Tooltip
            formatter={(value: unknown) => [`${value} clics`, 'Clics']}
            contentStyle={{
              backgroundColor: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '0.5rem',
              fontSize: '0.75rem',
            }}
          />
          <Bar
            dataKey="clics"
            fill="hsl(var(--primary))"
            radius={[0, 4, 4, 0]}
            maxBarSize={28}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
