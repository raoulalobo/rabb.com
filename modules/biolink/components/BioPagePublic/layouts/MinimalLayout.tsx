/**
 * @file modules/biolink/components/BioPagePublic/layouts/MinimalLayout.tsx
 * @module biolink
 * @description Layout "Minimal" de la BioPage.
 *   Pas d'avatar, nom en grand (text-3xl bold), bio subtile, liens immédiats.
 *   Icônes sociales en bas au lieu du haut. Design text-first, épuré.
 *
 * @example
 *   <MinimalLayout page={page} links={activeLinks} theme={theme} ... />
 */

'use client'

import { BioLinksRenderer } from '../BioLinksRenderer'
import { ContactForm } from '../ContactForm'
import { SocialIcons } from '../SocialIcons'

import type { LayoutProps } from './types'
import { isBioPagePublic } from './types'

// ─── Composant ────────────────────────────────────────────────────────────────

/**
 * Layout minimal : texte-first, pas d'avatar, social en bas.
 * Structure : titre (grand) → bio (subtile) → liens (immédiats) → contact → social → branding.
 *
 * @returns Layout minimal complet
 */
export function MinimalLayout({
  page,
  links,
  theme,
  spacingClass,
  buttonShapeClass,
  hoverClass,
  buttonVariantClass,
  isPreview = false,
}: LayoutProps): React.JSX.Element {
  const isPublic = isBioPagePublic(page)

  return (
    <div className={isPreview ? 'space-y-3' : 'space-y-4'}>
      {/* ── Titre en grand — pas d'avatar ────────────────────────────────── */}
      <div className="text-center">
        {page.title && (
          <h1
            className={isPreview ? 'text-xl font-bold tracking-tight' : 'text-3xl font-bold tracking-tight'}
            style={page.titleColor ? { color: page.titleColor } : undefined}
          >
            {page.title}
          </h1>
        )}

        {/* Bio subtile */}
        {page.bio && (
          <p
            className={isPreview ? 'text-xs opacity-60 mt-1' : 'text-sm opacity-60 mt-2'}
            style={page.bioColor ? { color: page.bioColor, opacity: 1 } : undefined}
          >
            {page.bio}
          </p>
        )}
      </div>

      {/* ── Liens immédiats (pas d'espace supplémentaire) ────────────────── */}
      <BioLinksRenderer
        links={links}
        bioPageId={isPublic ? page.id : undefined}
        buttonVariantClass={buttonVariantClass}
        buttonShapeClass={buttonShapeClass}
        hoverClass={hoverClass}
        linkColor={page.linkColor}
        spacingClass={spacingClass}
        isPreview={isPreview}
      />

      {/* ── Formulaire de contact (si activé) ─────────────────────────────── */}
      {page.showContactForm && !isPreview && isPublic && (
        <ContactForm bioPageId={page.id} />
      )}
      {page.showContactForm && isPreview && (
        <div className="w-full rounded-lg border border-current/20 p-2 text-[10px] opacity-40 text-center">
          📧 Formulaire de contact
        </div>
      )}

      {/* ── Icônes sociales en bas (différence avec classic) ──────────────── */}
      <SocialIcons
        links={page.socialLinks}
        iconClassName={theme.socialIcon}
      />

      {/* ── Branding ──────────────────────────────────────────────────────── */}
      {!page.hideBranding && !isPreview && (
        <div className="pt-4 text-center">
          <a
            href="https://ogolong.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs opacity-40 hover:opacity-60 transition-opacity"
          >
            Créé avec ogolong
          </a>
        </div>
      )}
      {!page.hideBranding && isPreview && (
        <p className="text-[10px] opacity-30 pt-2 text-center">
          Créé avec ogolong
        </p>
      )}
    </div>
  )
}
