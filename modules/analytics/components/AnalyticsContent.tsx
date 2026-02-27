/**
 * @file modules/analytics/components/AnalyticsContent.tsx
 * @module analytics
 * @description Composant client principal de la page analytics.
 *   Orchestre toutes les sections : heatmap, followers, métriques, plateformes,
 *   best time, top posts, fréquence, decay, grille de posts.
 *
 *   Données chargées via useAnalytics (6 queries TanStack parallèles).
 *   Filtres lus depuis useAnalyticsStore (Zustand).
 *
 * @example
 *   // Dans app/(dashboard)/analytics/page.tsx
 *   <AnalyticsContent />
 */

'use client'

import { Skeleton } from '@/components/ui/skeleton'
import { useAnalytics } from '@/modules/analytics/hooks/useAnalytics'
import { useAnalyticsStore } from '@/modules/analytics/store/analytics.store'

import { ActivityHeatmap } from './ActivityHeatmap'
import { BestTimeHeatmap } from './BestTimeHeatmap'
import { ContentDecay } from './ContentDecay'
import { FollowersChart } from './FollowersChart'
import { MetricsPanel } from './MetricsPanel'
import { PlatformBreakdown } from './PlatformBreakdown'
import { PostDetailsGrid } from './PostDetailsGrid'
import { PostingFrequency } from './PostingFrequency'
import { TopPerformingPosts } from './TopPerformingPosts'

// ─── Composant section générique ──────────────────────────────────────────────

interface SectionProps {
  title: string
  children: React.ReactNode
  className?: string
}

/**
 * Wrapper de section avec titre et bordure.
 */
function Section({ title, children, className = '' }: SectionProps): React.JSX.Element {
  return (
    <div className={`rounded-xl border border-border bg-card p-5 ${className}`}>
      <h2 className="mb-4 text-sm font-semibold">{title}</h2>
      {children}
    </div>
  )
}

// ─── Composant principal ──────────────────────────────────────────────────────

/**
 * Contenu principal de la page analytics.
 * Client Component — charge les données et rend toutes les sections.
 */
export function AnalyticsContent(): React.JSX.Element {
  const {
    analyticsPosts,
    dailyMetrics,
    followerStats,
    bestTime,
    contentDecay,
    postingFrequency,
    isLoading,
    isFetching,
  } = useAnalytics()

  const { sortBy } = useAnalyticsStore()

  // ── Skeleton global si toutes les données sont en chargement ─────────────
  // N'apparaît qu'au premier chargement (isPending sans placeholder).
  // Lors d'un changement de filtre, keepPreviousData maintient les données
  // donc isPending reste false → pas de skeleton flash.
  if (isLoading) {
    return (
      <div className="space-y-4">
        {/* Heatmap skeleton */}
        <div className="rounded-xl border border-border bg-card p-5">
          <Skeleton className="h-4 w-32 mb-4" />
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: 112 }).map((_, i) => (
              <Skeleton key={i} className="aspect-square rounded-[2px]" />
            ))}
          </div>
        </div>

        {/* Followers chart skeleton */}
        <div className="rounded-xl border border-border bg-card p-5">
          <Skeleton className="mb-2 h-8 w-24" />
          <Skeleton className="h-[220px] w-full rounded-lg" />
        </div>

        {/* Metrics panel skeleton */}
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="mb-4 grid grid-cols-8 gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-16 rounded-lg" />
            ))}
          </div>
          <Skeleton className="h-[180px] w-full rounded-lg" />
        </div>

        {/* Deux colonnes skeleton */}
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-[300px] rounded-xl" />
          <Skeleton className="h-[300px] rounded-xl" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* ── Indicateur discret de rechargement (changement de filtre) ───────
          Visible uniquement lors d'un re-fetch avec données précédentes visibles.
          Absent au chargement initial (isLoading masque tout via le skeleton).       */}
      {isFetching && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <div className="size-3 animate-spin rounded-full border border-muted-foreground border-t-transparent" />
          Actualisation…
        </div>
      )}

      {/* ── 1. Heatmap d'activité ───────────────────────────────────────── */}
      <Section title="Activité de publication">
        <ActivityHeatmap days={Array.isArray(dailyMetrics?.days) ? dailyMetrics.days : []} />
      </Section>

      {/* ── 2. Graphique followers ──────────────────────────────────────── */}
      <Section title="Évolution des followers">
        <FollowersChart data={followerStats} />
      </Section>

      {/* ── 3. Métriques panel (toggles + bar chart) ────────────────────── */}
      <Section title="Métriques d'engagement">
        <MetricsPanel
          analyticsPosts={analyticsPosts}
          dailyMetrics={dailyMetrics}
        />
      </Section>

      {/* ── 4. Répartition par plateforme ───────────────────────────────── */}
      <Section title="Répartition par plateforme">
        <PlatformBreakdown platforms={analyticsPosts?.platforms} />
      </Section>

      {/* ── 5. Best Time + Top Posts (2 colonnes) ───────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Meilleur moment pour publier">
          <BestTimeHeatmap data={bestTime} />
        </Section>

        <Section title="Top posts">
          <TopPerformingPosts posts={analyticsPosts?.posts} />
        </Section>
      </div>

      {/* ── 6. Fréquence de publication ─────────────────────────────────── */}
      <Section title="Fréquence de publication vs Engagement">
        <PostingFrequency data={postingFrequency} />
      </Section>

      {/* ── 7. Décroissance de performance ──────────────────────────────── */}
      <Section title="Durée de vie du contenu">
        <ContentDecay data={contentDecay} />
      </Section>

      {/* ── 8. Grille des posts détaillés ───────────────────────────────── */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h2 className="mb-4 text-sm font-semibold">Détails des posts</h2>
        <PostDetailsGrid posts={analyticsPosts?.posts} sortBy={sortBy} />
      </div>
    </div>
  )
}
