# Phase 06 — Tableau de bord analytique

> **Skills à activer** : `vercel-react-best-practices`, `frontend-design`, `web-design-guidelines`
> **Prérequis** : Phase 05 complétée (posts publiés disponibles)

---

## Objectif

Afficher les statistiques de performance agrégées depuis getlate.dev :
- Cards de métriques clés (impressions, engagement, likes, partages)
- Graphique d'évolution dans le temps (par plateforme)
- Tableau TanStack Table des posts publiés avec leurs métriques
- Filtres par période (7j, 30j, 90j) et par plateforme
- Skeletons fidèles pour chaque section

---

## Étapes

### 6.1 — Route API proxy analytics

```typescript
// app/api/analytics/route.ts
/**
 * @file route.ts
 * @description Proxy vers getlate.dev analytics API.
 *   Agrège les stats de toutes les plateformes connectées de l'utilisateur.
 *   Met en cache la réponse 15 minutes (revalidation Next.js).
 *
 * Query params :
 *   - period : '7d' | '30d' | '90d' (défaut: '30d')
 *   - platform : plateforme spécifique (optionnel)
 */
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { late } from '@/lib/late'
import { prisma } from '@/lib/prisma'
import { headers } from 'next/headers'

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const period = searchParams.get('period') ?? '30d'
  const platform = searchParams.get('platform') ?? undefined

  // Récupérer les profils getlate.dev connectés de l'utilisateur
  const connectedPlatforms = await prisma.connectedPlatform.findMany({
    where: { userId: session.user.id, isActive: true },
  })

  if (connectedPlatforms.length === 0) {
    return NextResponse.json({ metrics: null, posts: [] })
  }

  // Agréger les analytics via getlate.dev
  const analytics = await late.analytics.get({
    profileIds: connectedPlatforms.map((p) => p.lateProfileId),
    period,
    platform,
  })

  return NextResponse.json(analytics, {
    headers: {
      // Cache 15 minutes côté CDN Vercel
      'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=60',
    },
  })
}
```

### 6.2 — Types analytics

```typescript
// modules/analytics/types.ts
/**
 * @file types.ts
 * @description Types TypeScript pour les données analytiques.
 */

export interface PlatformMetrics {
  platform:    string
  impressions: number
  engagement:  number   // taux en %
  likes:       number
  shares:      number
  comments:    number
  followers:   number
  followersDelta: number // variation sur la période
}

export interface PostMetrics {
  postId:      string
  text:        string
  platforms:   string[]
  publishedAt: Date
  impressions: number
  engagement:  number
  likes:       number
  shares:      number
}

export interface AnalyticsSummary {
  period:         string
  totalImpressions: number
  avgEngagement:  number
  totalLikes:     number
  totalShares:    number
  byPlatform:     PlatformMetrics[]
  posts:          PostMetrics[]
  // Série temporelle pour le graphique (par jour)
  timeSeries: Array<{
    date:        string
    impressions: number
    engagement:  number
  }>
}
```

### 6.3 — Hook TanStack Query analytics

```typescript
// modules/analytics/hooks/useAnalytics.ts
/**
 * @file useAnalytics.ts
 * @description Hook TanStack Query pour les analytics.
 *   Recharge automatiquement quand period ou platform change.
 *
 * @param period - Période d'analyse ('7d', '30d', '90d')
 * @param platform - Filtrer par plateforme (optionnel)
 *
 * @example
 *   const { data, isLoading } = useAnalytics({ period: '30d' })
 */
import { useQuery } from '@tanstack/react-query'
import type { AnalyticsSummary } from '@/modules/analytics/types'

interface UseAnalyticsParams {
  period?: '7d' | '30d' | '90d'
  platform?: string
}

async function fetchAnalytics(params: UseAnalyticsParams): Promise<AnalyticsSummary> {
  const query = new URLSearchParams()
  if (params.period)   query.set('period', params.period)
  if (params.platform) query.set('platform', params.platform)

  const res = await fetch(`/api/analytics?${query}`)
  if (!res.ok) throw new Error('Erreur de chargement des analytics')
  return res.json()
}

export const analyticsQueryKeys = {
  all:    ['analytics'] as const,
  detail: (params: UseAnalyticsParams) => ['analytics', params] as const,
}

export function useAnalytics(params: UseAnalyticsParams = {}) {
  return useQuery({
    queryKey: analyticsQueryKeys.detail(params),
    queryFn:  () => fetchAnalytics(params),
    staleTime: 1000 * 60 * 15, // 15 min (aligné avec le cache serveur)
  })
}
```

### 6.4 — Composants analytics

**StatsCard** — carte métrique clé :
```
┌─────────────────────────┐
│ 📊 Impressions           │
│ 42 851                  │
│ ▲ +12% vs période préc. │
└─────────────────────────┘
```
Skeleton : rectangle de même taille avec 3 blocs `<Skeleton>` empilés.

**EngagementChart** — graphique en ligne (recharts ou chart.js) :
```
modules/analytics/components/EngagementChart.tsx
modules/analytics/components/EngagementChartSkeleton.tsx
```

**PostsTable** — TanStack Table des posts publiés :
```typescript
// modules/analytics/components/PostsTable.tsx
/**
 * @file PostsTable.tsx
 * @description Tableau TanStack Table des posts publiés avec leurs métriques.
 *   Colonnes : Texte (tronqué), Plateformes, Date, Impressions, Engagement, Likes
 *   Tri côté client, pagination côté client (20 posts/page)
 */
```

Colonnes TanStack Table :
| Colonne | Type | Triable |
|---|---|---|
| Texte | string (tronqué 80 chars) | Non |
| Plateformes | badges | Non |
| Date publication | date | Oui |
| Impressions | number | Oui |
| Engagement | % | Oui |
| Likes | number | Oui |

Skeleton du tableau : header fixe + 5 lignes `<Skeleton>` de même hauteur.

### 6.5 — Page analytics avec skeletons

```typescript
// app/(dashboard)/analytics/page.tsx
// app/(dashboard)/analytics/loading.tsx
```

Layout de la page :
```
┌──────────────────────────────────────────────────────┐
│ Filtres : [7 jours] [30 jours] [90 jours] [Plateforme▼] │
├──────────────────────────────────────────────────────┤
│ [StatsCard] [StatsCard] [StatsCard] [StatsCard]      │
├──────────────────────────────────────────────────────┤
│ EngagementChart (ligne temporelle)                   │
├──────────────────────────────────────────────────────┤
│ PostsTable (TanStack Table + pagination)             │
└──────────────────────────────────────────────────────┘
```

Le `loading.tsx` reproduit ce layout EXACTEMENT avec des `<Skeleton>`.

### 6.6 — Store Zustand pour les filtres

```typescript
// modules/analytics/store/analytics.store.ts
/**
 * @file analytics.store.ts
 * @description Store Zustand des filtres analytics (période, plateforme).
 *   Permet de synchroniser les filtres entre les composants sans prop drilling.
 */
import { create } from 'zustand'

interface AnalyticsStore {
  period:   '7d' | '30d' | '90d'
  platform: string | null
  setPeriod:   (period: '7d' | '30d' | '90d') => void
  setPlatform: (platform: string | null) => void
}

export const useAnalyticsStore = create<AnalyticsStore>()((set) => ({
  period:      '30d',
  platform:    null,
  setPeriod:   (period) => set({ period }),
  setPlatform: (platform) => set({ platform }),
}))
```

---

## Tests

```typescript
// tests/unit/modules/analytics/analytics.types.test.ts
// Vérifier la transformation des données getlate.dev → AnalyticsSummary

// tests/integration/modules/analytics/analytics.api.test.ts
// Mocker getlate.dev avec MSW, vérifier l'agrégation des métriques
```

```bash
pnpm vitest run tests/unit/modules/analytics
```

---

## Vérification / Critères de succès

- [ ] Page `/analytics` affiche les 4 StatsCards avec données réelles
- [ ] Graphique d'engagement affiché et interactif
- [ ] Tableau des posts publiés avec tri par colonne fonctionnel
- [ ] Filtre période → rechargement des données (TanStack Query invalide le cache)
- [ ] Skeleton reproduit fidèlement le layout de la page
- [ ] `pnpm build` sans erreur TypeScript

---

## Passage à la phase suivante

Une fois cette phase validée → lire `07-inbox.md`.
