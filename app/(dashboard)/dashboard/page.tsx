/**
 * @file app/(dashboard)/dashboard/page.tsx
 * @description Page d'accueil du dashboard (/dashboard).
 *
 *   Affiche un résumé rapide de l'activité de l'utilisateur :
 *   1. Salutation personnalisée avec prénom
 *   2. Alerte conditionnelle si des posts ont le statut FAILED (bannière rouge)
 *   3. 4 cartes KPI (posts publiés, planifiés, impressions, engagement)
 *   4. Section "Réseaux connectés" (pills logo + handle, ou CTA si aucun réseau)
 *
 *   Architecture :
 *   - Server Component (page.tsx) : récupère la session pour le prénom
 *   - Client Components : fetche /api/dashboard et /api/platforms via TanStack Query
 *     → skeletons pendant le chargement (Section 11 CLAUDE.md)
 */

import { headers } from 'next/headers'

import { auth } from '@/lib/auth'
import { ConnectedPlatformsBanner } from '@/modules/dashboard/components/ConnectedPlatformsBanner'
import { DashboardStats } from '@/modules/dashboard/components/DashboardStats'
import { FailedPostsAlert } from '@/modules/dashboard/components/FailedPostsAlert'

import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Dashboard',
}

/**
 * Page principale du dashboard.
 * Server Component async — lit la session pour extraire le prénom de l'utilisateur.
 *
 * @returns Page dashboard avec salutation, alerte FAILED, KPIs et réseaux connectés
 */
export default async function DashboardPage(): Promise<React.JSX.Element> {
  // Lecture de la session pour personnaliser la salutation (prénom ou chaîne vide)
  // La session est garantie non-null ici : le layout redirige vers /login si absente.
  const session = await auth.api.getSession({ headers: await headers() })
  // Extrait le prénom (première partie du nom complet) ou fallback générique
  const firstName = session?.user?.name?.split(' ')[0] ?? null

  return (
    <div className="space-y-6">
      {/* ── 1. En-tête de bienvenue ───────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          {/* Salutation personnalisée si le prénom est disponible */}
          Bonjour{firstName ? ` ${firstName}` : ''} 👋
        </h1>
        <p className="mt-1 text-muted-foreground">
          Voici un aperçu de votre activité.
        </p>
      </div>

      {/* ── 2. Alerte posts échoués (invisible si postsFailed === 0) ─────── */}
      {/*
       * FailedPostsAlert :
       * - Ne rend rien (null) si isLoading ou postsFailed === 0
       * - Affiche une bannière rouge avec count + lien /compose sinon
       * → Le layout ne bouge pas en cas d'absence d'erreurs
       */}
      <FailedPostsAlert />

      {/* ── 3. Cartes KPI — connectées aux vraies données ─────────────────── */}
      {/*
       * DashboardStats est un Client Component qui :
       * 1. Fetche GET /api/dashboard via TanStack Query
       * 2. Affiche un skeleton fidèle pendant le chargement
       * 3. Affiche les vraies valeurs une fois chargées
       */}
      <DashboardStats />

      {/* ── 4. Réseaux connectés ──────────────────────────────────────────── */}
      {/*
       * ConnectedPlatformsBanner :
       * - Skeleton de 3 pills pendant le chargement
       * - Card vide + CTA /settings si aucune plateforme
       * - Pills logo + @handle pour chaque plateforme connectée
       */}
      <ConnectedPlatformsBanner />
    </div>
  )
}
