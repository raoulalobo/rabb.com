/**
 * @file app/(legal)/layout.tsx
 * @module legal
 * @description Layout minimal pour les pages légales (politique de confidentialité, CGU, mentions légales).
 *   - Accessible sans authentification (aucune vérification de session)
 *   - Design épuré : logo + contenu centré + footer avec liens légaux
 *   - Max-width 3xl pour une lisibilité optimale des textes longs
 *
 *   Pages enfants :
 *   - /privacy → Politique de confidentialité RGPD
 *   - /terms   → Conditions Générales d'Utilisation
 *   - /legal   → Mentions légales
 */

import Link from 'next/link'
import { IconLogo } from '@/components/brand/IconLogo'
import { WordmarkLogo } from '@/components/brand/WordmarkLogo'
import { SiteFooter } from '@/components/shared/SiteFooter'

interface LegalLayoutProps {
  children: React.ReactNode
}

/**
 * Layout public minimal pour les pages légales.
 * Server Component pur — pas de logique dynamique.
 *
 * @param props.children - Page légale (privacy, terms ou legal)
 * @returns Conteneur centré avec logo et footer de navigation
 */
export default function LegalLayout({ children }: LegalLayoutProps): React.JSX.Element {
  return (
    <div className="min-h-screen bg-background">
      {/* ── En-tête minimal : logo uniquement ── */}
      <header className="border-b">
        <div className="mx-auto max-w-3xl px-4 py-4">
          <Link
            href="/"
            className="flex items-center hover:opacity-80 transition-opacity"
            aria-label="SocialTDL — retour à l'accueil"
          >
            {/* Swap responsive : icon compact sur mobile, wordmark sur tablette+ */}
            <IconLogo className="h-8 w-8 sm:hidden" />
            <WordmarkLogo className="hidden h-8 w-auto sm:block" />
          </Link>
        </div>
      </header>

      {/* ── Contenu de la page légale ── */}
      <main className="mx-auto max-w-3xl px-4 py-12">
        {children}
      </main>

      {/* ── Footer partagé ── */}
      <SiteFooter />
    </div>
  )
}
