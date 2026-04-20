/**
 * @file modules/biolink/mappers.ts
 * @module biolink
 * @description Transforme une ligne Prisma `BioPage` (+ ses `BioLink[]`) en
 *   `BioPageData` prêt à être passé à `<BioPageRenderer />`.
 *
 *   Rôle :
 *   - Applique les fallbacks (handle null → `@{slug}`, avatar null → default, etc.)
 *   - Dérive les champs calculés (nameSplit, footerBrand, footerWebsite)
 *   - Parse les socialLinks JSON en tableau typé
 *   - Trie/filtre les BioLinks visibles et mappe vers BioLinkItem
 *
 *   Garde la séparation **DB shape ↔ View shape** — la DB peut évoluer
 *   (ajout de champs, relations) sans impacter le rendu.
 *
 * @example
 *   const row = await prisma.bioPage.findFirst({ where: { slug }, include: { links: ... } })
 *   const data: BioPageData = mapBioPageToData(row)
 */

import type { BioLink, BioPage } from '@prisma/client'

import type {
  BioLinkItem,
  BioLinkKind,
  BioPageData,
  BioSocial,
  BioSocialKind,
  BioTheme,
} from './types'

/**
 * Avatar par défaut (placeholder démo) si la BioPage n'en a pas encore configuré.
 * TODO : remplacer par un avatar généré (initiales stylisées) quand l'éditeur aura
 * un uploader — en attendant, un placeholder garantit que le rendu ne casse pas.
 */
const DEFAULT_AVATAR_URL = '/brand/biolink-demo-avatar.jpg'

/** URL publique de l'app — utilisée pour dériver le footerWebsite par défaut */
const APP_DOMAIN = 'socialtdl.net'

/** Forme attendue d'une entrée dans BioPage.socialLinks (JSON) */
interface SocialLinkRaw {
  platform: string
  url: string
  label?: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Découpe un titre sur le premier saut de ligne pour la stylisation italique.
 *
 * @example
 *   splitName("Mimi\nSara")    // → ["Mimi", "Sara"]
 *   splitName("Mimi Sara")     // → ["Mimi Sara"] (1 seul élément, pas d'italique)
 *   splitName("")              // → [""]
 */
function splitName(name: string): [string, string?] {
  const idx = name.indexOf('\n')
  if (idx === -1) return [name]
  return [name.slice(0, idx), name.slice(idx + 1)]
}

/**
 * Convertit une plateforme brute (stockée en DB) en BioSocialKind typé.
 * Les plateformes inconnues sont filtrées (retournent `null`).
 */
function normalizeSocialKind(platform: string): BioSocialKind | null {
  const p = platform.toLowerCase().trim()
  if (p === 'ig' || p === 'instagram') return 'ig'
  if (p === 'tt' || p === 'tiktok') return 'tt'
  if (p === 'yt' || p === 'youtube') return 'yt'
  if (p === 'fb' || p === 'facebook') return 'fb'
  if (p === 'mail' || p === 'email') return 'mail'
  return null
}

/**
 * Parse le JSON socialLinks en tableau BioSocial typé.
 * Les entrées invalides (platform inconnue, URL manquante) sont ignorées silencieusement
 * pour ne jamais casser le rendu si la DB contient des données corrompues.
 */
function parseSocialLinks(raw: unknown): BioSocial[] {
  if (!Array.isArray(raw)) return []
  const result: BioSocial[] = []
  for (const entry of raw as SocialLinkRaw[]) {
    if (!entry || typeof entry.platform !== 'string' || typeof entry.url !== 'string') continue
    const kind = normalizeSocialKind(entry.platform)
    if (!kind) continue
    result.push({ kind, href: entry.url, label: entry.label })
  }
  return result
}

/**
 * Filtre les BioLinks à afficher sur la page publique et les mappe en BioLinkItem.
 *
 * Règles :
 * 1. `isActive = true` (sinon : désactivé par l'user)
 * 2. `type = 'link'` (headers/separators/video/music hors scope MVP)
 * 3. `activeFrom <= maintenant <= activeUntil` (scheduling temporel)
 * 4. `url` non null (requis par BioLinkItem)
 *
 * Le `kind` (style visuel) et l'`eyebrow` (petit texte au-dessus du label) sont
 * lus depuis les colonnes dédiées `bio_links.kind` et `bio_links.eyebrow`
 * (ajoutées par la migration `20260421120000_biolink_kind_eyebrow`).
 * L'utilisateur contrôle donc explicitement quel lien est mis en avant (`primary`).
 */
function mapLinks(links: BioLink[]): BioLinkItem[] {
  const now = new Date()
  const visible = links
    .filter((l) => l.isActive && l.type === 'link' && l.url)
    .filter((l) => !l.activeFrom || l.activeFrom <= now)
    .filter((l) => !l.activeUntil || l.activeUntil >= now)
    .sort((a, b) => a.position - b.position)

  return visible.map((l) => {
    // Safe-guard : on ne laisse passer que les deux valeurs attendues, sinon fallback 'glass'
    // pour éviter qu'une valeur corrompue en DB (ex: ancienne migration) ne casse le rendu.
    const kind: BioLinkKind =
      l.kind === 'primary' || l.kind === 'glass' ? l.kind : 'glass'
    return {
      label: l.title,
      eyebrow: l.eyebrow ?? undefined,
      href: l.url as string,
      kind,
    }
  })
}

/**
 * Dérive le theme à partir des colonnes de BioPage.
 * Retourne `undefined` si toutes les couleurs sont null (→ renderer utilisera les défauts).
 */
function deriveTheme(row: BioPage): BioTheme | undefined {
  const hasAny = row.accentColor !== '#6366f1' || row.titleColor || row.bioColor || row.linkColor
  if (!hasAny) return undefined
  return {
    accentColor: row.accentColor === '#6366f1' ? undefined : row.accentColor,
    titleColor: row.titleColor ?? undefined,
    bioColor: row.bioColor ?? undefined,
    linkColor: row.linkColor ?? undefined,
  }
}

// ─── Mapper principal ─────────────────────────────────────────────────────────

/**
 * Transforme une BioPage Prisma (avec ses links inclus) en BioPageData
 * prêt à être passé à `<BioPageRenderer />`.
 *
 * @param row - Résultat de `prisma.bioPage.findFirst({ include: { links: ... } })`
 * @returns BioPageData normalisé pour le rendu
 *
 * @example
 *   const row = await prisma.bioPage.findFirst({
 *     where: { slug: 'mimisara', isPublished: true },
 *     include: { links: { where: { isActive: true }, orderBy: { position: 'asc' } } },
 *   })
 *   if (!row) notFound()
 *   return <BioPageRenderer data={mapBioPageToData(row)} />
 */
export function mapBioPageToData(
  row: BioPage & { links: BioLink[] },
): BioPageData {
  // Nom affiché : title ou fallback humain (évite un rendu vide)
  const name = row.title ?? 'Sans titre'

  // Handle : DB ou fallback @{slug}
  const handle = row.handle ? `@${row.handle}` : `@${row.slug}`

  // Footer dérivé automatiquement — évite un nouveau champ DB
  const year = new Date().getFullYear()
  const footerBrand = `© ${year} ${name.replace(/\n/g, ' ')}`
  const footerWebsite = row.customDomain ?? `${APP_DOMAIN}/u/${row.slug}`

  return {
    slug: row.slug,
    name,
    nameSplit: splitName(name),
    handle,
    bio: row.bio ?? undefined,
    tagline: row.tagline ?? undefined,
    avatarUrl: row.avatarUrl ?? DEFAULT_AVATAR_URL,
    status: row.isPublished ? 'En ligne' : undefined,
    theme: deriveTheme(row),
    socials: parseSocialLinks(row.socialLinks),
    links: mapLinks(row.links),
    footerBrand,
    footerWebsite,
  }
}
