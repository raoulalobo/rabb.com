/**
 * @file modules/analytics/components/PostDetailsGrid.tsx
 * @module analytics
 * @description Grille des cartes de détail post avec métriques individuelles.
 *   3 colonnes sur desktop, 2 sur tablette, 1 sur mobile.
 *   Chaque carte : miniature, texte tronqué, date, plateforme, métriques clés, ER%.
 *   Données : AnalyticsListResponse.posts via GET /v1/analytics.
 *
 * @example
 *   <PostDetailsGrid posts={analyticsPosts?.posts} sortBy={sortBy} />
 */

'use client'

import type { AnalyticsPost } from '@/modules/analytics/types'
import type { AnalyticsFiltersState } from '@/modules/analytics/types'

// ─── Props ────────────────────────────────────────────────────────────────────

interface PostDetailsGridProps {
  posts: AnalyticsPost[] | undefined
  sortBy: AnalyticsFiltersState['sortBy']
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

// ─── Composant carte individuelle ─────────────────────────────────────────────

interface PostCardProps {
  post: AnalyticsPost
}

/**
 * Carte d'un post avec ses métriques.
 */
function PostCard({ post }: PostCardProps): React.JSX.Element {
  const { metrics } = post
  const hasMedia = Boolean(post.mediaUrl)

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3 transition-shadow hover:shadow-md">
      {/* En-tête : miniature + texte */}
      <div className="flex gap-3">
        {/* Miniature ou placeholder */}
        <div className="size-16 shrink-0 overflow-hidden rounded-lg bg-muted">
          {hasMedia ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={post.mediaUrl}
              alt="Miniature du post"
              className="size-full object-cover"
            />
          ) : (
            <div className="flex size-full items-center justify-center text-xs text-muted-foreground">
              vidéo
            </div>
          )}
        </div>

        {/* Texte + date */}
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-sm font-medium leading-snug">{post.text}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            📅{' '}
            {new Date(post.publishedAt).toLocaleDateString('fr', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })}
          </p>
        </div>
      </div>

      {/* Ligne plateforme + ID court */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>{PLATFORM_ICONS[post.platform?.toLowerCase()] ?? '📱'}</span>
        <span>·</span>
        <span className="truncate">id: {post.id.slice(0, 8)}…</span>
      </div>

      {/* Métriques */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {metrics.likes > 0 && (
          <span className="flex items-center gap-1 text-red-500">
            ❤️ <span className="font-medium">{metrics.likes.toLocaleString()}</span>
          </span>
        )}
        {metrics.comments > 0 && (
          <span className="flex items-center gap-1 text-blue-500">
            💬 <span className="font-medium">{metrics.comments.toLocaleString()}</span>
          </span>
        )}
        {metrics.shares > 0 && (
          <span className="flex items-center gap-1 text-green-500">
            ↪ <span className="font-medium">{metrics.shares.toLocaleString()}</span>
          </span>
        )}
        {metrics.views > 0 && (
          <span className="flex items-center gap-1 text-purple-500">
            👁 <span className="font-medium">{metrics.views.toLocaleString()}</span>
          </span>
        )}

        {/* ER badge */}
        {metrics.engagementRate > 0 && (
          <span className="rounded-full bg-green-500/10 px-2 py-0.5 font-semibold text-green-500">
            ER {metrics.engagementRate.toFixed(2)}%
          </span>
        )}
      </div>
    </div>
  )
}

// ─── Composant grille ─────────────────────────────────────────────────────────

/**
 * Grille de cartes post analytics.
 * Applique le tri défini par le store avant le rendu.
 */
export function PostDetailsGrid({ posts, sortBy }: PostDetailsGridProps): React.JSX.Element {
  // Tri selon le critère choisi — garde défensive sur metrics (peut être absent)
  const sorted = (Array.isArray(posts) ? posts : [])
    .filter((p) => p?.metrics !== undefined)
    .slice()
    .sort((a, b) => {
      if (sortBy === 'engagement') return (b.metrics.engagementRate ?? 0) - (a.metrics.engagementRate ?? 0)
      if (sortBy === 'views') return (b.metrics.views ?? 0) - (a.metrics.views ?? 0)
      return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    })

  if (sorted.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
        Aucun post publié sur cette période
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {sorted.map((post) => (
        <PostCard key={post.id} post={post} />
      ))}
    </div>
  )
}
