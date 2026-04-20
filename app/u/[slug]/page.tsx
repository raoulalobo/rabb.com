/**
 * @file app/u/[slug]/page.tsx
 * @module app/u
 * @description Page publique Link in Bio — rendue pour l'URL `/u/{slug}`.
 *
 *   Server Component : résout le slug en BioPage, charge les données,
 *   génère les métadonnées SEO, puis délègue le rendu à `<BioPageRenderer />`.
 *
 *   **Résolution du slug (2 sources)** :
 *   1. `/u/mimisara` → toujours servi par `MIMI_SARA_MOCK` (démo figée,
 *      ne dépend pas de la DB — garantit que la démo reste up même si la
 *      DB est vide).
 *   2. Tout autre slug → requête Prisma `bioPage.findFirst({ slug, isPublished })`.
 *      Si aucune ligne ne match → `notFound()` (404).
 *
 *   Les pages non publiées (`isPublished = false`) sont **invisibles publiquement** —
 *   elles retourneront 404 ici. L'éditeur dashboard (P2) exposera un `?preview=1`
 *   qui bypass ce filtre pour permettre à l'user de prévisualiser ses brouillons.
 *
 * @example
 *   // URL : https://socialtdl.net/u/mimisara → mock démo
 *   // URL : https://socialtdl.net/u/marie    → Prisma query → 404 si absent
 */

import { notFound } from 'next/navigation'

import { prisma } from '@/lib/prisma'
import { BioPageRenderer } from '@/modules/biolink/components/BioPageRenderer'
import { mapBioPageToData } from '@/modules/biolink/mappers'
import { MIMI_SARA_MOCK } from '@/modules/biolink/mock-data'

import type { BioPageData } from '@/modules/biolink/types'
import type { Metadata } from 'next'

// ─── Params du segment dynamique ─────────────────────────────────────────────

/**
 * Props injectées par Next.js — `params.slug` vient de l'URL `/u/[slug]`.
 * Next.js 16 : `params` est une Promise (async dynamic segments).
 */
interface BioPageProps {
  params: Promise<{ slug: string }>
}

/** Slug réservé pour la démo figée (bypass DB). */
const DEMO_SLUG = 'mimisara'

// ─── Résolution des données (mock démo ou DB) ────────────────────────────────

/**
 * Résout une BioPageData depuis le slug — démo figée ou DB.
 * Retourne `null` si aucune source ne correspond (caller : notFound()).
 *
 * @param slug - Valeur du segment dynamique `/u/[slug]`
 * @returns Données pour `<BioPageRenderer />` ou `null`
 */
async function resolveBioPage(slug: string): Promise<BioPageData | null> {
  // Démo figée : /u/mimisara toujours dispo, même sans DB
  if (slug === DEMO_SLUG) return MIMI_SARA_MOCK

  // Pour tout autre slug → Prisma query avec filtre publication
  const row = await prisma.bioPage.findFirst({
    where: { slug, isPublished: true },
    include: {
      links: {
        where: { isActive: true },
        orderBy: { position: 'asc' },
      },
    },
  })

  if (!row) return null
  return mapBioPageToData(row)
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
  const data = await resolveBioPage(slug)

  if (!data) return { title: 'Page introuvable' }

  // Titre compact "Nom — Bio" (name peut contenir \n pour l'italique → on l'aplatit)
  const displayName = data.name.replace(/\n/g, ' ')
  const title = data.bio ? `${displayName} — ${data.bio}` : displayName

  return {
    title,
    description: data.tagline ?? data.bio,
    openGraph: {
      title,
      description: data.tagline ?? data.bio,
      type: 'profile',
      images: [data.avatarUrl],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description: data.tagline ?? data.bio,
      images: [data.avatarUrl],
    },
  }
}

// ─── Page ────────────────────────────────────────────────────────────────────

/**
 * Rendu de la BioPage. Appelle `notFound()` si le slug n'existe pas
 * (ou si la page existe mais n'est pas publiée).
 *
 * @param props.params - Slug dynamique de l'URL
 * @returns BioPageRenderer avec les données ou 404 Next.js
 */
export default async function BioLinkPage({
  params,
}: BioPageProps): Promise<React.JSX.Element> {
  const { slug } = await params
  const data = await resolveBioPage(slug)

  if (!data) {
    notFound()
  }

  return <BioPageRenderer data={data} />
}
