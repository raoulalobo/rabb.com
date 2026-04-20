/**
 * @file app/layout.tsx
 * @description Layout racine de l'application socialtdl.net.
 *   - Fournit les fonts Geist (sans + mono) via le package npm 'geist' (local, sans réseau)
 *   - Charge Fraunces + Space Grotesk depuis Google Fonts (utilisées par /u/[slug])
 *   - Configure les métadonnées globales (SEO)
 *   - Monte les providers globaux : TanStack Query + Sonner (notifications toast)
 *   - Affiche la bannière de consentement cookies RGPD (CookieBanner)
 *   - Langue : français (lang="fr")
 */

import { GeistMono } from 'geist/font/mono'
import { GeistSans } from 'geist/font/sans'

import { CookieBanner } from '@/components/shared/CookieBanner'
import { QueryProvider } from '@/components/layout/QueryProvider'
import { Toaster } from '@/components/ui/sonner'

import type { Metadata } from 'next'

import './globals.css'

// ─── Fonts ────────────────────────────────────────────────────────────────────

// GeistSans et GeistMono sont importés depuis le package 'geist' (local)
// qui fournit les fonts sans requête réseau vers Google Fonts
// — évite le bug Turbopack "@vercel/turbopack-next/internal/font/google/font"

// ─── Métadonnées ──────────────────────────────────────────────────────────────

export const metadata: Metadata = {
  title: {
    // Titre par défaut (pages sans titre propre)
    default: 'SocialTDL — Planification de contenu multiplateforme',
    // Modèle pour les pages internes : "Compose · SocialTDL"
    template: '%s · SocialTDL',
  },
  description:
    'Planifiez et publiez votre contenu sur Instagram, TikTok, YouTube et Facebook depuis un seul outil.',
  metadataBase: new URL(process.env.BETTER_AUTH_URL ?? 'http://localhost:3000'),
}

// ─── Layout ───────────────────────────────────────────────────────────────────

interface RootLayoutProps {
  children: React.ReactNode
}

/**
 * Layout racine — enveloppe toutes les pages de l'application.
 * Contient les providers globaux et les fonts.
 *
 * @param props.children - Contenu de la page courante (injecté par Next.js App Router)
 * @returns HTML racine avec providers
 */
export default function RootLayout({ children }: RootLayoutProps): React.JSX.Element {
  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        {/*
         * Fraunces (serif) + Space Grotesk (sans) — utilisées par la page
         * publique /u/[slug] (Link in Bio).
         *
         * Chargement via <link> plutôt que next/font/google car Next.js 16 +
         * Turbopack a historiquement un bug d'import sur "@vercel/turbopack-
         * next/internal/font/google/font" (cf. commentaire Geist ci-dessus).
         *
         * Preconnect améliore le TTFB en ouvrant la connexion TCP + TLS tôt.
         */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Fraunces:ital,wght@0,300;0,400;0,600;1,300;1,400&family=Space+Grotesk:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className={`${GeistSans.variable} ${GeistMono.variable} antialiased`}>
        {/* Provider TanStack Query — doit envelopper toute l'app pour le cache partagé */}
        <QueryProvider>
          {children}

          {/* Sonner — notifications toast globales (succès, erreurs, infos) */}
          <Toaster richColors position="top-right" />

          {/* Bannière RGPD — affichée uniquement au premier chargement (Client Component) */}
          <CookieBanner />
        </QueryProvider>
      </body>
    </html>
  )
}
