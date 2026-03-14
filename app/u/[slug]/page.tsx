/**
 * @file app/u/[slug]/page.tsx
 * @module biolink
 * @description Page publique "Link in Bio" accessible sans authentification.
 *   Rendue côté serveur (SSR) pour le SEO : metadata dynamique (titre, description, OG image).
 *   Affiche la BioPage de l'utilisateur avec ses liens et icônes sociales.
 *
 *   URL : ogolong.com/u/{slug}
 *   Exemple : ogolong.com/u/mon-pseudo
 *
 *   Filtrage temporel : les liens avec activeFrom/activeUntil sont filtrés
 *   côté serveur — seuls les liens dans la fenêtre temporelle actuelle sont affichés.
 *
 *   Si le slug n'existe pas ou que la page n'est pas publiée → 404.
 *
 * @example
 *   // L'utilisateur partage ce lien dans sa bio Instagram :
 *   // https://ogolong.com/u/mon-pseudo
 *   // → affiche sa page Bio Link avec tous ses liens actifs et dans la fenêtre temporelle
 */

import { notFound } from 'next/navigation'

import { prisma } from '@/lib/prisma'
import { BioPageView } from '@/modules/biolink/components/BioPagePublic/BioPageView'
import type { BioLink, BioLinkType, BioPagePublic, BioSocialLink } from '@/modules/biolink/types'

import type { Metadata } from 'next'

// ─── Types ────────────────────────────────────────────────────────────────────

interface PageProps {
  params: Promise<{ slug: string }>
}

// ─── Metadata SEO dynamique ───────────────────────────────────────────────────

/**
 * Génère les metadata SEO pour la page publique Bio Link.
 * Utilise les champs seoTitle/seoDescription si définis, sinon le titre et la bio.
 * Ajoute le favicon personnalisé si défini.
 *
 * @param params - Paramètres de route contenant le slug
 * @returns Metadata Next.js (title, description, Open Graph, icons)
 */
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params

  const page = await prisma.bioPage.findUnique({
    where: { slug },
    select: {
      title: true,
      bio: true,
      avatarUrl: true,
      seoTitle: true,
      seoDescription: true,
      faviconUrl: true,
    },
  })

  if (!page) {
    return { title: 'Page introuvable' }
  }

  const title = page.seoTitle ?? page.title ?? slug
  const description = page.seoDescription ?? page.bio ?? ''

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'profile',
      ...(page.avatarUrl ? { images: [{ url: page.avatarUrl }] } : {}),
    },
    // Favicon personnalisé si défini
    ...(page.faviconUrl ? { icons: { icon: page.faviconUrl } } : {}),
    // Pas d'indexation si la page n'a pas de contenu significatif
    ...(description ? {} : { robots: { index: false } }),
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

/**
 * Page publique /u/[slug] — affiche la BioPage d'un utilisateur.
 * Server Component : charge les données depuis Prisma, rend le HTML côté serveur.
 *
 * Comportement :
 * - Slug existant + publié → affiche la page avec les liens actifs et temporellement valides
 * - Slug inexistant ou non publié → 404 (notFound)
 *
 * Filtrage temporel des liens :
 * Un lien est visible si :
 *   - isActive = true
 *   - activeFrom est null OU activeFrom <= now
 *   - activeUntil est null OU activeUntil >= now
 *
 * @param params - Paramètres de route { slug: string }
 * @returns Page publique Bio Link avec thème, personnalisations et liens
 */
export default async function BioLinkPublicPage({ params }: PageProps): Promise<React.JSX.Element> {
  const { slug } = await params
  const now = new Date()

  // Charger la BioPage publiée avec ses liens actifs et temporellement valides
  const raw = await prisma.bioPage.findUnique({
    where: { slug, isPublished: true },
    include: {
      links: {
        where: {
          isActive: true,
          // Filtrage temporel : le lien est visible si dans la fenêtre [activeFrom, activeUntil]
          OR: [
            // Pas de restriction temporelle
            { activeFrom: null, activeUntil: null },
            // Seulement activeFrom défini (visible à partir de cette date)
            { activeFrom: { lte: now }, activeUntil: null },
            // Seulement activeUntil défini (visible jusqu'à cette date)
            { activeFrom: null, activeUntil: { gte: now } },
            // Les deux définis : dans la fenêtre
            { activeFrom: { lte: now }, activeUntil: { gte: now } },
          ],
        },
        orderBy: { position: 'asc' },
      },
    },
  })

  // Page inexistante ou non publiée → 404
  if (!raw) notFound()

  // Transformer les données Prisma en type BioPagePublic (sans champs sensibles)
  const page: BioPagePublic = {
    id: raw.id,
    slug: raw.slug,
    title: raw.title,
    bio: raw.bio,
    avatarUrl: raw.avatarUrl,
    theme: raw.theme,
    accentColor: raw.accentColor,
    titleColor: raw.titleColor,
    bioColor: raw.bioColor,
    linkColor: raw.linkColor,
    // Champs de personnalisation avancée
    fontFamily: raw.fontFamily,
    buttonShape: raw.buttonShape,
    buttonVariant: raw.buttonVariant,
    avatarShape: raw.avatarShape,
    backgroundImageUrl: raw.backgroundImageUrl,
    gradientFrom: raw.gradientFrom,
    gradientTo: raw.gradientTo,
    linkSpacing: raw.linkSpacing,
    hoverAnimation: raw.hoverAnimation,
    headerStyle: raw.headerStyle,
    bannerUrl: raw.bannerUrl,
    hideBranding: raw.hideBranding,
    faviconUrl: raw.faviconUrl,
    showContactForm: raw.showContactForm,
    socialLinks: Array.isArray(raw.socialLinks)
      ? (raw.socialLinks as unknown as BioSocialLink[])
      : [],
    links: raw.links.map((link): BioLink => ({
      id: link.id,
      bioPageId: link.bioPageId,
      type: (link.type as BioLinkType) ?? 'link',
      title: link.title,
      url: link.url,
      icon: link.icon,
      thumbnailUrl: link.thumbnailUrl,
      activeFrom: link.activeFrom,
      activeUntil: link.activeUntil,
      position: link.position,
      clicks: link.clicks,
      isActive: link.isActive,
      createdAt: link.createdAt,
      updatedAt: link.updatedAt,
    })),
  }

  return <BioPageView page={page} />
}
