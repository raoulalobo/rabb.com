/**
 * @file components/shared/SiteFooter.tsx
 * @description Footer global du site socialtdl.net.
 *   Utilisé dans les layouts : auth, légal, et la landing page.
 *
 *   Structure 3 colonnes :
 *     - Gauche  : cercle logo avec initiale "N"
 *     - Centre  : copyright dynamique avec l'année courante
 *     - Droite  : liens légaux (privacy, terms, legal)
 *
 *   Responsive :
 *     - Mobile (< sm) : colonnes empilées centrées (flex-col)
 *     - Desktop (≥ sm) : ligne justify-between (flex-row)
 *
 *   Exemple d'utilisation :
 *   ```tsx
 *   import { SiteFooter } from '@/components/shared/SiteFooter'
 *   // ...
 *   <SiteFooter />
 *   ```
 */

import Link from 'next/link'

/**
 * Footer partagé du site socialtdl.net.
 * Server Component pur — pas d'état client ni d'effets.
 *
 * @returns Élément <footer> avec logo, copyright et liens légaux
 */
export function SiteFooter(): React.JSX.Element {
  return (
    <footer className="border-t">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-6 py-4 sm:flex-row">
        {/* ── Logo ────────────────────────────────────────────────────────────
         * Cercle sombre avec initiale — remplaçable par un SVG définitif.
         * select-none empêche la sélection accidentelle de la lettre.
         */}
        <div
          className="flex size-8 shrink-0 items-center justify-center rounded-full bg-foreground text-background text-xs font-semibold select-none"
          aria-hidden="true"
        >
          N
        </div>

        {/* ── Copyright ───────────────────────────────────────────────────────
         * new Date().getFullYear() calculé côté serveur au rendu — pas de
         * risque de désynchronisation hydratation client/serveur.
         */}
        <p className="text-xs text-muted-foreground">
          © {new Date().getFullYear()} socialtdl.net — Tous droits réservés
        </p>

        {/* ── Navigation légale ───────────────────────────────────────────────
         * gap-x-6 : espacement sans séparateur "·" (plus propre).
         * justify-center sur mobile pour centrer les liens groupés.
         */}
        <nav
          className="flex flex-wrap justify-center gap-x-6 gap-y-1"
          aria-label="Liens légaux"
        >
          <Link
            href="/privacy"
            className="text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            Politique de confidentialité
          </Link>
          <Link
            href="/terms"
            className="text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            CGU
          </Link>
          <Link
            href="/legal"
            className="text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            Mentions légales
          </Link>
        </nav>
      </div>
    </footer>
  )
}
