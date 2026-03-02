/**
 * @file modules/dashboard/components/DashboardStats.tsx
 * @module dashboard
 * @description Grille de 4 cartes KPI pour la page /dashboard.
 *
 *   Affiche les statistiques rapides de l'utilisateur :
 *   - Posts publiés   (source : Prisma)
 *   - Posts planifiés (source : Prisma)
 *   - Impressions     (source : Late API, 30 derniers jours)
 *   - Engagement      (source : Late API, 30 derniers jours)
 *
 *   États :
 *   - Chargement → skeleton (4 cartes animées)
 *   - Erreur     → cartes avec "—" et message discret
 *   - Succès     → valeurs réelles formatées
 *
 * @example
 *   // Dans la page dashboard :
 *   <DashboardStats />
 */

'use client'

import { Skeleton } from '@/components/ui/skeleton'
import { useDashboardStats } from '@/modules/dashboard/hooks/useDashboardStats'

// ─── Types ────────────────────────────────────────────────────────────────────

/** Définition d'une carte KPI */
interface StatCard {
  /** Libellé affiché sous la valeur */
  label: string
  /** Valeur formatée à afficher */
  value: string
  /** Sous-texte contextuel (période, unité, etc.) */
  sub: string
}

// ─── Utilitaires de formatage ─────────────────────────────────────────────────

/**
 * Formate un grand nombre avec séparateur de milliers (ex: 45 200).
 * @param n - Nombre à formater
 */
function formatNumber(n: number): string {
  return n.toLocaleString('fr-FR')
}

/**
 * Formate un taux d'engagement en pourcentage avec 1 décimale (ex: 4,2 %).
 * @param rate - Taux brut (ex: 4.2 → "4,2 %")
 */
function formatRate(rate: number): string {
  return `${rate.toFixed(1).replace('.', ',')} %`
}

// ─── Squelette de chargement ──────────────────────────────────────────────────

/**
 * Skeleton qui reproduit fidèlement la forme de la grille de stats.
 * 4 cartes avec le même layout que les cartes réelles.
 */
function DashboardStatsSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="rounded-lg border bg-card p-6">
          {/* Libellé de la carte */}
          <Skeleton className="h-4 w-28" />
          {/* Valeur principale — grande */}
          <Skeleton className="mt-3 h-8 w-16" />
          {/* Sous-texte contextuel */}
          <Skeleton className="mt-2 h-3 w-20" />
        </div>
      ))}
    </div>
  )
}

// ─── Composant principal ──────────────────────────────────────────────────────

/**
 * Grille de 4 cartes KPI connectées aux vraies données via useDashboardStats.
 *
 * Affiche un skeleton pendant le chargement (conforme aux règles Section 11 CLAUDE.md).
 * En cas d'erreur, affiche "—" avec un message discret pour ne pas bloquer l'interface.
 */
export function DashboardStats() {
  const { data, isLoading, isError } = useDashboardStats()

  // ── Chargement ───────────────────────────────────────────────────────────
  if (isLoading) return <DashboardStatsSkeleton />

  // ── Construction des cartes (erreur → valeurs dégradées "—") ─────────────
  const cards: StatCard[] = [
    {
      label: 'Posts publiés',
      value: isError ? '—' : formatNumber(data!.postsPublished),
      sub: 'total',
    },
    {
      label: 'Posts planifiés',
      value: isError ? '—' : formatNumber(data!.postsScheduled),
      sub: 'à venir',
    },
    {
      label: 'Impressions',
      value: isError ? '—' : formatNumber(data!.impressions),
      sub: '30 derniers jours',
    },
    {
      label: 'Engagement',
      value: isError ? '—' : (data!.engagementRate > 0 ? formatRate(data!.engagementRate) : '—'),
      sub: '30 derniers jours',
    },
  ]

  return (
    <div className="space-y-2">
      {/* Message d'erreur discret — n'empêche pas l'affichage des autres sections */}
      {isError && (
        <p className="text-sm text-muted-foreground">
          Impossible de charger les statistiques.
        </p>
      )}

      {/* Grille des 4 cartes KPI */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <div key={card.label} className="rounded-lg border bg-card p-6">
            {/* Libellé */}
            <p className="text-sm font-medium text-muted-foreground">{card.label}</p>
            {/* Valeur principale */}
            <p className="mt-2 text-3xl font-bold tracking-tight">{card.value}</p>
            {/* Contexte (période ou unité) */}
            <p className="mt-1 text-xs text-muted-foreground">{card.sub}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
