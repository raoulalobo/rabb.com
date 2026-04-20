/**
 * @file modules/biolink/mock-data.ts
 * @module biolink
 * @description Données statiques pour la démo de `/u/[slug]` — MVP.
 *
 *   Ce fichier existe UNIQUEMENT pour livrer visuellement le design
 *   sans avoir à restaurer d'abord le schéma Prisma `BioPage`/`BioLink`
 *   (supprimé le 2026-03-19, toujours documenté dans schema.prisma
 *   lignes 234-387).
 *
 *   TODO(biolink-db) : remplacer l'accès statique par une requête Prisma
 *   dans `app/u/[slug]/page.tsx` quand le modèle `BioPage` sera restauré :
 *
 *     const page = await prisma.bioPage.findUnique({
 *       where: { slug },
 *       include: { links: { where: { enabled: true }, orderBy: { position: 'asc' } } }
 *     })
 *     if (!page) notFound()
 *     return mapBioPageToData(page)
 *
 *   L'image avatar est un placeholder extrait du handoff design
 *   (linkinbio.zip → assets/avatar.jpg, resize 1200×900 JPEG 85%) —
 *   à terme elle sera uploadée par l'utilisateur via Supabase Storage.
 */

import type { BioPageData } from './types'

/**
 * Page de démo "Mimi Sara" — données exactes du design handoff.
 * Accessible via /u/mimisara (le seul slug matching en MVP).
 *
 * Destinations des liens : URLs fournies par le design, à confirmer avec
 * le client final avant mise en production (actuellement pointent vers
 * des exemples réalistes mais placeholder).
 */
export const MIMI_SARA_MOCK: BioPageData = {
  slug: 'mimisara',
  // "\n" déclenche l'italique ligne 2 dans le renderer (cf. splitName).
  name: 'Mimi\nSara',
  nameSplit: ['Mimi', 'Sara'],
  // Handle aligné sur les comptes IG/TikTok de la cliente pour cohérence.
  // Le slug URL reste 'mimisara' (plus lisible/SEO) — ils peuvent différer.
  handle: '@mimimaze',
  bio: 'Auteure · Entrepreneure · Camerounaise',
  tagline:
    'Retrouvez ici mes projets, mon livre et ma boutique — un seul endroit, toujours à jour.',
  avatarUrl: '/brand/biolink-demo-avatar.jpg',
  status: 'En ligne',
  // Réseaux sociaux réels fournis par la cliente (2026-04-20) :
  // - Instagram  : @mimimaze
  // - TikTok     : @mimimaze
  // - Facebook   : La boutique d'Osy (page — pas de compte perso)
  // YouTube et email non disponibles → non affichés.
  socials: [
    { kind: 'ig', href: 'https://instagram.com/mimimaze', label: 'Instagram' },
    { kind: 'tt', href: 'https://tiktok.com/@mimimaze', label: 'TikTok' },
    { kind: 'fb', href: 'https://facebook.com/laboutiquedosy', label: "La boutique d'Osy — Facebook" },
  ],
  // Liens réels fournis par la cliente (2026-04-20) :
  // - 01 Livre Amazon  : https://amzn.eu/d/0d7u1lGb
  //   Titre "Je découvre des héros africains" repris du design handoff —
  //   à confirmer / modifier par la cliente si besoin.
  // - 02 Boutique      : https://www.laboutiquedosy.com
  // SkinCare retiré (pas de ressource associée).
  links: [
    {
      label: 'Je découvre des héros africains',
      eyebrow: 'Mon livre',
      kind: 'primary',
      href: 'https://amzn.eu/d/0d7u1lGb',
    },
    {
      label: "La boutique d'Osy",
      eyebrow: 'Ma boutique',
      kind: 'glass',
      href: 'https://www.laboutiquedosy.com',
    },
  ],
  footerBrand: '© 2026 Mimi Sara',
  footerWebsite: 'mimisara.com',
}

/**
 * Registre des BioPages disponibles en MVP.
 * En v2, remplacé par la table Prisma `bio_pages`.
 */
export const BIOPAGE_REGISTRY: Record<string, BioPageData> = {
  mimisara: MIMI_SARA_MOCK,
}

/**
 * Récupère une BioPage par son slug.
 * Retourne `null` si aucun match (le caller doit appeler `notFound()`).
 *
 * @param slug - Slug URL (partie après `/u/`)
 * @returns BioPageData si trouvée, sinon null
 *
 * @example
 *   const page = getBioPageBySlug('mimisara')  // → MIMI_SARA_MOCK
 *   const none = getBioPageBySlug('inexistant') // → null
 */
export function getBioPageBySlug(slug: string): BioPageData | null {
  return BIOPAGE_REGISTRY[slug] ?? null
}
