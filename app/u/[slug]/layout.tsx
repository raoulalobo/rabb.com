/**
 * @file app/u/[slug]/layout.tsx
 * @module app/u
 * @description Layout public minimal pour les pages Link in Bio (`/u/[slug]`).
 *
 *   Accessible sans authentification. Isolé du layout dashboard (pas de
 *   Sidebar/Header), du layout legal (pas de SiteFooter), et de la landing
 *   (pas de navbar SocialTDL). La page doit s'afficher en plein écran,
 *   immersive, comme une app mobile — le design avatar full-bleed ne
 *   tolère aucun chrome parent.
 *
 *   Le seul apport de ce layout : isoler le `children` dans un wrapper dark
 *   cohérent avec le background de la BioPage (#0a0806).
 *
 *   NOTE : ce layout est sous le root `app/layout.tsx` qui fournit encore
 *   les providers globaux (TanStack Query, Toaster, CookieBanner). Ces
 *   éléments sont neutres visuellement pour la page publique.
 */

interface BioLinkLayoutProps {
  children: React.ReactNode
}

/**
 * Layout minimal pour /u/[slug] — immersif, dark, plein écran.
 * Server Component (pas d'état).
 *
 * @param props.children - Page rendue (BioPageRenderer)
 * @returns Wrapper pleine hauteur avec background dark
 */
export default function BioLinkLayout({
  children,
}: BioLinkLayoutProps): React.JSX.Element {
  return (
    <div
      className="min-h-dvh w-full"
      style={{ background: '#0a0806' }}
    >
      {children}
    </div>
  )
}
