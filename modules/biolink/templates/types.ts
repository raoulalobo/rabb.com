/**
 * @file modules/biolink/templates/types.ts
 * @module biolink
 * @description Types TypeScript pour le système de templates Bio Link.
 *   Un BioTemplate est un preset de TOUS les paramètres visuels éditables
 *   d'une BioPage. L'utilisateur sélectionne un template → tout se pré-remplit
 *   → il peut modifier ensuite.
 *
 * @example
 *   const template: BioTemplate = {
 *     id: 'arctic-frost',
 *     name: 'Givre arctique',
 *     category: 'minimal',
 *     tags: ['blanc', 'froid', 'épuré'],
 *     theme: 'default',
 *     accentColor: '#94a3b8',
 *     titleColor: '#1e293b',
 *     bioColor: '#64748b',
 *     linkColor: null,
 *     fontFamily: 'inter',
 *     buttonShape: 'rounded-lg',
 *     buttonVariant: 'filled',
 *     avatarShape: 'circle',
 *     gradientFrom: null,
 *     gradientTo: null,
 *     linkSpacing: 'normal',
 *     hoverAnimation: 'scale',
 *   }
 */

import type {
  BioAvatarShape,
  BioButtonShape,
  BioButtonVariant,
  BioFontName,
  BioHeaderStyle,
  BioHoverAnimation,
  BioLinkSpacing,
  BioThemeName,
} from '@/modules/biolink/schemas/biolink.schema'

// ─── Catégories de templates ────────────────────────────────────────────────

/** Identifiants des 15 catégories de templates */
export const TEMPLATE_CATEGORY_IDS = [
  'minimal',
  'bold',
  'dark',
  'nature',
  'pastel',
  'gradient',
  'retro',
  'luxury',
  'creative',
  'tech',
  'gaming',
  'food',
  'music',
  'fashion',
  'sport',
] as const

/** Type union des identifiants de catégorie */
export type TemplateCategory = (typeof TEMPLATE_CATEGORY_IDS)[number]

// ─── Interface BioTemplate ──────────────────────────────────────────────────

/**
 * Preset visuel complet pour une BioPage.
 * Mappe exactement sur les champs éditables de BioPage — pas de nouveaux
 * paramètres, juste des combinaisons créatives des options existantes.
 *
 * Exclus du template (propriétés utilisateur) :
 * backgroundImageUrl, bannerUrl, faviconUrl, hideBranding,
 * showContactForm, socialLinks, customDomain.
 */
export interface BioTemplate {
  /** Identifiant unique en kebab-case (ex: "arctic-frost") */
  id: string
  /** Nom en français affiché dans la galerie (ex: "Givre arctique") */
  name: string
  /** Catégorie pour le filtre dans le TemplatePicker */
  category: TemplateCategory
  /** Mots-clés pour la recherche (ex: ["blanc", "froid", "épuré"]) */
  tags: string[]

  // ── Champs qui pré-remplissent les paramètres de BioPage ──────────────

  /** Thème de base parmi les 5 disponibles */
  theme: BioThemeName
  /** Couleur d'accent hexadécimale (#RRGGBB) */
  accentColor: string
  /** Couleur hex du titre (null = hérite du thème) */
  titleColor: string | null
  /** Couleur hex de la bio (null = hérite du thème) */
  bioColor: string | null
  /** Couleur hex du texte des liens (null = hérite du thème) */
  linkColor: string | null
  /** Police de caractères */
  fontFamily: BioFontName
  /** Forme des boutons */
  buttonShape: BioButtonShape
  /** Variante des boutons */
  buttonVariant: BioButtonVariant
  /** Forme de l'avatar */
  avatarShape: BioAvatarShape
  /** Hex couleur 1 du dégradé (null = pas de dégradé) */
  gradientFrom: string | null
  /** Hex couleur 2 du dégradé (null = pas de dégradé) */
  gradientTo: string | null
  /** Espacement entre les liens */
  linkSpacing: BioLinkSpacing
  /** Animation au survol des liens */
  hoverAnimation: BioHoverAnimation
  /** Style de mise en page (structure du header) */
  headerStyle: BioHeaderStyle
}
