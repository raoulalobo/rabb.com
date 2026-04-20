/**
 * @file app/(dashboard)/dashboard/page.tsx
 * @description Page d'accueil du dashboard (/dashboard).
 *
 *   Deux modes d'affichage selon l'état d'onboarding de l'utilisateur :
 *
 *   1. Onboarding (onboardingStep < 2) :
 *      Bandeau inline guidant l'utilisateur à connecter un réseau (étape 0)
 *      puis à créer son premier post (étape 1).
 *
 *   2. Dashboard normal (onboardingStep = 2) :
 *      Salutation personnalisée, alerte FAILED, KPIs, réseaux connectés.
 */

import { headers } from 'next/headers'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { BioLinkHomeCard } from '@/modules/biolink/components/BioLinkHomeCard'
import { ConnectedPlatformsBanner } from '@/modules/dashboard/components/ConnectedPlatformsBanner'
import { DashboardStats } from '@/modules/dashboard/components/DashboardStats'
import { FailedPostsAlert } from '@/modules/dashboard/components/FailedPostsAlert'
import { OnboardingBanner } from '@/modules/onboarding/components/OnboardingBanner'
import { ONBOARDING_STEPS } from '@/modules/onboarding/types'

import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Dashboard',
}

/**
 * Page principale du dashboard.
 * Server Component async — lit la session + l'étape d'onboarding depuis Prisma.
 *
 * @returns Onboarding banner (si non terminé) ou dashboard complet
 */
export default async function DashboardPage(): Promise<React.JSX.Element> {
  const session = await auth.api.getSession({ headers: await headers() })
  const firstName = session?.user?.name?.split(' ')[0] ?? null

  // Lire l'étape d'onboarding depuis la DB
  const user = session?.user?.id
    ? await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { onboardingStep: true },
      })
    : null

  const onboardingStep = user?.onboardingStep ?? 0

  // ── Onboarding en cours → afficher le bandeau guidé ────────────────────
  if (onboardingStep < ONBOARDING_STEPS.COMPLETED) {
    return <OnboardingBanner step={onboardingStep} firstName={firstName} />
  }

  // ── BioPage éventuelle pour le widget "Ma Link-in-Bio" ─────────────────
  // On n'affiche le widget que si l'user a déjà une BioPage (créée via /biolink).
  // Select minimal pour éviter de transporter des champs inutiles côté serveur.
  const bioPage = session?.user?.id
    ? await prisma.bioPage.findUnique({
        where: { userId: session.user.id },
        select: {
          slug: true,
          isPublished: true,
          title: true,
          avatarUrl: true,
        },
      })
    : null

  // ── Dashboard normal (onboarding terminé) ──────────────────────────────
  return (
    <div className="space-y-6">
      {/* ── 1. En-tête de bienvenue ───────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Bonjour{firstName ? ` ${firstName}` : ''} !
        </h1>
        <p className="mt-1 text-muted-foreground">
          Voici un aperçu de votre activité.
        </p>
      </div>

      {/* ── 2. Alerte posts échoués ───────────────────────────────────────── */}
      <FailedPostsAlert />

      {/* ── 3. Cartes KPI ─────────────────────────────────────────────────── */}
      <DashboardStats />

      {/* ── 4. Réseaux connectés ──────────────────────────────────────────── */}
      <ConnectedPlatformsBanner />

      {/* ── 5. Widget "Ma Link-in-Bio" (si BioPage existante) ─────────────── */}
      {/* N'apparaît que si l'utilisateur a déjà créé sa BioPage via /biolink —
          sinon on ne pollue pas le dashboard avec un CTA supplémentaire. */}
      {bioPage && <BioLinkHomeCard page={bioPage} />}
    </div>
  )
}
