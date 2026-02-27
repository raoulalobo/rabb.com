/**
 * @file modules/analytics/components/TopPerformingPosts.tsx
 * @module analytics
 * @description Classement des posts les plus performants (Top 5).
 *   Tri par ER% ou par engagement total selon le filtre sélectionné.
 *   Données : AnalyticsListResponse.posts via GET /v1/analytics.
 *
 * @example
 *   <TopPerformingPosts posts={analyticsPosts?.posts} />
 */

'use client'

import { useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { AnalyticsPost } from '@/modules/analytics/types'

// ─── Props ────────────────────────────────────────────────────────────────────

interface TopPerformingPostsProps {
  posts: AnalyticsPost[] | undefined
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const PLATFORM_ICONS: Record<string, string> = {
  tiktok: '🎵',
  instagram: '📸',
  youtube: '▶️',
  facebook: '📘',
  twitter: '🐦',
  linkedin: '💼',
}

const RANK_COLORS = ['#f59e0b', '#94a3b8', '#b45309', '#64748b', '#64748b']

type SortMode = 'engagement' | 'views' | 'likes'

// ─── Composant ────────────────────────────────────────────────────────────────

/**
 * Liste des 5 posts les plus performants.
 * Tri configurable : engagement, vues, likes.
 */
export function TopPerformingPosts({ posts }: TopPerformingPostsProps): React.JSX.Element {
  const [sortMode, setSortMode] = useState<SortMode>('engagement')

  // Tri et limitation à 5 — garde défensive sur metrics (peut être absent)
  const sorted = (Array.isArray(posts) ? posts : [])
    .filter((p) => p?.metrics !== undefined)
    .slice()
    .sort((a, b) => {
      if (sortMode === 'engagement') return (b.metrics.engagementRate ?? 0) - (a.metrics.engagementRate ?? 0)
      if (sortMode === 'views') return (b.metrics.views ?? 0) - (a.metrics.views ?? 0)
      return (b.metrics.likes ?? 0) - (a.metrics.likes ?? 0)
    })
    .slice(0, 5)

  const sortLabels: Record<SortMode, string> = {
    engagement: 'Engagement',
    views: 'Vues',
    likes: 'Likes',
  }

  if (!posts || posts.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
        Aucun post publié sur la période
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* En-tête avec filtre de tri */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">Top posts</span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-7 gap-1 text-xs">
              🏆 {sortLabels[sortMode]}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {(Object.keys(sortLabels) as SortMode[]).map((mode) => (
              <DropdownMenuItem
                key={mode}
                onClick={() => setSortMode(mode)}
                className={sortMode === mode ? 'bg-accent' : ''}
              >
                {sortLabels[mode]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Liste des posts */}
      <div className="space-y-2">
        {sorted.map((post, index) => (
          <div key={post.id} className="flex items-start gap-3">
            {/* Rang */}
            <span
              className="mt-0.5 min-w-[1.25rem] text-center text-sm font-bold"
              style={{ color: RANK_COLORS[index] ?? '#64748b' }}
            >
              {index + 1}
            </span>

            {/* Icône plateforme */}
            <span className="mt-0.5 text-sm">
              {PLATFORM_ICONS[post.platform?.toLowerCase()] ?? '📱'}
            </span>

            {/* Contenu */}
            <div className="min-w-0 flex-1">
              {/* Texte du post tronqué */}
              <p className="truncate text-sm font-medium">{post.text}</p>
              <p className="text-xs text-muted-foreground">
                {new Date(post.publishedAt).toLocaleDateString('fr', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </p>
            </div>

            {/* Métriques clés */}
            <div className="flex shrink-0 items-center gap-2 text-xs">
              {post.metrics.engagementRate > 0 && (
                <span className="rounded bg-green-500/10 px-1.5 py-0.5 font-medium text-green-500">
                  ER {post.metrics.engagementRate.toFixed(2)}%
                </span>
              )}
              <span className="flex items-center gap-0.5 text-muted-foreground">
                🏆 {(post.metrics.likes + post.metrics.comments + post.metrics.shares).toLocaleString()}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
