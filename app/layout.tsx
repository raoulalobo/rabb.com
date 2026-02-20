/**
 * @file app/layout.tsx
 * @description Layout racine de l'application rabb.com.
 *   - Fournit les fonts Geist (sans + mono) via le package npm 'geist' (local, sans réseau)
 *   - Configure les métadonnées globales (SEO)
 *   - Monte les providers globaux : TanStack Query + Sonner (notifications toast)
 *   - Langue : français (lang="fr")
 */

import { GeistMono } from 'geist/font/mono'
import { GeistSans } from 'geist/font/sans'

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
    default: 'rabb — Planification de contenu',
    // Modèle pour les pages internes : "Compose · rabb"
    template: '%s · rabb',
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
      <body className={`${GeistSans.variable} ${GeistMono.variable} antialiased`}>
        {/* Provider TanStack Query — doit envelopper toute l'app pour le cache partagé */}
        <QueryProvider>
          {children}

          {/* Sonner — notifications toast globales (succès, erreurs, infos) */}
          <Toaster richColors position="top-right" />
        </QueryProvider>
      </body>
    </html>
  )
}
