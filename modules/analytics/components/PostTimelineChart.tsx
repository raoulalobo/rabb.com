/**
 * @file modules/analytics/components/PostTimelineChart.tsx
 * @module analytics
 * @description Graphique linéaire montrant l'évolution jour par jour des métriques d'un post.
 *   Affiche les courbes d'impressions, likes, commentaires et partages dans le temps.
 *   Données : PostTimelineResponse via GET /v1/analytics/post-timeline.
 *
 *   Utilisé dans le dialog de détail d'un post (clic sur un post dans le calendrier
 *   ou dans TopPerformingPosts/PostDetailsGrid).
 *
 * @example
 *   <PostTimelineChart postId="69b43106..." />
 */

'use client'

import { useQuery } from '@tanstack/react-query'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { Skeleton } from '@/components/ui/skeleton'
import { analyticsKeys, fetchPostTimeline } from '@/modules/analytics/queries/analytics.queries'

// ─── Couleurs des métriques ──────────────────────────────────────────────────

const METRIC_COLORS = {
  impressions: '#6366f1', // indigo
  likes: '#ec4899',       // pink
  comments: '#f59e0b',    // amber
  shares: '#10b981',      // emerald
} as const

// ─── Types ───────────────────────────────────────────────────────────────────

interface PostTimelineChartProps {
  /** ID du post Zernio dont on veut voir l'évolution */
  postId: string
  /** Date de publication du post — début de la timeline */
  publishedAt?: Date | null
}

// ─── Composant ───────────────────────────────────────────────────────────────

/**
 * Graphique linéaire de l'évolution des métriques d'un post dans le temps.
 * Charge les données via TanStack Query et affiche un AreaChart recharts.
 *
 * @param postId - ID du post Zernio
 */
export function PostTimelineChart({ postId, publishedAt }: PostTimelineChartProps): React.JSX.Element {
  // Début de la timeline = date de publication (format YYYY-MM-DD)
  const fromDate = publishedAt
    ? publishedAt.toISOString().slice(0, 10)
    : undefined

  const { data, isLoading, error } = useQuery({
    queryKey: analyticsKeys.postTimeline(postId),
    queryFn: () => fetchPostTimeline(postId, fromDate),
    staleTime: 5 * 60 * 1000,
    enabled: !!postId,
  })

  // ── Loading ──────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-48 w-full rounded-lg" />
      </div>
    )
  }

  // ── Erreur ───────────────────────────────────────────────────────────────
  if (error || !data?.timeline?.length) {
    return (
      <div className="flex h-48 items-center justify-center rounded-lg border border-dashed">
        <p className="text-sm text-muted-foreground">
          {error ? 'Impossible de charger la timeline' : 'Pas encore de données de performance'}
        </p>
      </div>
    )
  }

  // ── Formater les données pour recharts ──────────────────────────────────
  const chartData = data.timeline.map((point) => ({
    // Formater la date en "15 mar" pour l'axe X
    date: new Date(point.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }),
    impressions: point.impressions,
    likes: point.likes,
    comments: point.comments,
    shares: point.shares,
  }))

  return (
    <div className="space-y-3">
      {/* Titre */}
      <h4 className="text-sm font-medium text-foreground">
        Évolution des performances
      </h4>

      {/* Légende */}
      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        {Object.entries(METRIC_COLORS).map(([key, color]) => (
          <div key={key} className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full" style={{ backgroundColor: color }} />
            <span className="capitalize">{key === 'impressions' ? 'Impressions' : key === 'likes' ? 'Likes' : key === 'comments' ? 'Commentaires' : 'Partages'}</span>
          </div>
        ))}
      </div>

      {/* Graphique */}
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: -10 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted/30" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11 }}
            className="text-muted-foreground"
          />
          <YAxis
            tick={{ fontSize: 11 }}
            className="text-muted-foreground"
            tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v)}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(var(--background))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '8px',
              fontSize: '12px',
            }}
          />
          {/* Impressions — zone principale */}
          <Area
            type="monotone"
            dataKey="impressions"
            stroke={METRIC_COLORS.impressions}
            fill={METRIC_COLORS.impressions}
            fillOpacity={0.1}
            strokeWidth={2}
          />
          {/* Likes */}
          <Area
            type="monotone"
            dataKey="likes"
            stroke={METRIC_COLORS.likes}
            fill={METRIC_COLORS.likes}
            fillOpacity={0.1}
            strokeWidth={2}
          />
          {/* Commentaires */}
          <Area
            type="monotone"
            dataKey="comments"
            stroke={METRIC_COLORS.comments}
            fill={METRIC_COLORS.comments}
            fillOpacity={0.05}
            strokeWidth={1.5}
          />
          {/* Partages */}
          <Area
            type="monotone"
            dataKey="shares"
            stroke={METRIC_COLORS.shares}
            fill={METRIC_COLORS.shares}
            fillOpacity={0.05}
            strokeWidth={1.5}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
