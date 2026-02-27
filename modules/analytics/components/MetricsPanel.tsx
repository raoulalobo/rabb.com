/**
 * @file modules/analytics/components/MetricsPanel.tsx
 * @module analytics
 * @description Panneau de métriques avec checkboxes toggle et bar chart quotidien.
 *   - Ligne supérieure : 8 métriques toggleables avec leurs totaux
 *   - Bar chart : barres quotidiennes colorées par plateforme
 *   Les métriques activées déterminent quelle donnée est représentée dans le bar chart.
 *
 * @example
 *   <MetricsPanel analyticsPosts={analyticsPosts} dailyMetrics={dailyMetrics} />
 */

'use client'

import { useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import type { AnalyticsListResponse, DailyMetricsResponse, MetricKey } from '@/modules/analytics/types'

// ─── Configuration des métriques ─────────────────────────────────────────────

interface MetricDef {
  key: MetricKey
  label: string
  shortLabel: string
  color: string
  icon: string
}

const METRICS: MetricDef[] = [
  { key: 'likes', label: 'Likes', shortLabel: 'Likes', color: '#ef4444', icon: '❤️' },
  { key: 'comments', label: 'Commentaires', shortLabel: 'Comm.', color: '#3b82f6', icon: '💬' },
  { key: 'shares', label: 'Partages', shortLabel: 'Partages', color: '#22c55e', icon: '↪' },
  { key: 'views', label: 'Vues', shortLabel: 'Vues', color: '#a855f7', icon: '👁' },
  { key: 'impressions', label: 'Impressions', shortLabel: 'Impress.', color: '#06b6d4', icon: '📈' },
  { key: 'reach', label: 'Portée', shortLabel: 'Portée', color: '#f97316', icon: '👥' },
  { key: 'clicks', label: 'Clics', shortLabel: 'Clics', color: '#64748b', icon: '🖱' },
  { key: 'engagementRate', label: 'Taux ER', shortLabel: 'Eng. Rate', color: '#10b981', icon: '📊' },
]

// ─── Props ────────────────────────────────────────────────────────────────────

interface MetricsPanelProps {
  analyticsPosts: AnalyticsListResponse | undefined
  dailyMetrics: DailyMetricsResponse | undefined
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Formate une valeur métrique pour l'affichage condensé */
function formatMetric(value: number, key: MetricKey): string {
  if (key === 'engagementRate') return `${value.toFixed(2)}%`
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`
  return value.toLocaleString()
}

// ─── Composant ────────────────────────────────────────────────────────────────

/**
 * Panneau métriques avec toggles et bar chart.
 * Par défaut : likes et vues activés.
 */
export function MetricsPanel({ analyticsPosts, dailyMetrics }: MetricsPanelProps): React.JSX.Element {
  // Métriques actives (checkboxes)
  const [activeMetrics, setActiveMetrics] = useState<Set<MetricKey>>(
    new Set(['likes', 'views'])
  )

  const overview = analyticsPosts?.overview

  // Toggle d'une métrique
  const toggleMetric = (key: MetricKey) => {
    setActiveMetrics((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        // Garder au moins une métrique active
        if (next.size > 1) next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  // Données du bar chart — garde défensive : days peut être un objet ou undefined
  const safeDays = Array.isArray(dailyMetrics?.days) ? dailyMetrics.days : []
  const chartData = safeDays
    .filter((d) => d.postCount > 0)
    .map((day) => {
      const value = [...activeMetrics].reduce((sum, key) => {
        if (key === 'engagementRate') return sum // ER non agrégeable simplement
        return sum + (day[key as keyof typeof day] as number ?? 0)
      }, 0)
      return {
        date: day.date.slice(0, 10),
        value,
        postCount: day.postCount,
      }
    })

  // Couleur des barres = couleur de la première métrique active (dans l'ordre de METRICS)
  const activeBarColor =
    METRICS.find((m) => activeMetrics.has(m.key))?.color ?? '#8b5cf6'

  return (
    <div className="space-y-4">
      {/* ── Ligne des métriques toggleables ──────────────────────────────── */}
      <div className="grid grid-cols-4 gap-3 sm:grid-cols-8">
        {METRICS.map((metric) => {
          const isActive = activeMetrics.has(metric.key)
          const rawValue = overview?.[metric.key] ?? 0
          const displayValue = typeof rawValue === 'number' ? rawValue : 0

          return (
            <button
              key={metric.key}
              onClick={() => toggleMetric(metric.key)}
              className={`flex flex-col gap-1 rounded-lg border p-2 text-left transition-all hover:border-foreground/30 ${
                isActive
                  ? 'border-foreground/20 bg-accent/50'
                  : 'border-transparent bg-muted/20 opacity-50'
              }`}
            >
              {/* Checkbox + label */}
              <div className="flex items-center gap-1">
                <div
                  className={`size-3 rounded-[2px] border ${
                    isActive
                      ? 'border-transparent'
                      : 'border-muted-foreground/40'
                  }`}
                  style={isActive ? { backgroundColor: metric.color } : {}}
                />
                <span className="truncate text-[11px] text-muted-foreground">
                  {metric.shortLabel}
                </span>
              </div>
              {/* Valeur */}
              <div className="flex items-center gap-1">
                <span className="text-[11px]">{metric.icon}</span>
                <span className="text-sm font-semibold">
                  {formatMetric(displayValue, metric.key)}
                </span>
              </div>
              {/* Variation (placeholder — Late ne retourne pas encore de delta) */}
              <span className="text-[10px] text-muted-foreground">—</span>
            </button>
          )
        })}
      </div>

      {/* ── Bar chart quotidien ───────────────────────────────────────────── */}
      {chartData.length > 0 ? (
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
              tickFormatter={(v: string) => {
                const d = new Date(v)
                return `${d.getDate()} ${d.toLocaleString('fr', { month: 'short' })}`
              }}
              interval="preserveStartEnd"
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
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
              formatter={(value) => [(value ?? 0).toLocaleString(), 'Engagement']}
              labelFormatter={(label) =>
                new Date(String(label)).toLocaleDateString('fr', { day: 'numeric', month: 'long' })
              }
            />
            <Bar dataKey="value" radius={[3, 3, 0, 0]} maxBarSize={32}>
              {chartData.map((_, index) => (
                <Cell key={index} fill={activeBarColor} opacity={0.8} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
          Aucune donnée pour la période sélectionnée
        </div>
      )}
    </div>
  )
}
