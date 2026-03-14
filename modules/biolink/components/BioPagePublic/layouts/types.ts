/**
 * @file modules/biolink/components/BioPagePublic/layouts/types.ts
 * @module biolink
 * @description Types partagés entre tous les composants de layout Bio Link.
 *   L'interface LayoutProps est le contrat commun pour ClassicLayout, HeroLayout,
 *   BannerLayout, MinimalLayout et CardLayout.
 */

import type { BioTheme } from '@/modules/biolink/themes'
import type { BioLink, BioPagePublic, BioSocialLink } from '@/modules/biolink/types'

import type { LivePreviewDraft } from '../../BioPageEditor/LivePreview'

// ─── Props communes à tous les layouts ────────────────────────────────────────

/**
 * Props partagées par tous les composants de layout.
 * Contiennent les données de la page, les classes CSS de personnalisation,
 * et un flag isPreview pour adapter le rendu (taille, tracking).
 */
export interface LayoutProps {
  /** Données de la page — BioPagePublic en public, LivePreviewDraft en éditeur */
  page: BioPagePublic | LivePreviewDraft
  /** Liens actifs filtrés, triés par position */
  links: BioLink[]
  /** Configuration du thème (classes Tailwind pour container, link, avatar, etc.) */
  theme: BioTheme
  /** Classes Tailwind de la forme d'avatar (rounded-full, rounded-xl, rounded-none) */
  avatarShapeClass: string
  /** Classes Tailwind d'espacement entre les liens (space-y-2/3/4) */
  spacingClass: string
  /** Classes Tailwind de la forme de bouton (rounded-lg/full/none) */
  buttonShapeClass: string
  /** Classes Tailwind de l'animation au survol */
  hoverClass: string
  /** Classes Tailwind de la variante de bouton (filled/outline/shadow) */
  buttonVariantClass: string
  /** Mode aperçu miniature (LivePreview) — tailles réduites, pas de tracking */
  isPreview?: boolean
}

/**
 * Type guard pour vérifier si la page est une BioPagePublic (avec `id`).
 * Utilisé pour savoir si le tracking des clics est disponible.
 *
 * @param page - Page ou brouillon
 * @returns true si la page a un id (page publique)
 */
export function isBioPagePublic(page: BioPagePublic | LivePreviewDraft): page is BioPagePublic {
  return 'id' in page && typeof (page as BioPagePublic).id === 'string'
}
