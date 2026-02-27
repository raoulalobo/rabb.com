/**
 * @file modules/analytics/components/AnalyticsFilters.tsx
 * @module analytics
 * @description Barre de filtres de la page analytics.
 *   Dropdowns : plateforme, fenêtre temporelle, tri.
 *   Les changements sont propagés au store Zustand (useAnalyticsStore).
 *
 * @example
 *   <AnalyticsFilters />
 */

'use client'

import { ChevronDown } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useAnalyticsStore } from '@/modules/analytics/store/analytics.store'

// ─── Options des filtres ──────────────────────────────────────────────────────

const PLATFORM_OPTIONS = [
  { value: 'all', label: 'Toutes les plateformes' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'twitter', label: 'Twitter/X' },
]

const DATE_RANGE_OPTIONS = [
  { value: '7d', label: '7 derniers jours' },
  { value: '30d', label: '30 derniers jours' },
  { value: '90d', label: '90 derniers jours' },
  { value: '180d', label: '180 derniers jours' },
] as const

const SORT_OPTIONS = [
  { value: 'newest', label: 'Plus récents' },
  { value: 'engagement', label: 'Meilleur engagement' },
  { value: 'views', label: 'Plus vus' },
] as const

// ─── Composant ────────────────────────────────────────────────────────────────

/**
 * Barre de filtres analytics avec dropdowns shadcn/ui.
 * Synchronisée avec le store Zustand — les queries se recalculent automatiquement.
 */
export function AnalyticsFilters(): React.JSX.Element {
  const { platform, dateRange, sortBy, setPlatform, setDateRange, setSortBy } =
    useAnalyticsStore()

  const currentPlatform =
    PLATFORM_OPTIONS.find((o) => o.value === platform)?.label ?? 'Toutes les plateformes'
  const currentRange =
    DATE_RANGE_OPTIONS.find((o) => o.value === dateRange)?.label ?? '30 derniers jours'
  const currentSort =
    SORT_OPTIONS.find((o) => o.value === sortBy)?.label ?? 'Plus récents'

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* ── Filtre plateforme ─────────────────────────────────────────────── */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs">
            {currentPlatform}
            <ChevronDown className="size-3 opacity-60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {PLATFORM_OPTIONS.map((opt) => (
            <DropdownMenuItem
              key={opt.value}
              onClick={() => setPlatform(opt.value)}
              className={platform === opt.value ? 'bg-accent' : ''}
            >
              {opt.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* ── Filtre fenêtre temporelle ─────────────────────────────────────── */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs">
            {currentRange}
            <ChevronDown className="size-3 opacity-60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {DATE_RANGE_OPTIONS.map((opt) => (
            <DropdownMenuItem
              key={opt.value}
              onClick={() => setDateRange(opt.value)}
              className={dateRange === opt.value ? 'bg-accent' : ''}
            >
              {opt.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* ── Filtre tri ────────────────────────────────────────────────────── */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs">
            {currentSort}
            <ChevronDown className="size-3 opacity-60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {SORT_OPTIONS.map((opt) => (
            <DropdownMenuItem
              key={opt.value}
              onClick={() => setSortBy(opt.value)}
              className={sortBy === opt.value ? 'bg-accent' : ''}
            >
              {opt.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
