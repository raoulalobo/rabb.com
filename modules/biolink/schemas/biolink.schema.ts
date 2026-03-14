/**
 * @file modules/biolink/schemas/biolink.schema.ts
 * @module biolink
 * @description Schémas Zod de validation pour le module Bio Link.
 *   Utilisés côté client (feedback immédiat dans l'éditeur) et côté serveur (Server Actions).
 *
 *   Pattern "Schema-First" : les schémas sont définis avant les composants/actions.
 *   Les types TypeScript sont inférés depuis Zod (source de vérité unique).
 *
 * @example
 *   // Validation dans une Server Action
 *   const validated = BioPageUpsertSchema.parse(rawData)
 *
 *   // Validation d'un lien
 *   const link = BioLinkUpsertSchema.parse({ title: 'Ma vidéo', url: 'https://...' })
 */

import { z } from 'zod'

// ─── Constantes enum ─────────────────────────────────────────────────────────

/** Thèmes visuels disponibles pour la BioPage */
export const BIO_THEMES = ['default', 'dark', 'gradient', 'minimal', 'neon'] as const
export type BioThemeName = (typeof BIO_THEMES)[number]

/** Polices de caractères disponibles */
export const BIO_FONTS = ['inter', 'poppins', 'playfair', 'space-grotesk', 'dm-sans', 'outfit', 'lora', 'bebas-neue'] as const
export type BioFontName = (typeof BIO_FONTS)[number]

/** Formes de bouton */
export const BIO_BUTTON_SHAPES = ['rounded-lg', 'rounded-full', 'rounded-none'] as const
export type BioButtonShape = (typeof BIO_BUTTON_SHAPES)[number]

/** Variantes de bouton */
export const BIO_BUTTON_VARIANTS = ['filled', 'outline', 'shadow'] as const
export type BioButtonVariant = (typeof BIO_BUTTON_VARIANTS)[number]

/** Formes d'avatar */
export const BIO_AVATAR_SHAPES = ['circle', 'rounded-square', 'square'] as const
export type BioAvatarShape = (typeof BIO_AVATAR_SHAPES)[number]

/** Espacements entre les liens */
export const BIO_LINK_SPACINGS = ['compact', 'normal', 'airy'] as const
export type BioLinkSpacing = (typeof BIO_LINK_SPACINGS)[number]

/** Animations au survol */
export const BIO_HOVER_ANIMATIONS = ['none', 'scale', 'glow', 'slide'] as const
export type BioHoverAnimation = (typeof BIO_HOVER_ANIMATIONS)[number]

/** Styles de mise en page (header/layout) */
export const BIO_HEADER_STYLES = ['classic', 'hero', 'banner', 'minimal', 'card'] as const
export type BioHeaderStyle = (typeof BIO_HEADER_STYLES)[number]

/** Types de lien */
export const BIO_LINK_TYPES = ['link', 'header', 'separator', 'video', 'music'] as const
export type BioLinkTypeName = (typeof BIO_LINK_TYPES)[number]

// ─── Sous-schémas ─────────────────────────────────────────────────────────────

/**
 * Schéma d'un lien social (icône en bas de la page bio).
 * Stocké en JSON dans BioPage.socialLinks.
 *
 * @field platform - Identifiant de la plateforme ("instagram", "tiktok", etc.)
 * @field url      - URL complète vers le profil
 */
export const BioSocialLinkSchema = z.object({
  platform: z.string().min(1, 'La plateforme est requise'),
  url: z.string().url('URL invalide').or(z.literal('')),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Couleur hex invalide').optional().nullable(),
})

// ─── Schéma BioPage ───────────────────────────────────────────────────────────

/**
 * Schéma pour créer ou mettre à jour une BioPage.
 *
 * @field slug             - Partie de l'URL publique (3–30 chars, minuscules + chiffres + tirets)
 * @field title            - Nom affiché en haut de la page (optionnel, max 100 chars)
 * @field bio              - Description courte (optionnel, max 300 chars)
 * @field avatarUrl        - URL de l'avatar personnalisé (optionnel)
 * @field theme            - Thème visuel parmi les 5 disponibles
 * @field accentColor      - Couleur d'accent en hexadécimal (#RRGGBB)
 * @field fontFamily       - Police de caractères parmi les 8 disponibles
 * @field buttonShape      - Forme des boutons (arrondi, pill, carré)
 * @field buttonVariant    - Variante des boutons (rempli, contour, ombre)
 * @field avatarShape      - Forme de l'avatar (cercle, carré arrondi, carré)
 * @field backgroundImageUrl - URL d'image de fond (optionnel)
 * @field gradientFrom     - Couleur 1 du dégradé custom (optionnel)
 * @field gradientTo       - Couleur 2 du dégradé custom (optionnel)
 * @field linkSpacing      - Espacement entre les liens
 * @field hoverAnimation   - Animation au survol des liens
 * @field bannerUrl        - URL de la bannière (optionnel)
 * @field hideBranding     - Masquer le branding ogolong
 * @field faviconUrl       - Favicon personnalisé (optionnel)
 * @field showContactForm  - Afficher le formulaire de contact
 * @field socialLinks      - Tableau de liens sociaux (max 10)
 * @field seoTitle         - Titre SEO personnalisé (optionnel, max 60 chars)
 * @field seoDescription   - Description SEO personnalisée (optionnel, max 160 chars)
 */
export const BioPageUpsertSchema = z.object({
  slug: z
    .string()
    .min(3, 'Le slug doit contenir au moins 3 caractères')
    .max(30, 'Le slug ne peut pas dépasser 30 caractères')
    .regex(
      /^[a-z0-9-]+$/,
      'Le slug ne peut contenir que des lettres minuscules, des chiffres et des tirets'
    ),
  title: z.string().max(100, 'Le titre ne peut pas dépasser 100 caractères').optional().nullable(),
  bio: z.string().max(300, 'La bio ne peut pas dépasser 300 caractères').optional().nullable(),
  avatarUrl: z.string().url('URL avatar invalide').optional().nullable(),
  theme: z.enum(BIO_THEMES).default('default'),
  accentColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, 'La couleur doit être au format hexadécimal (#RRGGBB)')
    .default('#6366f1'),

  // Couleurs personnalisées (null = hérite du thème)
  titleColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Couleur hex invalide').optional().nullable(),
  bioColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Couleur hex invalide').optional().nullable(),
  linkColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Couleur hex invalide').optional().nullable(),

  // Personnalisation avancée
  fontFamily: z.enum(BIO_FONTS).default('inter'),
  buttonShape: z.enum(BIO_BUTTON_SHAPES).default('rounded-lg'),
  buttonVariant: z.enum(BIO_BUTTON_VARIANTS).default('filled'),
  avatarShape: z.enum(BIO_AVATAR_SHAPES).default('circle'),
  backgroundImageUrl: z.string().url('URL image invalide').optional().nullable(),
  gradientFrom: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, 'Couleur invalide')
    .optional()
    .nullable(),
  gradientTo: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, 'Couleur invalide')
    .optional()
    .nullable(),
  linkSpacing: z.enum(BIO_LINK_SPACINGS).default('normal'),
  hoverAnimation: z.enum(BIO_HOVER_ANIMATIONS).default('none'),
  headerStyle: z.enum(BIO_HEADER_STYLES).default('classic'),
  bannerUrl: z.string().url('URL bannière invalide').optional().nullable(),
  hideBranding: z.boolean().default(false),
  faviconUrl: z.string().url('URL favicon invalide').optional().nullable(),
  showContactForm: z.boolean().default(false),
  templateId: z.string().optional().nullable(),

  socialLinks: z.array(BioSocialLinkSchema).max(10, 'Maximum 10 liens sociaux').default([]),
  seoTitle: z.string().max(60, 'Le titre SEO ne peut pas dépasser 60 caractères').optional().nullable(),
  seoDescription: z
    .string()
    .max(160, 'La description SEO ne peut pas dépasser 160 caractères')
    .optional()
    .nullable(),
}).refine(
  // Validation croisée : si un gradient est défini, les 2 couleurs sont requises
  (data) => {
    if (data.gradientFrom && !data.gradientTo) return false
    if (!data.gradientFrom && data.gradientTo) return false
    return true
  },
  { message: 'Les deux couleurs du dégradé sont requises', path: ['gradientTo'] }
)

/** Type TypeScript inféré depuis BioPageUpsertSchema */
export type BioPageUpsert = z.infer<typeof BioPageUpsertSchema>

// ─── Schéma BioLink ───────────────────────────────────────────────────────────

/**
 * Schéma pour créer ou mettre à jour un lien sur la BioPage.
 * - `id` absent → création
 * - `id` présent → mise à jour du lien existant
 *
 * @field id           - ID du lien (optionnel ; absent = création)
 * @field type         - Type de lien (link, header, separator, video, music)
 * @field title        - Libellé du bouton (1–100 chars)
 * @field url          - URL de destination (optionnel pour header/separator)
 * @field icon         - Emoji ou nom d'icône Lucide (optionnel)
 * @field thumbnailUrl - URL d'image miniature (optionnel)
 * @field isActive     - Lien visible sur la page publique (défaut: true)
 * @field activeFrom   - Début de visibilité (optionnel)
 * @field activeUntil  - Fin de visibilité (optionnel)
 */
export const BioLinkUpsertSchema = z.object({
  id: z.string().optional(),
  type: z.enum(BIO_LINK_TYPES).default('link'),
  title: z.string().min(1, 'Le titre est requis').max(100, 'Le titre ne peut pas dépasser 100 caractères'),
  url: z.string().url('URL invalide').optional().nullable(),
  icon: z.string().max(50).optional().nullable(),
  thumbnailUrl: z.string().url('URL miniature invalide').optional().nullable(),
  isActive: z.boolean().default(true),
  activeFrom: z.coerce.date().optional().nullable(),
  activeUntil: z.coerce.date().optional().nullable(),
}).refine(
  // URL obligatoire pour les types link, video et music
  (data) => {
    if (['link', 'video', 'music'].includes(data.type) && !data.url) return false
    return true
  },
  { message: 'L\'URL est requise pour ce type de lien', path: ['url'] }
).refine(
  // activeUntil doit être après activeFrom
  (data) => {
    if (data.activeFrom && data.activeUntil && data.activeUntil <= data.activeFrom) return false
    return true
  },
  { message: 'La date de fin doit être après la date de début', path: ['activeUntil'] }
)

/** Type TypeScript inféré depuis BioLinkUpsertSchema */
export type BioLinkUpsert = z.infer<typeof BioLinkUpsertSchema>

// ─── Schéma Réordonnement ─────────────────────────────────────────────────────

/**
 * Schéma pour réordonner les liens après un drag & drop.
 * Reçoit un tableau de { id, position } pour chaque lien à repositionner.
 *
 * @field links - Tableau d'objets { id: string, position: number }
 */
export const ReorderLinksSchema = z.object({
  links: z.array(
    z.object({
      id: z.string(),
      position: z.number().int().min(0, 'La position doit être positive'),
    })
  ),
})

/** Type TypeScript inféré depuis ReorderLinksSchema */
export type ReorderLinks = z.infer<typeof ReorderLinksSchema>

// ─── Schéma Contact ───────────────────────────────────────────────────────────

/**
 * Schéma de validation du formulaire de contact intégré.
 *
 * @field name    - Nom de l'expéditeur (1–100 chars)
 * @field email   - Email valide de l'expéditeur
 * @field message - Contenu du message (1–1000 chars)
 */
export const BioContactSchema = z.object({
  name: z.string().min(1, 'Le nom est requis').max(100, 'Le nom ne peut pas dépasser 100 caractères'),
  email: z.string().email('Email invalide'),
  message: z.string().min(1, 'Le message est requis').max(1000, 'Le message ne peut pas dépasser 1000 caractères'),
})

/** Type TypeScript inféré depuis BioContactSchema */
export type BioContactInput = z.infer<typeof BioContactSchema>
