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
 * Données complètes d'une BioPage, forme rendue par `<BioPageRenderer />`.
 * Objet plat, immutable, sérialisable (pas de Date ni de fonctions).
 */
export interface BioPageData {
  /** Slug URL — ex: "mimisara" pour /u/mimisara */
  slug: string
  /** Nom affiché complet (fallback accessibilité) — ex: "Mimi Sara" */
  name: string
  /**
   * Nom découpé en 2 lignes pour la stylisation typographique.
   * Ligne 1 en normal, ligne 2 en italique (Fraunces).
   * Ex: ["Mimi", "Sara"] — rendu sur 2 lignes avec la 2ᵉ en italique.
   */
  nameSplit: [string, string]
  /** Handle avec @ — ex: "@mimisara" (affiché en haut) */
  handle: string
  /** Baseline courte — ex: "Auteure · Entrepreneure · Camerounaise" */
  bio: string
  /** Phrase d'intro dans le panneau frosted desktop (1-2 phrases max) */
  tagline: string
  /**
   * URL de l'image avatar (full-bleed en fond).
   * Chemin relatif (servi par Next.js depuis /public) ou URL absolue Supabase.
   */
  avatarUrl: string
  /** Statut optionnel à côté du handle — ex: "En ligne" (affiché en amber) */
  status?: string
  /** Liens sociaux affichés en ligne (mobile : bas, desktop : header panneau) */
  socials: BioSocial[]
  /** Liens principaux (1 primary + N glass) */
  links: BioLinkItem[]
  /** Mention légale footer desktop — ex: "© 2026 Mimi Sara" */
  footerBrand?: string
  /** Nom de domaine footer desktop — ex: "mimisara.com" */
  footerWebsite?: string
}
