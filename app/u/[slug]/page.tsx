/**
 * @file app/u/[slug]/page.tsx
 * @module app/u
 * @description Page publique Link in Bio — rendue pour l'URL `/u/{slug}`.
 *
 *   Server Component : résout le slug, charge les données, génère les
 *   métadonnées SEO, puis délègue le rendu à `<BioPageRenderer />` (Client).
 *
 *   Source des données (MVP) : registre statique dans `mock-data.ts`.
 *   Seul `mimisara` est résolu — tout autre slug → 404 via `notFound()`.
 *
 *   TODO(biolink-db) : remplacer `getBioPageBySlug()` par une requête Prisma
 *   `bioPage.findUnique({ where: { slug }, include: { links: ... } })`
 *   lorsque le modèle `BioPage` sera restauré via migration.
 *
 * @example
 *   // URL : https://socialtdl.net/u/mimisara
 *   // → rend la BioPage "Mimi Sara" avec le design responsive
 */

import { notFound } from 'next/navigation'

import { BioPageRenderer } from '@/modules/biolink/components/BioPageRenderer'
import { getBioPageBySlug } from '@/modules/biolink/mock-data'

import type { Metadata } from 'next'

// ─── Params du segment dynamique ─────────────────────────────────────────────

/**
 * Props injectées par Next.js — params.slug vient de l'URL `/u/[slug]`.
 * Next.js 16 : `params` est une Promise (async params).
 */
interface BioPageProps {
  params: Promise<{ slug: string }>
}

// ─── Métadonnées SEO (Open Graph, title) ─────────────────────────────────────

/**
 * Génère les métadonnées HTML de la page à partir des données de la BioPage.
 * Appelée par Next.js avant le rendu (SSR).
 *
 * @param props.params - Slug extrait de l'URL
 * @returns Métadonnées (title, description, OG image) ou metadata 404 si slug invalide
 */
export async function generateMetadata({
  params,
}: BioPageProps): Promise<Metadata> {
  const { slug } = await params
  const data = getBioPageBySlug(slug)

  // Slug inconnu — on ne génère pas de metadata riche (la page sera 404)
  if (!data) {
    return { title: 'Page introuvable' }
  }

  // Titre compact : "Nom — Bio"
  const title = `${data.name} — ${data.bio}`

  return {
    title,
    description: data.tagline,
    openGraph: {
      title,
      description: data.tagline,
      type: 'profile',
      images: [data.avatarUrl],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description: data.tagline,
      images: [data.avatarUrl],
    },
  }
}

// ─── Page ────────────────────────────────────────────────────────────────────

/**
 * Rendu de la BioPage. Appelle `notFound()` si le slug n'existe pas.
 * Server Component — pas d'état, pas d'interactivité à ce niveau.
 *
 * @param props.params - Slug dynamique de l'URL
 * @returns BioPageRenderer avec les données ou 404 Next.js
 */
export default async function BioLinkPage({
  params,
}: BioPageProps): Promise<React.JSX.Element> {
  const { slug } = await params
  const data = getBioPageBySlug(slug)

  if (!data) {
    notFound()
  }

  return <BioPageRenderer data={data} />
}
