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
  name: 'Mimi Sara',
  nameSplit: ['Mimi', 'Sara'],
  handle: '@mimisara',
  bio: 'Auteure · Entrepreneure · Camerounaise',
  tagline:
    'Retrouvez ici mes projets, mon livre et ma boutique — un seul endroit, toujours à jour.',
  avatarUrl: '/brand/biolink-demo-avatar.jpg',
  status: 'En ligne',
  socials: [
    { kind: 'ig', href: 'https://instagram.com/mimisara', label: 'Instagram' },
    { kind: 'tt', href: 'https://tiktok.com/@mimisara', label: 'TikTok' },
    { kind: 'yt', href: 'https://youtube.com/@mimisara', label: 'YouTube' },
    { kind: 'mail', href: 'mailto:contact@mimisara.com', label: 'Email' },
  ],
  links: [
    {
      label: 'Mon livre Amazon',
      eyebrow: 'Nouveau',
      kind: 'primary',
      href: 'https://www.amazon.fr/',
    },
    {
      label: 'Ma boutique Shopify',
      kind: 'glass',
      href: 'https://mimisara.myshopify.com/',
    },
    {
      label: 'Livre SkinCare',
      kind: 'glass',
      href: 'https://mimisara.com/skincare',
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
