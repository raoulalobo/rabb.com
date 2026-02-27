/**
 * @file modules/analytics/components/PostingFrequency.tsx
 * @module analytics
 * @description Affiche la corrélation entre fréquence de publication et engagement.
 *   Badge par plateforme avec la fréquence optimale et l'ER associé.
 *   Données : PostingFrequencyResponse via GET /v1/analytics/posting-frequency.
 *
 * @example
 *   <PostingFrequency data={postingFrequency} />
 */

'use client'

import type { PostingFrequencyResponse } from '@/modules/analytics/types'

// ─── Props ────────────────────────────────────────────────────────────────────

interface PostingFrequencyProps {
  data: PostingFrequencyResponse | undefined
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

// ─── Composant ────────────────────────────────────────────────────────────────

/**
 * Section "Fréquence de publication vs Engagement".
 * Affiche les fréquences optimales par plateforme avec leurs ER%.
 */
export function PostingFrequency({ data }: PostingFrequencyProps): React.JSX.Element {
  // Garde défensive : optimal/data peuvent être absents ou non-tableaux
  const optimal = Array.isArray(data?.optimal) ? data.optimal : []

  if (optimal.length === 0) {
    return (
      <div className="flex h-16 items-center justify-center text-sm text-muted-foreground">
        Pas assez de données pour calculer la fréquence optimale
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Une ligne par plateforme */}
      {optimal.map((item) => (
        <div
          key={item.platform}
          className="flex items-center justify-between rounded-lg border border-border bg-muted/20 px-4 py-3"
        >
          {/* Plateforme */}
          <div className="flex items-center gap-2">
            <span className="text-lg">
              {PLATFORM_ICONS[item.platform.toLowerCase()] ?? '📱'}
            </span>
            <span className="font-medium">{getPlatformLabel(item.platform)}</span>
          </div>

          {/* Badge fréquence optimale */}
          <div className="flex items-center gap-3">
            <span className="rounded-full border border-green-500/30 bg-green-500/10 px-3 py-1 text-sm font-medium text-green-500">
              {item.postsPerWeek}/sem : ER {item.avgEngagementRate.toFixed(1)}%
            </span>
          </div>
        </div>
      ))}

      {/* Message récapitulatif */}
      {optimal.map((item) => (
        <p key={`tip-${item.platform}`} className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>💡</span>
          <span>
            Fréquence optimale : {item.postsPerWeek} posts/semaine sur{' '}
            {getPlatformLabel(item.platform)} ({item.avgEngagementRate.toFixed(1)}% ER)
          </span>
        </p>
      ))}
    </div>
  )
}
