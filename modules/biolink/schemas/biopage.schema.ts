/**
 * @file modules/biolink/schemas/biopage.schema.ts
 * @module biolink
 * @description Schémas Zod pour la validation des données du module Link in Bio.
 *
 *   Trois schémas principaux :
 *   - `BioPageInfosSchema`   — infos éditables de la BioPage (titre, bio, slug, handle, tagline)
 *   - `BioLinkSchema`        — lien individuel (titre, URL, eyebrow, kind, isActive)
 *   - `BioAppearanceSchema`  — couleurs personnalisées (accent/title/bio/link)
 *
 *   Utilisés dans les Server Actions de `modules/biolink/actions/` avant toute
 *   opération Prisma et côté client pour donner un feedback immédiat aux formulaires.
 *
 * @example
 *   import { BioPageInfosSchema, BioLinkSchema } from '@/modules/biolink/schemas/biopage.schema'
 *   const parsed = BioPageInfosSchema.safeParse({ title: 'Mimi\nSara', slug: 'mimisara' })
 *   if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalide' }
 */

import { z } from 'zod'

// ─── Constantes ────────────────────────────────────────────────────────────────

/** Longueur maximale du titre affiché en hero (incluant le \n éventuel) */
const MAX_TITLE_LENGTH = 100

/** Longueur maximale de la bio courte sous le titre (1-2 lignes uppercase monospace) */
const MAX_BIO_LENGTH = 300

/** Longueur maximale du handle (sans le @ — ajouté au rendu) */
const MAX_HANDLE_LENGTH = 30

/** Longueur maximale de la tagline affichée dans le panneau frosted desktop */
const MAX_TAGLINE_LENGTH = 200

/** Longueur maximale du titre d'un lien (bouton cliquable) */
const MAX_LINK_TITLE_LENGTH = 80

/** Longueur maximale de l'eyebrow (mini texte au-dessus du titre d'un lien) */
const MAX_EYEBROW_LENGTH = 30

/** Bornes du slug — 3 à 30 caractères, lowercase/chiffres/tirets */
const SLUG_MIN_LENGTH = 3
const SLUG_MAX_LENGTH = 30

/** Regex slug : lowercase + chiffres + tirets uniquement */
const SLUG_REGEX = /^[a-z0-9-]+$/

/** Regex hex 6 chars obligatoire (#RRGGBB) pour les couleurs personnalisées */
const HEX_COLOR_REGEX = /^#[0-9a-fA-F]{6}$/

// ─── Schéma : infos de base de la BioPage ─────────────────────────────────────

/**
 * Schéma de validation des infos éditables d'une BioPage.
 * Le titre accepte un `\n` pour la stylisation typographique (ligne 2 italique).
 * Tous les champs hormis `title` sont optionnels — ils peuvent être null en DB.
 *
 * @example
 *   BioPageInfosSchema.parse({
 *     title: 'Mimi\nSara',
 *     bio: 'Auteure · Entrepreneure · Camerounaise',
 *     handle: 'mimimaze',
 *     tagline: 'Retrouvez ici mes projets, livres et inspirations.',
 *     slug: 'mimisara',
 *   })
 */
export const BioPageInfosSchema = z.object({
  /** Nom affiché dans le hero (ex: "Mimi\nSara" ou "La boutique d'Osy") */
  title: z
    .string()
    .min(1, 'Le titre est requis')
    .max(MAX_TITLE_LENGTH, `Le titre ne doit pas dépasser ${MAX_TITLE_LENGTH} caractères`),

  /**
   * Bio courte affichée sous le titre — optionnelle.
   * `nullable()` : l'utilisateur peut explicitement vider le champ (UI envoie `null`)
   * pour effacer une valeur déjà persistée en DB.
   * `optional()` : le champ peut être totalement absent du payload (update partiel).
   */
  bio: z
    .string()
    .max(MAX_BIO_LENGTH, `La bio ne doit pas dépasser ${MAX_BIO_LENGTH} caractères`)
    .nullable()
    .optional(),

  /**
   * Handle visible en haut à gauche (sans le @) — optionnel, fallback `@{slug}`.
   * Nullable pour permettre un reset volontaire depuis l'éditeur.
   */
  handle: z
    .string()
    .max(MAX_HANDLE_LENGTH, `Le handle ne doit pas dépasser ${MAX_HANDLE_LENGTH} caractères`)
    .nullable()
    .optional(),

  /**
   * Phrase d'intro du panneau frosted desktop — optionnelle.
   * Nullable pour permettre un reset volontaire depuis l'éditeur.
   */
  tagline: z
    .string()
    .max(MAX_TAGLINE_LENGTH, `La tagline ne doit pas dépasser ${MAX_TAGLINE_LENGTH} caractères`)
    .nullable()
    .optional(),

  /** Slug URL (ex: "mimisara" pour /u/mimisara) — unique en DB */
  slug: z
    .string()
    .min(SLUG_MIN_LENGTH, `Le slug doit contenir au moins ${SLUG_MIN_LENGTH} caractères`)
    .max(SLUG_MAX_LENGTH, `Le slug ne doit pas dépasser ${SLUG_MAX_LENGTH} caractères`)
    .regex(SLUG_REGEX, 'Le slug ne peut contenir que des lettres minuscules, chiffres et tirets'),
})

/** Type inféré — infos éditables d'une BioPage */
export type BioPageInfos = z.infer<typeof BioPageInfosSchema>

// ─── Schéma : lien individuel ─────────────────────────────────────────────────

/**
 * Schéma de validation d'un lien individuel (BioLink).
 * Chaque lien est un bouton cliquable affiché sur la page publique.
 *
 * @example
 *   BioLinkSchema.parse({
 *     title: 'Mon livre Amazon',
 *     url: 'https://amzn.to/xxx',
 *     eyebrow: 'Nouveau',
 *     kind: 'primary',
 *     isActive: true,
 *   })
 */
export const BioLinkSchema = z.object({
  /** Libellé principal du bouton — 1 à 80 caractères */
  title: z
    .string()
    .min(1, 'Le titre du lien est requis')
    .max(MAX_LINK_TITLE_LENGTH, `Le titre ne doit pas dépasser ${MAX_LINK_TITLE_LENGTH} caractères`),

  /** URL de destination — doit être une URL valide */
  url: z.string().url('URL invalide'),

  /** Petit texte au-dessus du titre (ex: "Nouveau", "Recommandé") — optionnel */
  eyebrow: z
    .string()
    .max(MAX_EYEBROW_LENGTH, `L'eyebrow ne doit pas dépasser ${MAX_EYEBROW_LENGTH} caractères`)
    .optional(),

  /**
   * Style de la carte :
   * - `primary` : carte amber en haut de la liste (1 seul attendu)
   * - `glass`   : row avec fond blanc semi-transparent
   */
  kind: z.enum(['primary', 'glass']),

  /** Visibilité du lien sur la page publique */
  isActive: z.boolean(),
})

/** Type inféré — lien individuel */
export type BioLinkInput = z.infer<typeof BioLinkSchema>

// ─── Schéma : apparence (couleurs) ────────────────────────────────────────────

/**
 * Schéma de validation des couleurs personnalisées de la BioPage.
 * Toutes les couleurs sont optionnelles : si absentes, le renderer applique
 * les valeurs de défaut du design Mimi Sara.
 *
 * @example
 *   BioAppearanceSchema.parse({ accentColor: '#E8B87A', titleColor: '#F6F2EC' })
 */
export const BioAppearanceSchema = z.object({
  /** Couleur d'accent (CTA amber) — hex #RRGGBB */
  accentColor: z
    .string()
    .regex(HEX_COLOR_REGEX, 'La couleur d\'accent doit être un code hex valide (ex: #E8B87A)')
    .optional(),

  /** Couleur du titre principal — hex #RRGGBB */
  titleColor: z
    .string()
    .regex(HEX_COLOR_REGEX, 'La couleur du titre doit être un code hex valide (ex: #F6F2EC)')
    .optional(),

  /** Couleur de la bio courte — hex #RRGGBB */
  bioColor: z
    .string()
    .regex(HEX_COLOR_REGEX, 'La couleur de la bio doit être un code hex valide (ex: #F6F2EC)')
    .optional(),

  /** Couleur des liens glass — hex #RRGGBB */
  linkColor: z
    .string()
    .regex(HEX_COLOR_REGEX, 'La couleur des liens doit être un code hex valide (ex: #F6F2EC)')
    .optional(),
})

/** Type inféré — apparence (couleurs) d'une BioPage */
export type BioAppearance = z.infer<typeof BioAppearanceSchema>

// ─── Schéma : réseaux sociaux (socialLinks JSON) ──────────────────────────────

/**
 * Plateformes sociales supportées (stockées en DB dans BioPage.socialLinks JSON).
 * Le mapper `normalizeSocialKind` accepte aussi les alias ("instagram" → "ig"),
 * mais depuis l'éditeur on écrit toujours la forme courte canonique.
 */
const SOCIAL_PLATFORMS = ['ig', 'tt', 'yt', 'fb', 'mail'] as const

/** Regex email simple utilisé pour les entrées 'mail' (on préfixe `mailto:` côté action) */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Schéma d'UN lien social (entrée de l'array `BioPage.socialLinks`).
 *
 * L'URL est validée différemment selon la plateforme :
 * - `mail` → format email (le `mailto:` est ajouté côté action avant persist)
 * - autres → URL http/https classique
 *
 * @example
 *   BioSocialItemSchema.parse({ platform: 'ig', url: 'https://instagram.com/mimimaze' })
 *   BioSocialItemSchema.parse({ platform: 'mail', url: 'hello@mimisara.com' })
 */
export const BioSocialItemSchema = z
  .object({
    /** Plateforme canonique (ig / tt / yt / fb / mail) */
    platform: z.enum(SOCIAL_PLATFORMS),
    /** URL du profil ou email brut (sans `mailto:`) */
    url: z.string().min(1, 'URL requise'),
    /** Label d'accessibilité optionnel (fallback au nom de la plateforme si absent) */
    label: z.string().max(40).optional(),
  })
  // ── Validation 1 : si plateforme = mail, l'URL doit être un email valide ──
  .refine(
    (data: { platform: string; url: string }) =>
      data.platform !== 'mail' || EMAIL_REGEX.test(data.url),
    { message: 'Email invalide (ex: hello@domaine.com)', path: ['url'] },
  )
  // ── Validation 2 : autres plateformes → URL http(s) parseable ─────────────
  .refine(
    (data: { platform: string; url: string }) => {
      if (data.platform === 'mail') return true
      try {
        const parsed = new URL(data.url)
        return parsed.protocol === 'http:' || parsed.protocol === 'https:'
      } catch {
        return false
      }
    },
    { message: 'URL invalide (doit commencer par http:// ou https://)', path: ['url'] },
  )

/**
 * Schéma de l'array complet des socialLinks — envoyé tel quel à la Server Action
 * `updateBioPageSocials()` qui remplace intégralement `BioPage.socialLinks` en DB.
 *
 * L'éditeur filtre les entrées à URL vide AVANT d'envoyer, donc on ne valide que
 * des entrées non-vides ici. Max 5 entrées (une par plateforme supportée).
 */
export const BioSocialsSchema = z.array(BioSocialItemSchema).max(SOCIAL_PLATFORMS.length)

/** Type inféré — une entrée sociale */
export type BioSocialItem = z.infer<typeof BioSocialItemSchema>
/** Type inféré — liste des socials persistée */
export type BioSocialsInput = z.infer<typeof BioSocialsSchema>
