/**
 * @file modules/biolink/components/BioPagePublic/layouts/ClassicLayout.tsx
 * @module biolink
 * @description Layout "Classique" de la BioPage.
 *   Structure historique : bannière → avatar → titre → bio → icônes sociales → liens → contact → branding.
 *   C'est le layout par défaut quand aucun headerStyle n'est défini.
 *
 * @example
 *   <ClassicLayout page={page} links={activeLinks} theme={theme} ... />
 */

'use client'

import { BannerImage } from '../BannerImage'
import { BioLinksRenderer } from '../BioLinksRenderer'
import { ContactForm } from '../ContactForm'
import { SocialIcons } from '../SocialIcons'

import type { LayoutProps } from './types'
import { isBioPagePublic } from './types'

// ─── Composant ────────────────────────────────────────────────────────────────

/**
 * Layout classique de la BioPage : structure linéaire verticale.
 * Bannière (optionnel) → avatar → titre → bio → icônes sociales → liens → contact → branding.
 *
 * @param page               - Données de la page
 * @param links              - Liens actifs triés
 * @param theme              - Configuration du thème
 * @param avatarShapeClass   - Forme de l'avatar
 * @param spacingClass       - Espacement des liens
 * @param buttonShapeClass   - Forme des boutons
 * @param hoverClass         - Animation hover
 * @param buttonVariantClass - Variante des boutons
 * @param isPreview          - Mode aperçu miniature
 * @returns Layout classique complet
 */
export function ClassicLayout({
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
  // Taille de l'avatar selon le mode (preview vs public)
  const avatarSize = isPreview ? 'size-16' : 'size-20'

  return (
    <div className="space-y-6">
      {/* ── Bannière (si définie) ─────────────────────────────────────────── */}
      {page.bannerUrl && !isPreview && (
        <BannerImage url={page.bannerUrl} alt={`Bannière de ${page.title ?? page.slug}`} />
      )}
      {page.bannerUrl && isPreview && (
        <img
          src={page.bannerUrl}
          alt="Bannière"
          className="w-full rounded-lg object-cover"
          style={{ aspectRatio: '16/5' }}
        />
      )}

      {/* ── Profil : avatar + titre + bio ──────────────────────────────────── */}
      <div className="flex flex-col items-center text-center space-y-3">
        {/* Avatar avec forme personnalisée */}
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

        {/* Titre (nom de l'utilisateur) — couleur personnalisée si définie */}
        {page.title && (
          <h1
            className={isPreview ? 'text-base font-bold' : 'text-xl font-bold'}
            style={page.titleColor ? { color: page.titleColor } : undefined}
          >
            {page.title}
          </h1>
        )}

        {/* Bio (description courte) — couleur personnalisée si définie */}
        {page.bio && (
          <p
            className={isPreview ? 'text-xs opacity-80 max-w-[250px]' : 'text-sm opacity-80 max-w-sm'}
            style={page.bioColor ? { color: page.bioColor, opacity: 1 } : undefined}
          >
            {page.bio}
          </p>
        )}
      </div>

      {/* ── Icônes de réseaux sociaux ──────────────────────────────────────── */}
      <SocialIcons
        links={page.socialLinks}
        iconClassName={theme.socialIcon}
      />

      {/* ── Liens (boutons, headers, séparateurs, embeds) ──────────────────── */}
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

      {/* ── Footer branding (conditionnel) ────────────────────────────────── */}
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
  )
}
