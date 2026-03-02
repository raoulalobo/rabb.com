/**
 * @file modules/dashboard/components/ConnectedPlatformsBanner.tsx
 * @module dashboard
 * @description Section "Réseaux connectés" affichée sur la page /dashboard.
 *
 *   Affiche les plateformes sociales connectées de l'utilisateur sous forme de pills
 *   (logo + handle). Si aucune plateforme n'est connectée, affiche une card vide
 *   avec un CTA vers /settings pour en connecter une.
 *
 *   États gérés :
 *   - isLoading → 3 pills skeleton animées (rounded-full, pulse)
 *   - platforms.length === 0 → card vide + bouton "Connecter un réseau →"
 *   - platforms.length > 0 → liste de pills avec icône + @handle
 *
 *   Données : réutilise usePlatforms() (module platforms) — pas de requête dupliquée
 *   si ce hook est déjà monté ailleurs (TanStack Query partage le cache).
 *
 * @example
 *   // Dans la page /dashboard, sous les cartes KPI :
 *   <ConnectedPlatformsBanner />
 */

'use client'

import Link from 'next/link'

import { Skeleton } from '@/components/ui/skeleton'
import { PlatformIcon } from '@/modules/platforms/components/PlatformIcon'
import { usePlatforms } from '@/modules/platforms/hooks/usePlatforms'

import type { PlatformListItem } from '@/modules/platforms/types'

// ─── Sous-composants ──────────────────────────────────────────────────────────

/**
 * Skeleton de chargement : 3 pills arrondies animées.
 * Reproduit la forme des pills réelles (même hauteur, largeurs variées).
 */
function PillsSkeleton(): React.JSX.Element {
  return (
    <div className="flex flex-wrap gap-2">
      {/* 3 pills de largeurs légèrement différentes pour paraître naturelles */}
      <Skeleton className="h-8 w-28 rounded-full" />
      <Skeleton className="h-8 w-24 rounded-full" />
      <Skeleton className="h-8 w-32 rounded-full" />
    </div>
  )
}

/**
 * Card vide affichée quand aucune plateforme n'est connectée.
 * Inclut un CTA vers /settings.
 */
function EmptyPlatformsCard(): React.JSX.Element {
  return (
    <div className="rounded-lg border border-dashed bg-card p-6 text-center">
      {/* Icône neutre */}
      <svg
        className="mx-auto mb-3 size-8 text-muted-foreground"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M18 20V10" />
        <path d="M12 20V4" />
        <path d="M6 20v-6" />
      </svg>
      <p className="mb-1 text-sm font-medium">Aucun réseau connecté</p>
      <p className="mb-4 text-xs text-muted-foreground">
        Connectez vos comptes pour publier et analyser votre contenu.
      </p>
      {/* CTA → settings */}
      <Link
        href="/settings"
        className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
      >
        Connecter un réseau →
      </Link>
    </div>
  )
}

/**
 * Pill individuelle pour une plateforme connectée.
 * Affiche le logo SVG inline + le handle du compte.
 *
 * @param platform - Données de la plateforme connectée
 */
function PlatformPill({ platform }: { platform: PlatformListItem }): React.JSX.Element {
  return (
    <div className="flex items-center gap-2 rounded-full border bg-card px-3 py-1.5 text-sm">
      {/* Logo de la plateforme (SVG inline via PlatformIcon) */}
      <PlatformIcon platform={platform.platform} className="size-4" />
      {/* Handle du compte — préfixé par @ */}
      <span className="text-muted-foreground">@{platform.accountName}</span>
    </div>
  )
}

// ─── Composant principal ──────────────────────────────────────────────────────

/**
 * Section "Réseaux connectés" du dashboard.
 *
 * Affiche un skeleton pendant le chargement, une card vide avec CTA si aucune
 * plateforme n'est connectée, ou la liste des pills avec logo + handle.
 *
 * @returns Section dashboard avec les réseaux connectés
 *
 * @example
 *   <ConnectedPlatformsBanner />
 */
export function ConnectedPlatformsBanner(): React.JSX.Element {
  const { platforms, isLoading } = usePlatforms()

  return (
    <div className="space-y-3">
      {/* ── Titre de section ──────────────────────────────────────────────── */}
      <h2 className="text-sm font-medium text-muted-foreground">Réseaux connectés</h2>

      {/* ── Contenu conditionnel selon l'état ─────────────────────────────── */}
      {isLoading ? (
        // Chargement → skeleton de pills
        <PillsSkeleton />
      ) : platforms.length === 0 ? (
        // Aucune plateforme → card vide + CTA
        <EmptyPlatformsCard />
      ) : (
        // Plateformes connectées → liste de pills
        <div className="flex flex-wrap gap-2">
          {platforms.map((p) => (
            <PlatformPill key={p.id} platform={p} />
          ))}
        </div>
      )}
    </div>
  )
}
