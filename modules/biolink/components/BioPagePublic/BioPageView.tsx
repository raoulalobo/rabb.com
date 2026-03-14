/**
 * @file modules/biolink/components/BioPagePublic/BioPageView.tsx
 * @module biolink
 * @description Composant de rendu de la page publique Bio Link (/u/[slug]).
 *   Gère le conteneur principal (fond, police, CSS custom properties) et délègue
 *   le contenu interne au LayoutRouter qui sélectionne le layout approprié
 *   selon le champ headerStyle (classic, hero, banner, minimal, card).
 *
 *   Personnalisation avancée :
 *   - CSS custom properties --accent et --accent-rgb pour la couleur d'accent
 *   - Police Google Fonts chargée dynamiquement via <link>
 *   - Fond : dégradé custom → image de fond → thème (ordre de priorité)
 *
 *   Ce composant est un Client Component car il contient des interactions
 *   (clic sur les liens avec tracking, formulaire de contact).
 *
 * @example
 *   <BioPageView page={bioPage} />
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
import type { BioPagePublic } from '@/modules/biolink/types'

import type {
  BioAvatarShape,
  BioButtonShape,
  BioFontName,
  BioHoverAnimation,
  BioLinkSpacing,
} from '@/modules/biolink/schemas/biolink.schema'

import { LayoutRouter } from './layouts/LayoutRouter'

// ─── Props ────────────────────────────────────────────────────────────────────

interface BioPageViewProps {
  /** Données publiques de la BioPage (sans champs sensibles) */
  page: BioPagePublic
}

// ─── Composant ────────────────────────────────────────────────────────────────

/**
 * Vue publique complète de la page Bio Link.
 * Le conteneur gère le fond (gradient/image/thème), la police et les CSS custom properties.
 * Le contenu interne est délégué au LayoutRouter selon page.headerStyle.
 *
 * @param page - Données publiques de la BioPage
 * @returns Page complète stylisée selon le thème et le layout choisi
 */
export function BioPageView({ page }: BioPageViewProps): React.JSX.Element {
  // Récupérer les classes Tailwind du thème choisi
  const theme = getTheme(page.theme)

  // Configuration de la police
  const fontConfig = BIO_FONT_CONFIG[page.fontFamily as BioFontName] ?? BIO_FONT_CONFIG.inter

  // Classes de personnalisation
  const avatarShapeClass = AVATAR_SHAPE_CLASSES[page.avatarShape as BioAvatarShape] ?? AVATAR_SHAPE_CLASSES.circle
  const spacingClass = LINK_SPACING_CLASSES[page.linkSpacing as BioLinkSpacing] ?? LINK_SPACING_CLASSES.normal
  const buttonShapeClass = BUTTON_SHAPE_CLASSES[page.buttonShape as BioButtonShape] ?? BUTTON_SHAPE_CLASSES['rounded-lg']
  const hoverClass = HOVER_ANIMATION_CLASSES[page.hoverAnimation as BioHoverAnimation] ?? ''
  const buttonVariantClass = getButtonVariantClasses(page.buttonVariant, theme.link)

  // ── Détermination du fond ───────────────────────────────────────────────────
  // Priorité : dégradé custom → image de fond → thème
  let backgroundStyle: React.CSSProperties = {}
  let containerClasses = theme.container

  if (page.gradientFrom && page.gradientTo) {
    // Dégradé custom : remplace le fond du thème
    backgroundStyle = {
      background: `linear-gradient(to bottom right, ${page.gradientFrom}, ${page.gradientTo})`,
    }
    // Garder uniquement la couleur de texte du thème, pas le fond
    containerClasses = containerClasses.replace(/bg-\S+/g, '').trim()
  } else if (page.backgroundImageUrl) {
    // Image de fond : couvre tout l'écran
    backgroundStyle = {
      backgroundImage: `url(${page.backgroundImageUrl})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
    }
    containerClasses = containerClasses.replace(/bg-\S+/g, '').trim()
  }

  // Filtrer les liens actifs
  const activeLinks = page.links.filter((link) => link.isActive)

  return (
    <>
      {/* ── Chargement de la police Google Fonts ──────────────────────── */}
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link rel="stylesheet" href={fontConfig.googleUrl} />

      {/* ── Conteneur principal avec CSS custom properties ─────────────── */}
      <div
        className={`flex min-h-screen items-start justify-center px-4 py-12 ${containerClasses}`}
        style={{
          '--accent': page.accentColor,
          '--accent-rgb': hexToRgb(page.accentColor),
          fontFamily: fontConfig.family,
          ...backgroundStyle,
        } as React.CSSProperties}
      >
        {/* Contenu centré, largeur max 448px (mobile-first) */}
        <div className="w-full max-w-md">
          <LayoutRouter
            headerStyle={page.headerStyle ?? 'classic'}
            page={page}
            links={activeLinks}
            theme={theme}
            avatarShapeClass={avatarShapeClass}
            spacingClass={spacingClass}
            buttonShapeClass={buttonShapeClass}
            hoverClass={hoverClass}
            buttonVariantClass={buttonVariantClass}
            isPreview={false}
          />
        </div>
      </div>
    </>
  )
}
