/**
 * @file modules/analytics/components/ContentTypeBreakdown.tsx
 * @module analytics
 * @description Breakdown des performances par type de contenu (Feed, Story, Reel, Thread, Carrousel).
 *   Affiche une barre horizontale par type avec le nombre de posts et la proportion.
 *   Données : requête Prisma groupBy via GET /api/analytics/content-type.
 *
 *   Visible uniquement si au moins 2 types de contenu différents existent.
 *
 * @example
 *   <ContentTypeBreakdown from="2026-02-21" platform="instagram" />
 */

'use client'

import { useQuery } from '@tanstack/react-query'
import { CircleDot, Film, Images, MessagesSquare, Newspaper } from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────────────

interface ContentTypeStats {
  type: string
  label: string
  postCount: number
}

interface ContentTypeResponse {
  breakdown: ContentTypeStats[]
}

// ─── Configuration visuelle par type ─────────────────────────────────────────

const TYPE_CONFIG: Record<string, {
  icon: React.ComponentType<{ className?: string }>
  color: string
  bgColor: string
}> = {
  feed: { icon: Newspaper, color: 'text-blue-500', bgColor: 'bg-blue-500' },
  story: { icon: CircleDot, color: 'text-amber-500', bgColor: 'bg-amber-500' },
  reel: { icon: Film, color: 'text-pink-500', bgColor: 'bg-pink-500' },
  thread: { icon: MessagesSquare, color: 'text-cyan-500', bgColor: 'bg-cyan-500' },
  carousel: { icon: Images, color: 'text-purple-500', bgColor: 'bg-purple-500' },
}

const DEFAULT_CONFIG = { icon: Newspaper, color: 'text-muted-foreground', bgColor: 'bg-muted-foreground' }

// ─── Props ───────────────────────────────────────────────────────────────────

interface ContentTypeBreakdownProps {
  /** Date de début ISO pour le filtre temporel */
  from?: string
  /** Plateforme filtrée (optionnel) */
  platform?: string
}

// ─── Composant ────────────────────────────────────────────────────────────────

/**
 * Breakdown par type de contenu sous forme de barres horizontales.
 * Chaque barre montre : icône + label + nombre de posts + barre proportionnelle.
 *
 * @param from - Date de début pour le filtre
 * @param platform - Plateforme filtrée
 * @returns Barres de breakdown ou null si < 2 types
 */
export function ContentTypeBreakdown({ from, platform }: ContentTypeBreakdownProps): React.JSX.Element | null {
  const { data } = useQuery<ContentTypeResponse>({
    queryKey: ['analytics', 'content-type', { from, platform }],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (from) params.set('from', from)
      if (platform) params.set('platform', platform)
      const query = params.toString()
      const res = await fetch(`/api/analytics/content-type${query ? `?${query}` : ''}`, {
        signal: AbortSignal.timeout(10_000),
      })
      if (!res.ok) throw new Error('Erreur content-type breakdown')
      return res.json() as Promise<ContentTypeResponse>
    },
    staleTime: 60 * 60 * 1000, // 1h
    retry: 0,
  })

  const breakdown = data?.breakdown
  if (!breakdown || breakdown.length === 0) return null

  // Calculer le total pour les proportions
  const total = breakdown.reduce((sum, item) => sum + item.postCount, 0)
  if (total === 0) return null

  // Trouver le max pour la largeur des barres (barre la plus grande = 100%)
  const maxCount = Math.max(...breakdown.map((item) => item.postCount))

  return (
    <div className="space-y-3">
      {breakdown.map((item) => {
        const config = TYPE_CONFIG[item.type] ?? DEFAULT_CONFIG
        const Icon = config.icon
        const percentage = ((item.postCount / total) * 100).toFixed(0)
        const barWidth = (item.postCount / maxCount) * 100

        return (
          <div key={item.type} className="space-y-1">
            {/* Label + stats */}
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <Icon className={`size-4 ${config.color}`} />
                <span className="font-medium">{item.label}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>{item.postCount} post{item.postCount > 1 ? 's' : ''}</span>
                <span className="tabular-nums font-medium text-foreground">{percentage}%</span>
              </div>
            </div>

            {/* Barre proportionnelle */}
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={`h-full rounded-full transition-all duration-500 ${config.bgColor}`}
                style={{ width: `${barWidth}%`, opacity: 0.7 }}
              />
            </div>
          </div>
        )
      })}

      {/* Total */}
      <p className="text-right text-[11px] text-muted-foreground">
        {total} post{total > 1 ? 's' : ''} au total
      </p>
    </div>
  )
}
