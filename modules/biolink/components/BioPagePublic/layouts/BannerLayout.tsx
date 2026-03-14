/**
 * @file modules/biolink/components/BioPagePublic/layouts/BannerLayout.tsx
 * @module biolink
 * @description Layout "Bannière" de la BioPage.
 *   Grande image en haut (16:9), carte flottante qui chevauche le bas de l'image
 *   avec avatar + nom + bio, liens sous la carte.
 *
 *   Fond de la bannière : backgroundImageUrl → bannerUrl → gradient custom → accent uni.
 *
 * @example
 *   <BannerLayout page={page} links={activeLinks} theme={theme} ... />
 */

'use client'

import { BioLinksRenderer } from '../BioLinksRenderer'
import { ContactForm } from '../ContactForm'
import { SocialIcons } from '../SocialIcons'

import type { LayoutProps } from './types'
import { isBioPagePublic } from './types'

// ─── Composant ────────────────────────────────────────────────────────────────

/**
 * Layout bannière : image large en haut + carte flottante chevauchante.
 * Structure : image 16:9 → carte flottante (avatar + titre + bio + social) → liens → contact → branding.
 *
 * La carte flottante a un effet glassmorphism (backdrop-blur, bg semi-transparent).
 * Fallback si pas d'image : dégradé accent simplifié.
 *
 * @returns Layout bannière complet
 */
export function BannerLayout({
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
  const avatarSize = isPreview ? 'size-14' : 'size-20'

  // ── Détermination de l'image de la bannière ────────────────────────────────
  const bannerImage = page.backgroundImageUrl ?? page.bannerUrl
  let bannerStyle: React.CSSProperties = {}

  if (bannerImage) {
    bannerStyle = {
      backgroundImage: `url(${bannerImage})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
    }
  } else if (page.gradientFrom && page.gradientTo) {
    bannerStyle = {
      background: `linear-gradient(to bottom right, ${page.gradientFrom}, ${page.gradientTo})`,
    }
  } else {
    // Fallback : couleur d'accent en fond avec un dégradé léger
    bannerStyle = {
      background: `linear-gradient(135deg, ${page.accentColor}, ${page.accentColor}cc)`,
    }
  }

  return (
    <div className="space-y-0">
      {/* ── Image bannière en haut (16:9) ────────────────────────────────── */}
      <div
        className={isPreview ? 'w-full rounded-b-xl' : 'w-full rounded-b-2xl'}
        style={{
          ...bannerStyle,
          aspectRatio: '16/9',
        }}
      />

      {/* ── Carte flottante chevauchante ─────────────────────────────────── */}
      <div
        className={`
          bg-white/90 dark:bg-gray-900/90 backdrop-blur rounded-2xl shadow-xl
          ${isPreview ? 'p-4 -mt-8 mx-2' : 'p-6 -mt-12 mx-4'}
          relative z-10
        `}
      >
        <div className="flex flex-col items-center text-center space-y-3">
          {/* Avatar */}
          {page.avatarUrl ? (
            <img
              src={page.avatarUrl}
              alt={page.title ?? 'Avatar'}
              className={`${avatarSize} object-cover ${avatarShapeClass} ${theme.avatar} -mt-10`}
            />
          ) : isPreview ? (
            <div
              className={`${avatarSize} bg-muted flex items-center justify-center text-xl font-bold ${avatarShapeClass} ${theme.avatar} -mt-10`}
            >
              {(page.title || page.slug)?.[0]?.toUpperCase() ?? '?'}
            </div>
          ) : null}

          {/* Titre */}
          {page.title && (
            <h1
              className={isPreview ? 'text-base font-bold' : 'text-xl font-bold'}
              style={page.titleColor ? { color: page.titleColor } : undefined}
            >
              {page.title}
            </h1>
          )}

          {/* Bio */}
          {page.bio && (
            <p
              className={isPreview ? 'text-xs opacity-80 max-w-[250px]' : 'text-sm opacity-80 max-w-sm'}
              style={page.bioColor ? { color: page.bioColor, opacity: 1 } : undefined}
            >
              {page.bio}
            </p>
          )}

          {/* Icônes sociales */}
          <SocialIcons
            links={page.socialLinks}
            iconClassName={theme.socialIcon}
          />
        </div>
      </div>

      {/* ── Liens sous la carte ──────────────────────────────────────────── */}
      <div className={isPreview ? 'px-2 pt-4' : 'px-4 pt-6'}>
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
