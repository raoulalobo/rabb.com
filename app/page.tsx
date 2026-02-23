/**
 * @file app/page.tsx
 * @module app
 * @description Page d'accueil publique (landing page) de rabb.com.
 *
 *   Structure :
 *   - Navbar : logo + liens de navigation + CTA
 *   - Hero : accroche, sous-titre, CTAs primaires, logos plateformes
 *   - Fond : dot grid SVG subtil (CSS background-image)
 *
 *   Server Component pur — aucun JS client requis.
 *   Responsive : mobile-first avec breakpoints md/lg.
 */

import Image from 'next/image'
import Link from 'next/link'

import { Button } from '@/components/ui/button'

import type { Metadata } from 'next'

// ─── Métadonnées SEO ─────────────────────────────────────────────────────────

export const metadata: Metadata = {
  title: 'rabb — Planifiez votre contenu sur tous vos réseaux',
  description:
    'Créez, planifiez et publiez votre contenu sur Instagram, TikTok, YouTube et Facebook en quelques secondes grâce à l\'IA.',
  openGraph: {
    title: 'rabb — Planifiez votre contenu sur tous vos réseaux',
    description:
      'Créez, planifiez et publiez votre contenu sur Instagram, TikTok, YouTube et Facebook en quelques secondes grâce à l\'IA.',
    type: 'website',
  },
}

// ─── Données des plateformes ──────────────────────────────────────────────────

/**
 * Liste des plateformes prioritaires affichées dans le hero.
 * Chaque entrée référence un SVG dans /public/icons/.
 */
const PLATFORMS = [
  {
    name: 'Instagram',
    icon: '/icons/instagram.svg',
    // Couleur de marque officielle — utilisée pour le label accessible
    color: '#E1306C',
  },
  {
    name: 'TikTok',
    icon: '/icons/tiktok.svg',
    color: '#010101',
  },
  {
    name: 'YouTube',
    icon: '/icons/youtube.svg',
    color: '#FF0000',
  },
  {
    name: 'Facebook',
    icon: '/icons/facebook.svg',
    color: '#1877F2',
  },
  {
    name: 'X (Twitter)',
    icon: '/icons/twitter.svg',
    color: '#000000',
  },
  {
    name: 'Snapchat',
    icon: '/icons/snapchat.svg',
    color: '#FFFC00',
  },
] as const

// ─── Composant ────────────────────────────────────────────────────────────────

/**
 * Page d'accueil publique de rabb.com.
 *
 * Sections :
 * 1. Navbar fixe — logo + CTA connexion/inscription
 * 2. Hero pleine hauteur — badge, H1 avec gradient, sous-titre, CTAs, plateformes
 *
 * @returns Page d'accueil Server Component (JSX)
 */
export default function HomePage(): React.JSX.Element {
  return (
    /*
     * Conteneur racine avec le fond dot grid.
     * Le pattern SVG est encodé en data URI pour éviter une requête réseau
     * supplémentaire. Les points sont gris très légers (oklch ~0.9) pour
     * rester discrets sur fond blanc.
     */
    <div
      className="relative min-h-screen bg-white font-sans"
      style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg width='20' height='20' viewBox='0 0 20 20' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='1' cy='1' r='1' fill='%23e5e7eb' /%3E%3C/svg%3E")`,
        backgroundRepeat: 'repeat',
        backgroundSize: '20px 20px',
      }}
    >
      {/* ── Navbar ─────────────────────────────────────────────────────────── */}
      <header className="fixed inset-x-0 top-0 z-50 border-b border-gray-100 bg-white/80 backdrop-blur-sm">
        <nav
          className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4"
          aria-label="Navigation principale"
        >
          {/* Logo — texte pur, sobre et lisible */}
          <Link
            href="/"
            className="text-xl font-semibold tracking-tight text-gray-900 transition-opacity hover:opacity-80"
            aria-label="rabb — retour à l'accueil"
          >
            rabb
          </Link>

          {/* Actions de navigation */}
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/login">Se connecter</Link>
            </Button>

            <Button size="sm" asChild>
              <Link href="/register">Essayer gratuitement</Link>
            </Button>
          </div>
        </nav>
      </header>

      {/* ── Hero ───────────────────────────────────────────────────────────── */}
      <main>
        <section
          className="flex min-h-screen flex-col items-center justify-center px-6 pb-16 pt-32 text-center"
          aria-labelledby="hero-heading"
        >
          {/* ── Badge pill ─────────────────────────────────────────────────── */}
          {/*
           * Badge de statut bêta — annonce la gratuité pendant le lancement.
           * L'étoile Unicode ✦ est un caractère décoratif (pas un emoji).
           */}
          <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-1.5 text-sm text-gray-600 shadow-sm">
            <span
              className="text-xs text-gray-400"
              aria-hidden="true"
            >
              ✦
            </span>
            <span>Beta &middot; Gratuit pendant le lancement</span>
          </div>

          {/* ── Titre principal ────────────────────────────────────────────── */}
          {/*
           * H1 avec deux parties :
           * - Ligne 1 : texte noir normal
           * - Derniers mots : gradient sombre noir→gris (sobre, pas flashy)
           * text-balance améliore la lisibilité sur mobile (Chrome 114+)
           */}
          <h1
            id="hero-heading"
            className="mx-auto max-w-4xl text-balance text-5xl font-bold leading-tight tracking-tight text-gray-900 md:text-7xl"
          >
            Publiez sur tous vos réseaux{' '}
            <span
              className="bg-gradient-to-r from-gray-900 to-gray-500 bg-clip-text text-transparent"
              aria-label="en quelques secondes"
            >
              en quelques secondes
            </span>
          </h1>

          {/* ── Sous-titre ─────────────────────────────────────────────────── */}
          <p className="mx-auto mt-6 max-w-xl text-balance text-xl leading-relaxed text-gray-500">
            Rabb utilise l&apos;IA pour générer du contenu adapté à chaque plateforme
            et le publie automatiquement au bon moment.
          </p>

          {/* ── CTAs primaires ─────────────────────────────────────────────── */}
          <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row">
            {/* CTA principal — redirige vers l'inscription */}
            <Button size="lg" className="h-12 rounded-xl px-8 text-base font-medium" asChild>
              <Link href="/register">
                Commencer gratuitement
                {/* Flèche decorative en texte — pas de SVG externe requis */}
                <span aria-hidden="true" className="ml-1">&rarr;</span>
              </Link>
            </Button>

            {/* CTA secondaire — ancre vers la section demo (future) */}
            <Button
              variant="ghost"
              size="lg"
              className="h-12 rounded-xl px-8 text-base font-medium text-gray-600 hover:text-gray-900"
              asChild
            >
              <Link href="#demo">Voir une demo</Link>
            </Button>
          </div>

          {/* ── Logos plateformes ──────────────────────────────────────────── */}
          {/*
           * Affichage horizontal des 4 plateformes prioritaires.
           * Chaque logo est un SVG servi statiquement depuis /public/icons/.
           * alt descriptif pour l'accessibilité (lecteurs d'écran).
           */}
          <div
            className="mt-14 flex flex-col items-center gap-4"
            aria-label="Plateformes supportées"
          >
            <p className="text-sm text-gray-400">
              Compatible avec
            </p>

            {/*
             * flex-wrap : les badges passent à la ligne sur mobile si l'espace manque.
             * justify-center : toujours centré quelle que soit la largeur.
             * gap-3 : espacement réduit par rapport aux 4 logos (gap-5) pour tenir en une ligne sur desktop.
             */}
            <div className="flex flex-wrap items-center justify-center gap-3">
              {PLATFORMS.map((platform) => (
                <div
                  key={platform.name}
                  className="flex items-center gap-2 rounded-lg border border-gray-100 bg-white px-3 py-2 shadow-sm transition-shadow hover:shadow-md"
                  title={platform.name}
                >
                  {/* Icone SVG de la plateforme — taille fixe pour l'alignement */}
                  {/*
                   * next/image est utilisé pour l'optimisation automatique (LCP, bandwidth).
                   * width/height obligatoires pour les images statiques non-layout-fill.
                   */}
                  <Image
                    src={platform.icon}
                    alt={`Logo ${platform.name}`}
                    className="size-5 shrink-0"
                    width={20}
                    height={20}
                  />
                  {/* Nom de la plateforme — masqué sur très petit écran */}
                  <span className="hidden text-sm font-medium text-gray-700 sm:inline">
                    {platform.name}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* ── Disclaimer discret ─────────────────────────────────────────── */}
          {/*
           * Texte de réassurance affiché sous les CTAs.
           * Renforce la confiance : pas de CB, gratuit au lancement.
           */}
          <p className="mt-10 text-sm text-gray-400">
            Aucune carte bancaire requise &middot; Gratuit pendant le lancement
          </p>
        </section>
      </main>
    </div>
  )
}
