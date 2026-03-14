/**
 * @file modules/biolink/components/BioPagePublic/layouts/CardLayout.tsx
 * @module biolink
 * @description Layout "Carte" de la BioPage.
 *   Le fond (gradient/image/thème) est sur le conteneur parent.
 *   Tout le contenu est dans une carte centrée avec glassmorphism
 *   (bg-white/80, backdrop-blur-lg, rounded-3xl, shadow-2xl).
 *
 * @example
 *   <CardLayout page={page} links={activeLinks} theme={theme} ... />
 */

'use client'

import { BioLinksRenderer } from '../BioLinksRenderer'
import { ContactForm } from '../ContactForm'
import { SocialIcons } from '../SocialIcons'

import type { LayoutProps } from './types'
import { isBioPagePublic } from './types'

// ─── Composant ────────────────────────────────────────────────────────────────

/**
 * Layout carte : tout le contenu dans une carte glassmorphism centrée.
 * Le fond est géré par le conteneur parent (BioPageView).
 * La carte contient : avatar, titre, bio, social, liens, contact, branding.
 *
 * @returns Layout carte complet
 */
export function CardLayout({
  page,
  links,
  theme,
  avatarShapeClass,
  spacingClass,
  buttonShapeClass,
  hoverClass,
  buttonVariantClass,
  isPreview = false,
}: LayoutProps): React.JSX.Element {
  const isPublic = isBioPagePublic(page)
  // Taille de l'avatar selon le mode
  const avatarSize = isPreview ? 'size-16' : 'size-20'

  return (
    <div
      className={`
        bg-white/80 dark:bg-gray-900/80 backdrop-blur-lg shadow-2xl
        ${isPreview ? 'rounded-2xl p-5' : 'rounded-3xl p-8'}
      `}
    >
      <div className="flex flex-col items-center text-center space-y-4">
        {/* ── Avatar ──────────────────────────────────────────────────────── */}
        {page.avatarUrl ? (
          <img
            src={page.avatarUrl}
            alt={page.title ?? 'Avatar'}
            className={`${avatarSize} object-cover ${avatarShapeClass} ${theme.avatar}`}
          />
        ) : isPreview ? (
          <div
            className={`${avatarSize} bg-muted flex items-center justify-center text-xl font-bold ${avatarShapeClass} ${theme.avatar}`}
          >
            {(page.title || page.slug)?.[0]?.toUpperCase() ?? '?'}
          </div>
        ) : null}

        {/* ── Titre ───────────────────────────────────────────────────────── */}
        {page.title && (
          <h1
            className={isPreview ? 'text-base font-bold' : 'text-xl font-bold'}
            style={page.titleColor ? { color: page.titleColor } : undefined}
          >
            {page.title}
          </h1>
        )}

        {/* ── Bio ─────────────────────────────────────────────────────────── */}
        {page.bio && (
          <p
            className={isPreview ? 'text-xs opacity-80 max-w-[250px]' : 'text-sm opacity-80 max-w-sm'}
            style={page.bioColor ? { color: page.bioColor, opacity: 1 } : undefined}
          >
            {page.bio}
          </p>
        )}

        {/* ── Icônes sociales ─────────────────────────────────────────────── */}
        <SocialIcons
          links={page.socialLinks}
          iconClassName={theme.socialIcon}
        />

        {/* ── Liens ───────────────────────────────────────────────────────── */}
        <div className="w-full">
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
        </div>

        {/* ── Formulaire de contact ───────────────────────────────────────── */}
        {page.showContactForm && !isPreview && isPublic && (
          <div className="w-full">
            <ContactForm bioPageId={page.id} />
          </div>
        )}
        {page.showContactForm && isPreview && (
          <div className="w-full rounded-lg border border-current/20 p-2 text-[10px] opacity-40 text-center">
            📧 Formulaire de contact
          </div>
        )}

        {/* ── Branding ────────────────────────────────────────────────────── */}
        {!page.hideBranding && !isPreview && (
          <div className="pt-4">
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
          <p className="text-[10px] opacity-30 pt-2">
            Créé avec ogolong
          </p>
        )}
      </div>
    </div>
  )
}
