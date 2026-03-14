/**
 * @file modules/biolink/components/BioPageEditor/LivePreview.tsx
 * @module biolink
 * @description Aperçu temps réel de la BioPage dans l'éditeur.
 *   Affiche une simulation de la page publique dans un cadre mobile
 *   qui se met à jour instantanément quand l'utilisateur modifie le profil,
 *   le thème, les liens, les réseaux sociaux, le layout ou les personnalisations.
 *
 *   Délègue le rendu du contenu au LayoutRouter (même composants que la page publique)
 *   avec le flag `isPreview=true` pour adapter les tailles et désactiver le tracking.
 *
 * @example
 *   <LivePreview draft={draftPage} />
 */

'use client'

import {
  AVATAR_SHAPE_CLASSES,
  BIO_FONT_CONFIG,
  BUTTON_SHAPE_CLASSES,
  HOVER_ANIMATION_CLASSES,
  LINK_SPACING_CLASSES,
  getButtonVariantClasses,
  getTheme,
  hexToRgb,
} from '@/modules/biolink/themes'
import type { BioLink, BioSocialLink } from '@/modules/biolink/types'

import type {
  BioAvatarShape,
  BioButtonShape,
  BioFontName,
  BioHoverAnimation,
  BioLinkSpacing,
} from '@/modules/biolink/schemas/biolink.schema'

import { LayoutRouter } from '../BioPagePublic/layouts/LayoutRouter'

// ─── Props ────────────────────────────────────────────────────────────────────

/**
 * Objet brouillon passé au LivePreview.
 * Contient tous les champs éditables de la BioPage pour un rendu fidèle.
 */
export interface LivePreviewDraft {
  slug: string
  title: string
  bio: string
  avatarUrl?: string | null
  theme: string
  accentColor: string
  titleColor: string | null
  bioColor: string | null
  linkColor: string | null
  fontFamily: string
  buttonShape: string
  buttonVariant: string
  avatarShape: string
  backgroundImageUrl: string | null
  gradientFrom: string | null
  gradientTo: string | null
  linkSpacing: string
  hoverAnimation: string
  /** Style de mise en page : classic, hero, banner, minimal, card */
  headerStyle: string
  bannerUrl: string | null
  hideBranding: boolean
  showContactForm: boolean
  links: BioLink[]
  socialLinks: BioSocialLink[]
}

interface LivePreviewProps {
  /** Objet brouillon contenant tous les champs éditables */
  draft: LivePreviewDraft
}

// ─── Composant ────────────────────────────────────────────────────────────────

/**
 * Aperçu live de la BioPage dans un cadre simulant un écran mobile.
 * Se met à jour instantanément (pas de fetch — données passées via l'objet draft).
 * Délègue le rendu du contenu au LayoutRouter avec `isPreview=true`.
 *
 * @param draft - Objet brouillon avec tous les champs éditables
 * @returns Cadre mobile avec le rendu complet de la page bio
 */
export function LivePreview({ draft }: LivePreviewProps): React.JSX.Element {
  const themeConfig = getTheme(draft.theme)

  // Configuration de la police
  const fontConfig = BIO_FONT_CONFIG[draft.fontFamily as BioFontName] ?? BIO_FONT_CONFIG.inter

  // Classes de personnalisation
  const avatarShapeClass = AVATAR_SHAPE_CLASSES[draft.avatarShape as BioAvatarShape] ?? AVATAR_SHAPE_CLASSES.circle
  const spacingClass = LINK_SPACING_CLASSES[draft.linkSpacing as BioLinkSpacing] ?? LINK_SPACING_CLASSES.normal
  const buttonShapeClass = BUTTON_SHAPE_CLASSES[draft.buttonShape as BioButtonShape] ?? BUTTON_SHAPE_CLASSES['rounded-lg']
  const hoverClass = HOVER_ANIMATION_CLASSES[draft.hoverAnimation as BioHoverAnimation] ?? ''
  const buttonVariantClass = getButtonVariantClasses(draft.buttonVariant, themeConfig.link)

  // Filtrer les liens actifs pour le preview
  const activeLinks = draft.links.filter((l) => l.isActive)

  // ── Fond dynamique ─────────────────────────────────────────────────────────
  let backgroundStyle: React.CSSProperties = {}
  let containerClasses = themeConfig.container

  if (draft.gradientFrom && draft.gradientTo) {
    backgroundStyle = {
      background: `linear-gradient(to bottom right, ${draft.gradientFrom}, ${draft.gradientTo})`,
    }
    containerClasses = containerClasses.replace(/bg-\S+/g, '').trim()
  } else if (draft.backgroundImageUrl) {
    backgroundStyle = {
      backgroundImage: `url(${draft.backgroundImageUrl})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
    }
    containerClasses = containerClasses.replace(/bg-\S+/g, '').trim()
  }

  return (
    <div className="flex flex-col items-center gap-3">
      {/* ── Label ────────────────────────────────────────────────────── */}
      <h3 className="text-sm font-semibold text-foreground">Aperçu</h3>

      {/* ── Chargement de la police ────────────────────────────────── */}
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link rel="stylesheet" href={fontConfig.googleUrl} />

      {/* ── Cadre mobile ─────────────────────────────────────────────── */}
      <div className="w-[320px] rounded-2xl border-2 border-border shadow-lg overflow-hidden">
        {/* Barre de statut simulée */}
        <div className="h-6 bg-muted flex items-center justify-center">
          <div className="h-1.5 w-12 rounded-full bg-border" />
        </div>

        {/* Contenu de la page bio avec CSS custom properties */}
        <div
          className={`min-h-[480px] p-6 ${containerClasses}`}
          style={{
            '--accent': draft.accentColor,
            '--accent-rgb': hexToRgb(draft.accentColor),
            fontFamily: fontConfig.family,
            ...backgroundStyle,
          } as React.CSSProperties}
        >
          {/* ── Rendu via LayoutRouter (isPreview=true) ──────────── */}
          <LayoutRouter
            headerStyle={draft.headerStyle ?? 'classic'}
            page={draft}
            links={activeLinks}
            theme={themeConfig}
            avatarShapeClass={avatarShapeClass}
            spacingClass={spacingClass}
            buttonShapeClass={buttonShapeClass}
            hoverClass={hoverClass}
            buttonVariantClass={buttonVariantClass}
            isPreview={true}
          />
        </div>
      </div>

      {/* ── URL sous le cadre ────────────────────────────────────────── */}
      {draft.slug && (
        <p className="text-xs text-muted-foreground">
          ogolong.com/u/{draft.slug}
        </p>
      )}
    </div>
  )
}
