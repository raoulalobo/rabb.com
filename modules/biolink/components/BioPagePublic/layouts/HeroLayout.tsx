/**
 * @file modules/biolink/components/BioPagePublic/layouts/HeroLayout.tsx
 * @module biolink
 * @description Layout "Hero" de la BioPage.
 *   Image/gradient en plein écran (~300px), avatar + nom + bio en overlay,
 *   liens en dessous sur fond contrasté. Idéal pour des pages visuelles impactantes.
 *
 *   Fond hero : backgroundImageUrl → gradient custom → accentColor uni.
 *   Texte hero : blanc par défaut (ou titleColor/bioColor si définis).
 *
 * @example
 *   <HeroLayout page={page} links={activeLinks} theme={theme} ... />
 */

'use client'

import { BioLinksRenderer } from '../BioLinksRenderer'
import { ContactForm } from '../ContactForm'
import { SocialIcons } from '../SocialIcons'

import type { LayoutProps } from './types'
import { isBioPagePublic } from './types'

// ─── Composant ────────────────────────────────────────────────────────────────

/**
 * Layout hero : grande section visuelle en haut avec overlay texte.
 * Structure : hero (image/gradient + avatar + titre + bio + social) → liens → contact → branding.
 *
 * Ordre de priorité du fond hero :
 * 1. backgroundImageUrl (image plein écran + overlay sombre)
 * 2. gradientFrom/To (dégradé custom + overlay léger)
 * 3. accentColor (couleur unie de secours)
 *
 * @returns Layout hero complet
 */
export function HeroLayout({
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
  const avatarSize = isPreview ? 'size-20' : 'size-28'
  // Hauteur du hero selon le mode
  const heroHeight = isPreview ? 'min-h-[180px]' : 'min-h-[300px]'

  // ── Détermination du fond hero ─────────────────────────────────────────────
  let heroStyle: React.CSSProperties = {}
  let hasOverlay = false

  if (page.backgroundImageUrl) {
    // Image de fond plein écran
    heroStyle = {
      backgroundImage: `url(${page.backgroundImageUrl})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
    }
    hasOverlay = true
  } else if (page.gradientFrom && page.gradientTo) {
    // Dégradé custom
    heroStyle = {
      background: `linear-gradient(to bottom right, ${page.gradientFrom}, ${page.gradientTo})`,
    }
    hasOverlay = true
  } else {
    // Fallback : couleur d'accent unie
    heroStyle = {
      backgroundColor: page.accentColor,
    }
  }

  return (
    <div className="space-y-0">
      {/* ── Section Hero ─────────────────────────────────────────────────── */}
      <div
        className={`relative ${heroHeight} overflow-hidden flex flex-col items-center justify-center text-center px-4 py-8`}
        style={heroStyle}
      >
        {/* Overlay sombre pour lisibilité du texte sur image/gradient */}
        {hasOverlay && (
          <div className="absolute inset-0 bg-black/40" />
        )}

        {/* Contenu du hero (au-dessus de l'overlay) */}
        <div className="relative z-10 flex flex-col items-center space-y-3">
          {/* Avatar */}
          {page.avatarUrl ? (
            <img
              src={page.avatarUrl}
              alt={page.title ?? 'Avatar'}
              className={`${avatarSize} object-cover ${avatarShapeClass} ring-4 ring-white/30`}
            />
          ) : isPreview ? (
            <div
              className={`${avatarSize} bg-white/20 backdrop-blur-sm flex items-center justify-center text-2xl font-bold text-white ${avatarShapeClass}`}
            >
              {(page.title || page.slug)?.[0]?.toUpperCase() ?? '?'}
            </div>
          ) : null}

          {/* Titre en blanc (ou couleur personnalisée) */}
          {page.title && (
            <h1
              className={isPreview ? 'text-lg font-bold text-white' : 'text-2xl font-bold text-white'}
              style={page.titleColor ? { color: page.titleColor } : undefined}
            >
              {page.title}
            </h1>
          )}

          {/* Bio */}
          {page.bio && (
            <p
              className={isPreview ? 'text-xs text-white/80 max-w-[250px]' : 'text-sm text-white/80 max-w-sm'}
              style={page.bioColor ? { color: page.bioColor, opacity: 1 } : undefined}
            >
              {page.bio}
            </p>
          )}

          {/* Icônes sociales dans le hero */}
          <SocialIcons
            links={page.socialLinks}
            iconClassName="text-white/70 hover:text-white"
          />
        </div>
      </div>

      {/* ── Zone des liens (sous le hero) ────────────────────────────────── */}
      <div className="bg-white/5 backdrop-blur-sm rounded-t-3xl -mt-6 relative z-10 p-6">
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

        {/* Formulaire de contact */}
        {page.showContactForm && !isPreview && isPublic && (
          <div className="mt-6">
            <ContactForm bioPageId={page.id} />
          </div>
        )}
        {page.showContactForm && isPreview && (
          <div className="mt-4 w-full rounded-lg border border-current/20 p-2 text-[10px] opacity-40 text-center">
            📧 Formulaire de contact
          </div>
        )}

        {/* Branding */}
        {!page.hideBranding && !isPreview && (
          <div className="pt-8 text-center">
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
          <p className="text-[10px] opacity-30 pt-4 text-center">
            Créé avec ogolong
          </p>
        )}
      </div>
    </div>
  )
}
