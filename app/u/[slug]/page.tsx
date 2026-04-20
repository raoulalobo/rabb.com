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
 *   elles retourneront 404 ici.
 *
 *   **Mode preview (`?preview=1`)** :
 *   Permet au propriétaire d'une BioPage de visualiser son brouillon
 *   (isPublished=false) avant de la publier. Déclenché via le query param
 *   `preview=1`. Vérifie obligatoirement :
 *   1. Qu'une session existe (auth.api.getSession)
 *   2. Que l'utilisateur authentifié est bien le propriétaire (bioPage.userId === session.user.id)
 *   → sinon `notFound()` (on ne révèle pas l'existence du brouillon aux tiers).
 *
 * @example
 *   // URL : https://socialtdl.net/u/mimisara → mock démo
 *   // URL : https://socialtdl.net/u/marie    → Prisma query → 404 si absent
 *   // URL : https://socialtdl.net/u/marie?preview=1 → 200 si propriétaire, 404 sinon
 */

import { headers } from 'next/headers'
import { notFound } from 'next/navigation'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { BioPageRenderer } from '@/modules/biolink/components/BioPageRenderer'
import { mapBioPageToData } from '@/modules/biolink/mappers'
import { MIMI_SARA_MOCK } from '@/modules/biolink/mock-data'

import type { BioPageData } from '@/modules/biolink/types'
import type { Metadata } from 'next'

// ─── Params du segment dynamique ─────────────────────────────────────────────

/**
 * Props injectées par Next.js — `params.slug` vient de l'URL `/u/[slug]`.
 * Next.js 16 : `params` et `searchParams` sont des Promises (async dynamic APIs).
 */
interface BioPageProps {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ preview?: string }>
}

/** Slug réservé pour la démo figée (bypass DB). */
const DEMO_SLUG = 'mimisara'

// ─── Résolution des données (mock démo ou DB) ────────────────────────────────

/**
 * Résout une BioPageData depuis le slug — démo figée ou DB.
 * Retourne `null` si aucune source ne correspond (caller : notFound()).
 *
 * @param slug - Valeur du segment dynamique `/u/[slug]`
 * @param options - `preview` active le mode preview (charge les brouillons mais
 *                  nécessite une vérification d'ownership par l'appelant).
 * @returns Données pour `<BioPageRenderer />` ou `null`
 */
async function resolveBioPage(
  slug: string,
  options: { preview?: boolean } = {},
): Promise<BioPageData | null> {
  // Démo figée : /u/mimisara toujours dispo, même sans DB
  if (slug === DEMO_SLUG) return MIMI_SARA_MOCK

  // Construction du filtre : en mode preview on ignore isPublished pour
  // charger aussi les brouillons (l'ownership check est fait dans le caller).
  const where = options.preview
    ? { slug }
    : { slug, isPublished: true }

  // Pour tout autre slug → Prisma query
  const row = await prisma.bioPage.findFirst({
    where,
    include: {
      links: {
        // En preview : on affiche aussi les liens inactifs pour que l'user
        // voie exactement ce qu'il a configuré.
        where: options.preview ? undefined : { isActive: true },
        orderBy: { position: 'asc' },
      },
    },
  })

  if (!row) return null
  return mapBioPageToData(row)
}

/**
 * Vérifie que l'utilisateur courant est bien propriétaire du slug donné
 * (utilisé uniquement en mode preview pour éviter de révéler un brouillon).
 *
 * @param slug - Slug de la BioPage
 * @returns `true` si session.user.id === bioPage.userId, `false` sinon.
 */
async function isOwnerOfSlug(slug: string): Promise<boolean> {
  // Slug démo : n'importe qui peut le preview (c'est un mock public déjà servi)
  if (slug === DEMO_SLUG) return true

  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user?.id) return false

  // On récupère uniquement userId pour minimiser la fuite de données
  const row = await prisma.bioPage.findFirst({
    where: { slug },
    select: { userId: true },
  })
  return row?.userId === session.user.id
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
  // generateMetadata ne lit pas searchParams → on utilise toujours le
  // filtre publication. L'éventuelle absence de data retournera les
  // metadata "Page introuvable" (OK : robots ne voient pas les brouillons).
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
  searchParams,
}: BioPageProps): Promise<React.JSX.Element> {
  const { slug } = await params
  const { preview } = await searchParams

  // Mode preview activé quand ?preview=1 est explicitement passé dans l'URL
  const isPreview = preview === '1'

  // En preview : on vérifie d'abord l'ownership AVANT de charger les données,
  // pour éviter toute fuite d'info sur l'existence d'un brouillon.
  if (isPreview) {
    const owner = await isOwnerOfSlug(slug)
    if (!owner) {
      notFound()
    }
  }

  const data = await resolveBioPage(slug, { preview: isPreview })

  if (!data) {
    notFound()
  }

  return <BioPageRenderer data={data} />
}
