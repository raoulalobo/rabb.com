/**
 * @file modules/biolink/types.ts
 * @module biolink
 * @description Types du module Link in Bio — page publique `/u/[slug]`.
 *
 *   Ces types décrivent la donnée **rendue** par `<BioPageRenderer />`.
 *   Ils seront alimentés :
 *   - MVP actuel : par `modules/biolink/mock-data.ts` (placeholder statique)
 *   - Future v2  : par Prisma (`BioPage` + `BioLink[]` depuis DB) — le schéma
 *     est déjà documenté dans `prisma/schema.prisma` lignes 234-387, supprimé
 *     le 2026-03-19 et à restaurer via migration lors du build de l'éditeur.
 *
 *   La séparation types ↔ source de données permet de brancher le CRUD
 *   Prisma plus tard sans toucher au composant de rendu.
 */

/**
 * Kind d'un lien dans la liste. Contrôle le style visuel :
 * - `primary` : carte amber en haut de la liste, CTA fort (1 seul attendu).
 * - `glass`   : row avec fond blanc semi-transparent + backdrop-blur.
 */
export type BioLinkKind = 'primary' | 'glass'

/**
 * Un lien cliquable dans la page (livre, boutique, ressource, etc.).
 *
 * @example
 *   { label: 'Mon livre Amazon', eyebrow: 'Nouveau', kind: 'primary', href: 'https://amzn.to/...' }
 */
export interface BioLinkItem {
  /** Texte principal du bouton (ex: "Ma boutique Shopify") */
  label: string
  /** Petit texte au-dessus du label (ex: "Nouveau", "Recommandé") — optionnel */
  eyebrow?: string
  /** URL de destination (externe — ouvert dans un nouvel onglet) */
  href: string
  /** Style de la carte : primary (amber) ou glass (transparent) */
  kind: BioLinkKind
}

/**
 * Plateforme supportée pour les icônes sociales.
 * Mappé vers Lucide React dans `<SocialGlyph />` :
 * - `ig`   → Instagram
 * - `tt`   → Music (Lucide n'a pas TikTok en MVP — voir SocialGlyph.tsx)
 * - `yt`   → Youtube
 * - `mail` → Mail
 * - `fb`   → Facebook
 */
export type BioSocialKind = 'ig' | 'tt' | 'yt' | 'mail' | 'fb'

/**
 * Entrée pour un lien social dans la rangée d'icônes.
 *
 * @example
 *   { kind: 'ig', href: 'https://instagram.com/user', label: 'Instagram' }
 */
export interface BioSocial {
  /** Plateforme — détermine l'icône Lucide rendue */
  kind: BioSocialKind
  /** URL du profil (ou `mailto:...` pour kind='mail') */
  href: string
  /** Label accessibilité (fallback au nom de la plateforme si absent) */
  label?: string
}

/**
 * Thème de couleurs customisées — dérivé de la DB (BioPage.accentColor, etc.).
 * Toutes les propriétés sont optionnelles : `null`/`undefined` → fallback au défaut du template.
 */
export interface BioTheme {
  /** Couleur d'accent (CTA amber) — défaut template : `#E8B87A` / `#D4A574` */
  accentColor?: string
  /** Couleur du titre principal — défaut : `#F6F2EC` (mobile) / `#fff` (desktop) */
  titleColor?: string
  /** Couleur de la bio courte — défaut : titleColor avec opacity 0.8 */
  bioColor?: string
  /** Couleur des liens glass — défaut : titleColor */
  linkColor?: string
}

/**
 * Données complètes d'une BioPage, forme rendue par `<BioPageRenderer />`.
 * Objet plat, immutable, sérialisable (pas de Date ni de fonctions).
 *
 * Les champs optionnels (`?`) sont ceux qui peuvent être absents de la DB —
 * le mapper gère les fallbacks raisonnables. Les champs requis doivent
 * toujours avoir une valeur (le mapper lève notFound() sinon).
 */
export interface BioPageData {
  /** Slug URL — ex: "mimisara" pour /u/mimisara (UNIQUE en DB) */
  slug: string
  /**
   * Nom affiché — forme brute avec éventuellement un `\n` pour séparer
   * la ligne italique (typographie Fraunces).
   * Ex: "Mimi\nSara" → rendu "Mimi" ligne 1 normal + "Sara" ligne 2 italique.
   * Ex: "La boutique d'Osy" (sans \n) → rendu sur 1 ligne sans italique.
   */
  name: string
  /**
   * Nom découpé pour la stylisation typographique. Dérivé de `name.split('\n', 2)`.
   * - 1 élément : affichage simple, pas d'italique
   * - 2 éléments : ligne 1 normal, ligne 2 italique
   */
  nameSplit: [string, string?]
  /** Handle avec @ — ex: "@mimimaze". Si DB null, mapper le dérive en `@{slug}`. */
  handle: string
  /** Baseline courte — ex: "Auteure · Entrepreneure · Camerounaise". Optionnelle. */
  bio?: string
  /** Phrase d'intro du panneau frosted desktop — masquée si absente. */
  tagline?: string
  /** URL de l'image avatar. Si DB null, mapper utilise une image par défaut. */
  avatarUrl: string
  /** Statut à droite du handle — ex: "En ligne" (affiché en accentColor) */
  status?: string
  /** Thème de couleurs personnalisées (fallback template si absentes) */
  theme?: BioTheme
  /** Liens sociaux en bas de page (mobile) ou header panneau (desktop) */
  socials: BioSocial[]
  /** Liens principaux (1 primary maximum + N glass) */
  links: BioLinkItem[]
  /** Mention légale footer desktop — dérivé par le mapper : `© {année} {name}` */
  footerBrand?: string
  /** URL footer desktop — dérivé : `customDomain` ou `socialtdl.net/u/{slug}` */
  footerWebsite?: string
}
