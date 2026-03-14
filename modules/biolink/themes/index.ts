/**
 * @file modules/biolink/themes/index.ts
 * @module biolink
 * @description Définitions des thèmes visuels et mappings de personnalisation pour la page Bio Link.
 *   Chaque thème est un ensemble de classes Tailwind appliquées sur les différentes
 *   parties de la page publique /u/[slug].
 *
 *   Contient également :
 *   - hexToRgb : conversion hex → composantes RGB (pour les CSS custom properties)
 *   - Mappings de classes Tailwind pour buttonShape, avatarShape, linkSpacing, hoverAnimation
 *   - getButtonVariantClasses : génère les classes selon la variante (filled/outline/shadow)
 *   - BIO_FONT_CONFIG : configuration des 8 polices Google Fonts
 *
 * @example
 *   import { BIOLINK_THEMES, hexToRgb, BIO_FONT_CONFIG } from '@/modules/biolink/themes'
 *
 *   const theme = BIOLINK_THEMES['dark']
 *   const rgb = hexToRgb('#6366f1')  // → '99, 102, 241'
 */

import type {
  BioAvatarShape,
  BioButtonShape,
  BioButtonVariant,
  BioFontName,
  BioHoverAnimation,
  BioLinkSpacing,
  BioThemeName,
} from '@/modules/biolink/schemas/biolink.schema'

// ─── Type d'un thème Bio Link ─────────────────────────────────────────────────

/**
 * Structure d'un thème visuel pour la BioPage.
 * Chaque propriété correspond aux classes Tailwind d'une zone de la page.
 */
export interface BioTheme {
  /** Nom affiché dans le sélecteur de thème (en français) */
  name: string
  /** Classes Tailwind du conteneur principal (fond + couleur de texte) */
  container: string
  /** Classes Tailwind des boutons de lien (fond, hover, bordure) */
  link: string
  /** Classes Tailwind de l'avatar (anneau, ombre) */
  avatar: string
  /** Classes Tailwind des icônes de réseaux sociaux (couleur, hover) */
  socialIcon: string
}

// ─── Définition des 5 thèmes ─────────────────────────────────────────────────

/**
 * Dictionnaire des thèmes disponibles pour la BioPage.
 * Clé = valeur stockée en DB (BioPage.theme), valeur = classes Tailwind.
 *
 * Thèmes disponibles :
 * - `default`  : fond blanc, texte sombre, liens gris — classique et neutre
 * - `dark`     : fond quasi-noir, texte blanc, liens sombres — mode nuit
 * - `gradient` : dégradé violet→rose, texte blanc, liens glassmorphism
 * - `minimal`  : fond pierre, texte sobre, liens sans fond (underline style)
 * - `neon`     : fond noir, texte vert fluo, liens néon brillants
 */
export const BIOLINK_THEMES: Record<BioThemeName, BioTheme> = {
  default: {
    name: 'Classique',
    container: 'bg-white text-gray-900',
    link: 'bg-gray-100 hover:bg-gray-200 border border-gray-200 text-gray-900',
    avatar: 'ring-2 ring-gray-200',
    socialIcon: 'text-gray-500 hover:text-gray-700',
  },
  dark: {
    name: 'Sombre',
    container: 'bg-gray-950 text-white',
    link: 'bg-gray-800 hover:bg-gray-700 border border-gray-700 text-white',
    avatar: 'ring-2 ring-gray-700',
    socialIcon: 'text-gray-400 hover:text-gray-200',
  },
  gradient: {
    name: 'Dégradé',
    container: 'bg-gradient-to-br from-purple-600 to-pink-500 text-white',
    link: 'bg-white/20 hover:bg-white/30 backdrop-blur-sm border border-white/20 text-white',
    avatar: 'ring-2 ring-white/50',
    socialIcon: 'text-white/70 hover:text-white',
  },
  minimal: {
    name: 'Minimaliste',
    container: 'bg-stone-50 text-stone-800',
    link: 'bg-transparent hover:bg-stone-100 border-b border-stone-300 rounded-none text-stone-800',
    avatar: 'ring-0',
    socialIcon: 'text-stone-400 hover:text-stone-600',
  },
  neon: {
    name: 'Néon',
    container: 'bg-black text-green-400',
    link: 'bg-transparent hover:bg-green-400/10 border border-green-400/50 shadow-[0_0_10px_rgba(74,222,128,0.2)] text-green-400',
    avatar: 'ring-2 ring-green-400 shadow-[0_0_15px_rgba(74,222,128,0.3)]',
    socialIcon: 'text-green-400/70 hover:text-green-400',
  },
} as const

/**
 * Récupère un thème par son nom. Retourne le thème "default" si le nom est inconnu.
 *
 * @param themeName - Clé du thème (ex: "dark", "gradient")
 * @returns L'objet BioTheme correspondant
 *
 * @example
 *   const theme = getTheme('neon')
 *   // → { name: 'Néon', container: 'bg-black text-green-400', ... }
 */
export function getTheme(themeName: string): BioTheme {
  return BIOLINK_THEMES[themeName as BioThemeName] ?? BIOLINK_THEMES.default
}

// ─── Utilitaire couleur ────────────────────────────────────────────────────────

/**
 * Convertit une couleur hexadécimale en composantes RGB séparées par des virgules.
 * Utilisé pour injecter des CSS custom properties (ex: --accent-rgb).
 *
 * @param hex - Couleur au format #RRGGBB
 * @returns Composantes RGB séparées par des virgules (ex: "99, 102, 241")
 *
 * @example
 *   hexToRgb('#6366f1')  // → '99, 102, 241'
 *   hexToRgb('#ff0000')  // → '255, 0, 0'
 */
export function hexToRgb(hex: string): string {
  const cleaned = hex.replace('#', '')
  const r = parseInt(cleaned.substring(0, 2), 16)
  const g = parseInt(cleaned.substring(2, 4), 16)
  const b = parseInt(cleaned.substring(4, 6), 16)
  return `${r}, ${g}, ${b}`
}

// ─── Mappings de classes Tailwind ──────────────────────────────────────────────

/**
 * Classes Tailwind pour chaque forme de bouton.
 * Appliquées sur BioLinkButton pour modifier le border-radius.
 */
export const BUTTON_SHAPE_CLASSES: Record<BioButtonShape, string> = {
  'rounded-lg': 'rounded-lg',
  'rounded-full': 'rounded-full',
  'rounded-none': 'rounded-none',
}

/**
 * Classes Tailwind pour chaque forme d'avatar.
 * Appliquées sur l'image avatar dans BioPageView.
 */
export const AVATAR_SHAPE_CLASSES: Record<BioAvatarShape, string> = {
  circle: 'rounded-full',
  'rounded-square': 'rounded-xl',
  square: 'rounded-none',
}

/**
 * Classes Tailwind pour l'espacement entre les liens.
 * Appliquées sur le conteneur des liens dans BioPageView.
 */
export const LINK_SPACING_CLASSES: Record<BioLinkSpacing, string> = {
  compact: 'space-y-2',
  normal: 'space-y-3',
  airy: 'space-y-4',
}

/**
 * Classes Tailwind pour l'animation au survol des liens.
 * Appliquées sur chaque BioLinkButton.
 */
export const HOVER_ANIMATION_CLASSES: Record<BioHoverAnimation, string> = {
  none: '',
  scale: 'hover:scale-105 transition-transform',
  glow: 'hover:shadow-[0_0_20px_rgba(var(--accent-rgb),0.4)] transition-shadow',
  slide: 'hover:translate-x-1 transition-transform',
}

/**
 * Génère les classes CSS d'un bouton selon sa variante (filled, outline, shadow).
 * - filled  : utilise les classes du thème directement
 * - outline : bordure accent, texte accent, fond transparent
 * - shadow  : fond léger accent, ombre accent
 *
 * @param variant   - Variante du bouton
 * @param themeLink - Classes du thème pour le lien (utilisé par filled)
 * @returns Classes Tailwind combinées
 *
 * @example
 *   getButtonVariantClasses('outline', theme.link)
 *   // → 'border-2 border-[var(--accent)] text-[var(--accent)] bg-transparent hover:bg-[var(--accent)]/10'
 */
export function getButtonVariantClasses(variant: string, themeLink: string): string {
  switch (variant as BioButtonVariant) {
    case 'outline':
      return 'border-2 border-[var(--accent)] text-[var(--accent)] bg-transparent hover:bg-[var(--accent)]/10'
    case 'shadow':
      return 'bg-[var(--accent)]/10 text-[var(--accent)] shadow-[0_4px_15px_rgba(var(--accent-rgb),0.3)] hover:shadow-[0_4px_20px_rgba(var(--accent-rgb),0.5)]'
    case 'filled':
    default:
      return themeLink
  }
}

// ─── Configuration des polices Google Fonts ────────────────────────────────────

/**
 * Configuration de chaque police disponible pour la BioPage.
 * - name     : nom affiché dans le sélecteur (avec casse d'affichage)
 * - family   : valeur CSS font-family
 * - googleUrl: URL Google Fonts à charger via <link> pour le rendu
 */
export const BIO_FONT_CONFIG: Record<BioFontName, { name: string; family: string; googleUrl: string }> = {
  inter: {
    name: 'Inter',
    family: 'Inter, sans-serif',
    googleUrl: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
  },
  poppins: {
    name: 'Poppins',
    family: 'Poppins, sans-serif',
    googleUrl: 'https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap',
  },
  playfair: {
    name: 'Playfair Display',
    family: 'Playfair Display, serif',
    googleUrl: 'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700&display=swap',
  },
  'space-grotesk': {
    name: 'Space Grotesk',
    family: 'Space Grotesk, sans-serif',
    googleUrl: 'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap',
  },
  'dm-sans': {
    name: 'DM Sans',
    family: 'DM Sans, sans-serif',
    googleUrl: 'https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap',
  },
  outfit: {
    name: 'Outfit',
    family: 'Outfit, sans-serif',
    googleUrl: 'https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&display=swap',
  },
  lora: {
    name: 'Lora',
    family: 'Lora, serif',
    googleUrl: 'https://fonts.googleapis.com/css2?family=Lora:wght@400;500;600;700&display=swap',
  },
  'bebas-neue': {
    name: 'Bebas Neue',
    family: 'Bebas Neue, sans-serif',
    googleUrl: 'https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap',
  },
}
