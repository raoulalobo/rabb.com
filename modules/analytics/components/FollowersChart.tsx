/**
 * @file modules/analytics/components/FollowersChart.tsx
 * @module analytics
 * @description Graphique en aire des followers par plateforme dans le temps.
 *   Affiche une ligne colorée par plateforme (TikTok=cyan, Instagram=rose, etc.).
 *   Données : FollowerStatsResponse via GET /v1/accounts/follower-stats.
 *
 * @example
 *   <FollowersChart data={followerStats} />
 */

'use client'

import { useMemo } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import type { FollowerStatsResponse } from '@/modules/analytics/types'

// ─── Couleurs par plateforme ───────────────────────────────────────────────────

const PLATFORM_COLORS: Record<string, string> = {
  tiktok: '#00d4b4',
  instagram: '#e1306c',
  youtube: '#ff0000',
  facebook: '#1877f2',
  twitter: '#1da1f2',
  linkedin: '#0077b5',
}

function getPlatformColor(platform: string): string {
  return PLATFORM_COLORS[platform.toLowerCase()] ?? '#8b5cf6'
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface FollowersChartProps {
  data: FollowerStatsResponse | undefined
}

// ─── Composant ────────────────────────────────────────────────────────────────

/**
 * Graphique de suivi des followers dans le temps, une ligne par plateforme.
 * Utilise recharts AreaChart avec animation et tooltip personnalisé.
 */
export function FollowersChart({ data }: FollowersChartProps): React.JSX.Element {
  // Restructuration des données : { date, tiktok: N, instagram: N, ... }
  const { chartData, platforms } = useMemo(() => {
    // Vérification défensive : l'API peut retourner un objet ou undefined au lieu d'un tableau
    const stats = Array.isArray(data?.stats) ? data.stats : []
    if (stats.length === 0) {
      return { chartData: [], platforms: [] }
    }

    // Extraction des plateformes uniques
    const platformSet = [...new Set(stats.map((s) => s.platform))]

    // Regroupement par date
    const byDate = new Map<string, Record<string, number>>()
    for (const stat of stats) {
      const key = stat.date.slice(0, 10)
      const existing = byDate.get(key) ?? {}
      byDate.set(key, { ...existing, [stat.platform]: stat.count })
    }

    // Tri par date croissante
    const sorted = [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b))
    const chartData = sorted.map(([date, counts]) => ({ date, ...counts }))

    return { chartData, platforms: platformSet }
  }, [data])

  const total = data?.total ?? 0

  if (chartData.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
        Aucune donnée de followers disponible
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* En-tête : total followers */}
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-bold">{total.toLocaleString()}</span>
        <span className="text-sm text-muted-foreground">followers au total</span>
      </div>

      {/* Graphique */}
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
          <defs>
            {platforms.map((platform) => (
              <linearGradient key={platform} id={`grad-${platform}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={getPlatformColor(platform)} stopOpacity={0.3} />
                <stop offset="95%" stopColor={getPlatformColor(platform)} stopOpacity={0.02} />
              </linearGradient>
            ))}
          </defs>

          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />

          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
            tickFormatter={(value: string) => {
              const d = new Date(value)
              return `${d.getDate()} ${d.toLocaleString('fr', { month: 'short' })}`
            }}
            interval="preserveStartEnd"
            axisLine={false}
            tickLine={false}
          />

          <YAxis
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
            axisLine={false}
            tickLine={false}
          />

          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '8px',
              fontSize: 12,
            }}
            labelFormatter={(label) => {
              const d = new Date(String(label))
              return d.toLocaleDateString('fr', { day: 'numeric', month: 'long', year: 'numeric' })
            }}
          />

          {platforms.map((platform) => (
            <Area
              key={platform}
              type="monotone"
              dataKey={platform}
              name={platform.charAt(0).toUpperCase() + platform.slice(1)}
              stroke={getPlatformColor(platform)}
              strokeWidth={2}
              fill={`url(#grad-${platform})`}
              dot={{ r: 3, fill: getPlatformColor(platform) }}
              activeDot={{ r: 5 }}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
