/**
 * @file modules/analytics/components/PlatformBreakdown.tsx
 * @module analytics
 * @description Tableau de synthèse des performances par plateforme.
 *   Une ligne par plateforme avec : postCount, likes, comments, shares, views, ER%.
 *   Données : AnalyticsListResponse.platforms via GET /v1/analytics.
 *
 * @example
 *   <PlatformBreakdown platforms={analyticsPosts?.platforms} />
 */

'use client'

import type { LatePlatform } from '@/lib/late'
import type { PlatformStats } from '@/modules/analytics/types'
import { PlatformIcon } from '@/modules/platforms/components/PlatformIcon'

// ─── Labels plateformes ──────────────────────────────────────────────────────

function getPlatformLabel(platform: string): string {
  const labels: Record<string, string> = {
    tiktok: 'TikTok',
    instagram: 'Instagram',
    youtube: 'YouTube',
    facebook: 'Facebook',
    twitter: 'Twitter/X',
    linkedin: 'LinkedIn',
  }
  return labels[platform.toLowerCase()] ?? platform.charAt(0).toUpperCase() + platform.slice(1)
}

/** Formate un nombre en K/M */
function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toString()
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface PlatformBreakdownProps {
  platforms: PlatformStats[] | undefined
}

// ─── Composant ────────────────────────────────────────────────────────────────

/**
 * Tableau des stats par plateforme.
 * Chaque ligne = une plateforme avec ses métriques clés.
 */
export function PlatformBreakdown({ platforms }: PlatformBreakdownProps): React.JSX.Element {
  if (!platforms || platforms.length === 0) {
    return (
      <div className="flex h-24 items-center justify-center text-sm text-muted-foreground">
        Aucune donnée de plateforme disponible
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {platforms.map((p) => (
        <div
          key={p.platform}
          className="flex items-center justify-between rounded-lg border border-border bg-muted/20 px-4 py-3"
        >
          {/* Plateforme + postCount */}
          <div className="flex items-center gap-3">
            <PlatformIcon platform={p.platform as LatePlatform} className="size-5" />
            <div>
              <div className="font-medium">{getPlatformLabel(p.platform)}</div>
              <div className="text-xs text-muted-foreground">
                {p.postCount} post{p.postCount !== 1 ? 's' : ''}
              </div>
            </div>
          </div>

          {/* Métriques */}
          <div className="flex items-center gap-4 text-sm">
            {p.likes > 0 && (
              <span className="flex items-center gap-1 text-red-500">
                ❤️ <span className="font-medium">{fmt(p.likes)}</span>
              </span>
            )}
            {p.comments > 0 && (
              <span className="flex items-center gap-1 text-blue-500">
                💬 <span className="font-medium">{fmt(p.comments)}</span>
              </span>
            )}
            {p.shares > 0 && (
              <span className="flex items-center gap-1 text-green-500">
                ↪ <span className="font-medium">{fmt(p.shares)}</span>
              </span>
            )}
            {p.views > 0 && (
              <span className="flex items-center gap-1 text-purple-500">
                👁 <span className="font-medium">{fmt(p.views)}</span>
              </span>
            )}
            {/* Taux d'engagement */}
            {p.engagementRate > 0 && (
              <span className="ml-2 rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-500">
                ER {p.engagementRate.toFixed(2)}%
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
