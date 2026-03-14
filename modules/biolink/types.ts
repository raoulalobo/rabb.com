/**
 * @file modules/biolink/types.ts
 * @module biolink
 * @description Types TypeScript du module Bio Link.
 *   Une BioPage est une page publique "Link in Bio" accessible à l'URL /u/{slug}.
 *   Elle contient des BioLinks (boutons cliquables, titres de section, séparateurs,
 *   embeds vidéo/musique) et des liens sociaux (icônes).
 *
 * @example
 *   const page: BioPage = {
 *     id: 'clxxx',
 *     userId: 'usr_1',
 *     slug: 'mon-pseudo',
 *     title: 'Mon Pseudo',
 *     bio: 'Créateur de contenu',
 *     theme: 'default',
 *     accentColor: '#6366f1',
 *     fontFamily: 'inter',
 *     buttonShape: 'rounded-lg',
 *     buttonVariant: 'filled',
 *     avatarShape: 'circle',
 *     linkSpacing: 'normal',
 *     hoverAnimation: 'none',
 *     isPublished: true,
 *     links: [{ id: 'lnk_1', type: 'link', title: 'Ma vidéo', url: 'https://...', position: 0 }],
 *   }
 */

// ─── Types de domaine ──────────────────────────────────────────────────────────

/**
 * Lien social affiché en icône en bas de la BioPage.
 * Stocké en JSON dans BioPage.socialLinks.
 */
export interface BioSocialLink {
  /** Identifiant de la plateforme : "instagram", "tiktok", "youtube", etc. */
  platform: string
  /** URL complète vers le profil sur la plateforme */
  url: string
  /** Couleur hex personnalisée de l'icône (null = couleur du thème) */
  color?: string
}

/**
 * Types de lien disponibles pour un BioLink.
 * - link      : bouton cliquable classique (URL obligatoire)
 * - header    : titre de section (pas d'URL, pas cliquable)
 * - separator : ligne horizontale décorative (pas d'URL, pas cliquable)
 * - video     : embed YouTube/TikTok (URL obligatoire, rendu en iframe)
 * - music     : embed Spotify (URL obligatoire, rendu en iframe compact)
 */
export type BioLinkType = 'link' | 'header' | 'separator' | 'video' | 'music'

/**
 * Lien individuel (bouton, titre, séparateur, embed) sur une BioPage.
 * Correspond au modèle Prisma `BioLink` (table "bio_links").
 */
export interface BioLink {
  id: string
  bioPageId: string
  /** Type de lien : détermine le rendu (bouton, titre, séparateur, embed) */
  type: BioLinkType
  /** Libellé du bouton : "Ma dernière vidéo", "Ma boutique", etc. */
  title: string
  /** URL de destination — null pour les types header/separator */
  url: string | null
  /** Emoji ou nom d'icône Lucide (optionnel) */
  icon: string | null
  /** URL d'image miniature affichée dans le bouton (optionnel) */
  thumbnailUrl: string | null
  /** Début de visibilité — null = immédiat */
  activeFrom: Date | null
  /** Fin de visibilité — null = permanent */
  activeUntil: Date | null
  /** Ordre d'affichage (0 = premier, modifiable par drag & drop) */
  position: number
  /** Nombre de clics sur ce lien */
  clicks: number
  /** Lien visible sur la page publique si true */
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

/**
 * Page "Link in Bio" publique de l'utilisateur.
 * Correspond au modèle Prisma `BioPage` (table "bio_pages").
 */
export interface BioPage {
  id: string
  userId: string
  /** Slug unique pour l'URL publique : ogolong.com/u/{slug} */
  slug: string
  /** Nom affiché en haut de la page (défaut: user.name) */
  title: string | null
  /** Description courte sous le titre (max 300 chars) */
  bio: string | null
  /** URL de l'avatar affiché (défaut: user.avatarUrl) */
  avatarUrl: string | null
  /** Identifiant du thème visuel : "default" | "dark" | "gradient" | "minimal" | "neon" */
  theme: string
  /** Couleur d'accent hexadécimale (ex: "#6366f1") */
  accentColor: string
  /** Couleur hex personnalisée du titre (null = couleur du thème) */
  titleColor: string | null
  /** Couleur hex personnalisée de la bio (null = couleur du thème) */
  bioColor: string | null
  /** Couleur hex personnalisée du texte des liens (null = couleur du thème) */
  linkColor: string | null
  /** Police de caractères : inter, poppins, playfair, space-grotesk, dm-sans, outfit, lora, bebas-neue */
  fontFamily: string
  /** Forme des boutons : rounded-lg, rounded-full, rounded-none */
  buttonShape: string
  /** Variante des boutons : filled, outline, shadow */
  buttonVariant: string
  /** Forme de l'avatar : circle, rounded-square, square */
  avatarShape: string
  /** URL de l'image de fond (optionnel) */
  backgroundImageUrl: string | null
  /** Hex couleur 1 du dégradé custom (optionnel) */
  gradientFrom: string | null
  /** Hex couleur 2 du dégradé custom (optionnel) */
  gradientTo: string | null
  /** Espacement entre les liens : compact, normal, airy */
  linkSpacing: string
  /** Animation au survol des liens : none, scale, glow, slide */
  hoverAnimation: string
  /** Style de mise en page : classic, hero, banner, minimal, card */
  headerStyle: string
  /** URL de la bannière en haut de la page (optionnel) */
  bannerUrl: string | null
  /** Masquer le branding "Créé avec ogolong" */
  hideBranding: boolean
  /** URL du favicon personnalisé (optionnel) */
  faviconUrl: string | null
  /** Afficher le formulaire de contact intégré */
  showContactForm: boolean
  /** ID du dernier template appliqué (null = personnalisation manuelle) */
  templateId: string | null
  /** Domaine personnalisé (optionnel, post-MVP) */
  customDomain: string | null
  /** Titre SEO personnalisé (balise <title>) */
  seoTitle: string | null
  /** Description SEO personnalisée (balise <meta description>) */
  seoDescription: string | null
  /** Liens vers les réseaux sociaux (icônes en bas de page) */
  socialLinks: BioSocialLink[]
  /** Nombre total de clics agrégé sur tous les liens */
  totalClicks: number
  /** La page est accessible publiquement uniquement si true */
  isPublished: boolean
  createdAt: Date
  updatedAt: Date
  /** Liens individuels (boutons cliquables), triés par position */
  links: BioLink[]
}

/**
 * Page bio avec uniquement les champs nécessaires pour la vue publique.
 * Utilisé par la page /u/[slug] pour éviter de transmettre des données privées.
 */
export type BioPagePublic = Pick<
  BioPage,
  | 'id'
  | 'slug'
  | 'title'
  | 'bio'
  | 'avatarUrl'
  | 'theme'
  | 'accentColor'
  | 'titleColor'
  | 'bioColor'
  | 'linkColor'
  | 'fontFamily'
  | 'buttonShape'
  | 'buttonVariant'
  | 'avatarShape'
  | 'backgroundImageUrl'
  | 'gradientFrom'
  | 'gradientTo'
  | 'linkSpacing'
  | 'hoverAnimation'
  | 'headerStyle'
  | 'bannerUrl'
  | 'hideBranding'
  | 'faviconUrl'
  | 'showContactForm'
  | 'socialLinks'
  | 'links'
>

/**
 * Message reçu via le formulaire de contact intégré à la BioPage.
 */
export interface BioContact {
  id: string
  bioPageId: string
  /** Nom de l'expéditeur */
  name: string
  /** Email de l'expéditeur */
  email: string
  /** Contenu du message */
  message: string
  createdAt: Date
}
