/**
 * @file app/page.tsx
 * @module app
 * @description Page d'accueil publique (landing page) de ogolong.com.
 *
 *   Architecture : 4 sections sans duplication de features.
 *   - Navbar fixe (adapte CTA selon session)
 *   - Hero compact (titre + sous-titre + CTA + badges plateformes)
 *   - Feature Grid (7 cards avec screenshots — première impression visuelle)
 *   - Feature Highlights (3 features clés détaillées en blocs alternés)
 *   - Plateformes + CTA final (13 logos + inscription)
 *   - Footer légal RGPD
 *
 *   Server Component — les composants landing sont Client Components isolés.
 *
 * @example
 *   // Route : GET /
 */

import Image from 'next/image'
import Link from 'next/link'
import { headers } from 'next/headers'

import { Button } from '@/components/ui/button'
import { auth } from '@/lib/auth'
import { FeatureCarousel } from '@/components/landing/FeatureCarousel'
import { PlatformLogos } from '@/components/landing/PlatformLogos'
import { SiteFooter } from '@/components/shared/SiteFooter'

import type { Metadata } from 'next'

// ─── Métadonnées SEO ─────────────────────────────────────────────────────────

export const metadata: Metadata = {
  title: 'ogolong — Planifiez votre contenu sur tous vos réseaux',
  description:
    'Créez, planifiez et publiez votre contenu sur Instagram, TikTok, YouTube, Facebook et 6 autres réseaux en quelques secondes.',
  openGraph: {
    title: 'ogolong — Planifiez votre contenu sur tous vos réseaux',
    description:
      'Créez, planifiez et publiez votre contenu sur Instagram, TikTok, YouTube, Facebook et 6 autres réseaux en quelques secondes.',
    type: 'website',
  },
}

// ─── Données des plateformes (hero badges) ───────────────────────────────────

const HERO_PLATFORMS = [
  { name: 'Instagram', icon: '/icons/instagram.svg' },
  { name: 'TikTok', icon: '/icons/tiktok.svg' },
  { name: 'YouTube', icon: '/icons/youtube.svg' },
  { name: 'Facebook', icon: '/icons/facebook.svg' },
  { name: 'X (Twitter)', icon: '/icons/twitter.svg' },
  { name: 'LinkedIn', icon: '/icons/linkedin.svg' },
] as const

// ─── Composant ────────────────────────────────────────────────────────────────

/**
 * Page d'accueil publique de ogolong.com.
 * Server Component — les sections interactives sont isolées en Client Components.
 */
export default async function HomePage(): Promise<React.JSX.Element> {
  const session = await auth.api.getSession({ headers: await headers() })
  const isLoggedIn = !!session?.user

  return (
    <div className="relative min-h-screen bg-white font-sans">
      {/* ── Navbar ─────────────────────────────────────────────────────────── */}
      <header className="fixed inset-x-0 top-0 z-50 border-b border-gray-100 bg-white/80 backdrop-blur-sm">
        <nav
          className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4"
          aria-label="Navigation principale"
        >
          <Link
            href="/"
            className="text-xl font-semibold tracking-tight text-gray-900 transition-opacity hover:opacity-80"
            aria-label="ogolong — retour à l'accueil"
          >
            ogolong
          </Link>

          <div className="flex items-center gap-3">
            {isLoggedIn ? (
              <Button size="sm" asChild>
                <Link href="/dashboard">
                  Tableau de bord
                  <span aria-hidden="true" className="ml-1">&rarr;</span>
                </Link>
              </Button>
            ) : (
              <>
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/login">Se connecter</Link>
                </Button>
                <Button size="sm" asChild>
                  <Link href="/register">Essayer gratuitement</Link>
                </Button>
              </>
            )}
          </div>
        </nav>
      </header>

      {/* ── Hero ───────────────────────────────────────────────────────────── */}
      <main>
        <section
          className="flex flex-col items-center px-6 pb-20 pt-32 text-center"
          aria-labelledby="hero-heading"
        >
          {/* Badge beta */}
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-1.5 text-sm text-gray-600 shadow-sm">
            <span className="text-xs text-gray-400" aria-hidden="true">✦</span>
            <span>Beta &middot; Gratuit pendant le lancement</span>
          </div>

          {/* Titre */}
          <h1
            id="hero-heading"
            className="mx-auto max-w-4xl text-balance text-4xl font-bold leading-tight tracking-tight text-gray-900 sm:text-5xl lg:text-6xl"
          >
            Planifiez. Publiez. Analysez.{' '}
            <span className="bg-gradient-to-r from-gray-900 to-gray-400 bg-clip-text text-transparent">
              Tous vos réseaux, un seul outil.
            </span>
          </h1>

          {/* Sous-titre */}
          <p className="mx-auto mt-5 max-w-xl text-balance text-lg leading-relaxed text-gray-500">
            Composez du contenu adapté à chaque plateforme, planifiez-le
            au bon moment, et suivez vos performances — depuis un seul dashboard.
          </p>

          {/* CTAs */}
          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row">
            <Button size="lg" className="h-12 rounded-xl px-8 text-base font-medium" asChild>
              <Link href="/register">
                Commencer gratuitement
                <span aria-hidden="true" className="ml-1">&rarr;</span>
              </Link>
            </Button>
            <Button variant="outline" size="lg" className="h-12 rounded-xl px-8 text-base" asChild>
              <Link href="#features">Voir les fonctionnalités</Link>
            </Button>
          </div>

          {/* Badges plateformes */}
          <div className="mt-10 flex flex-col items-center gap-3" aria-label="Plateformes supportées">
            <p className="text-xs text-gray-400 uppercase tracking-wider">Compatible avec</p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              {HERO_PLATFORMS.map((platform) => (
                <div
                  key={platform.name}
                  className="flex items-center gap-1.5 rounded-lg border border-gray-100 bg-white px-2.5 py-1.5 shadow-sm"
                  title={platform.name}
                >
                  <Image
                    src={platform.icon}
                    alt={platform.name}
                    className="size-4"
                    width={16}
                    height={16}
                  />
                  <span className="hidden text-xs font-medium text-gray-600 sm:inline">
                    {platform.name}
                  </span>
                </div>
              ))}
              <span className="text-xs text-gray-400">+4 autres</span>
            </div>
          </div>
        </section>

        {/* ── Carrousel des fonctionnalités ──────────────────────────────── */}
        <section id="features" className="pb-24 pt-8">
          <FeatureCarousel />
        </section>

        {/* ── Plateformes + CTA final ─────────────────────────────────────── */}
        <section className="py-24">
          <PlatformLogos />
        </section>
      </main>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <SiteFooter />
    </div>
  )
}
