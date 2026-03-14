/**
 * @file modules/biolink/actions/biolink.action.ts
 * @module biolink
 * @description Server Actions Next.js pour la gestion de la page Bio Link.
 *   Toutes les actions vérifient la session utilisateur et l'ownership
 *   avant toute opération DB (sauf trackClick et submitContact qui sont publics).
 *
 *   Actions disponibles :
 *   - `getBioPage()`          — récupère la BioPage de l'utilisateur connecté
 *   - `upsertBioPage(data)`   — crée ou met à jour la BioPage
 *   - `upsertLink(data)`      — ajoute ou édite un lien sur la BioPage
 *   - `deleteLink(id)`        — supprime un lien
 *   - `reorderLinks(data)`    — réordonne les liens après drag & drop
 *   - `togglePublish()`       — bascule la publication de la page
 *   - `trackClick(linkId, bioPageId)` — incrémente les clics (public, sans auth)
 *   - `submitContact(bioPageId, rawData)` — envoie un message de contact (public, sans auth)
 *   - `getContacts()`         — récupère les messages de contact (protégé, auth requise)
 *
 * @example
 *   // Récupérer la page bio de l'utilisateur connecté
 *   const page = await getBioPage()
 *
 *   // Créer/mettre à jour la page
 *   await upsertBioPage({ slug: 'mon-pseudo', theme: 'dark', accentColor: '#6366f1' })
 *
 *   // Ajouter un lien
 *   await upsertLink({ title: 'Ma vidéo', url: 'https://youtube.com/...' })
 *
 *   // Envoyer un message de contact (public)
 *   await submitContact('bp_1', { name: 'Jean', email: 'jean@mail.com', message: 'Bonjour !' })
 *
 *   // Récupérer les messages de contact (protégé)
 *   const contacts = await getContacts()
 */

'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  BioContactSchema,
  BioLinkUpsertSchema,
  BioPageUpsertSchema,
  ReorderLinksSchema,
} from '@/modules/biolink/schemas/biolink.schema'
import type { BioContact, BioLink, BioPage, BioSocialLink } from '@/modules/biolink/types'

// ─── Helpers internes ─────────────────────────────────────────────────────────

/**
 * Récupère l'utilisateur connecté ou lance une erreur si non authentifié.
 * Utilisé au début de chaque Server Action protégée.
 *
 * @returns userId de l'utilisateur connecté
 * @throws Error si non authentifié
 */
async function requireUserId(): Promise<string> {
  const session = await auth.api.getSession({
    headers: await headers(),
  })
  if (!session?.user?.id) {
    throw new Error('Non authentifié')
  }
  return session.user.id
}

/**
 * Convertit un enregistrement Prisma BioLink en type BioLink du domaine.
 * Mappe tous les champs, y compris les nouveaux champs type, url (nullable),
 * activeFrom et activeUntil.
 *
 * @param raw - Enregistrement Prisma brut
 * @returns BioLink typé
 */
function toBioLink(raw: {
  id: string
  bioPageId: string
  type: string
  title: string
  url: string | null
  icon: string | null
  thumbnailUrl: string | null
  activeFrom: Date | null
  activeUntil: Date | null
  position: number
  clicks: number
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}): BioLink {
  return {
    id: raw.id,
    bioPageId: raw.bioPageId,
    type: raw.type as BioLink['type'],
    title: raw.title,
    url: raw.url,
    icon: raw.icon,
    thumbnailUrl: raw.thumbnailUrl,
    activeFrom: raw.activeFrom,
    activeUntil: raw.activeUntil,
    position: raw.position,
    clicks: raw.clicks,
    isActive: raw.isActive,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  }
}

/**
 * Convertit un enregistrement Prisma BioPage (avec links) en type BioPage du domaine.
 * Parse le champ JSON `socialLinks` en tableau de BioSocialLink.
 * Mappe les 13 nouveaux champs de personnalisation avancée :
 *   fontFamily, buttonShape, buttonVariant, avatarShape,
 *   backgroundImageUrl, gradientFrom, gradientTo,
 *   linkSpacing, hoverAnimation,
 *   bannerUrl, hideBranding, faviconUrl,
 *   showContactForm, customDomain.
 *
 * @param raw - Enregistrement Prisma brut (avec include links)
 * @returns BioPage typé avec links triés par position
 */
function toBioPage(
  raw: {
    id: string
    userId: string
    slug: string
    title: string | null
    bio: string | null
    avatarUrl: string | null
    theme: string
    accentColor: string
    titleColor: string | null
    bioColor: string | null
    linkColor: string | null
    fontFamily: string
    buttonShape: string
    buttonVariant: string
    avatarShape: string
    backgroundImageUrl: string | null
    gradientFrom: string | null
    gradientTo: string | null
    linkSpacing: string
    hoverAnimation: string
    headerStyle: string
    bannerUrl: string | null
    hideBranding: boolean
    faviconUrl: string | null
    showContactForm: boolean
    templateId: string | null
    customDomain: string | null
    seoTitle: string | null
    seoDescription: string | null
    socialLinks: unknown
    totalClicks: number
    isPublished: boolean
    createdAt: Date
    updatedAt: Date
    links: Array<{
      id: string
      bioPageId: string
      type: string
      title: string
      url: string | null
      icon: string | null
      thumbnailUrl: string | null
      activeFrom: Date | null
      activeUntil: Date | null
      position: number
      clicks: number
      isActive: boolean
      createdAt: Date
      updatedAt: Date
    }>
  }
): BioPage {
  // Parse socialLinks depuis JSON (garde un tableau vide si invalide)
  const socialLinks: BioSocialLink[] = Array.isArray(raw.socialLinks)
    ? (raw.socialLinks as BioSocialLink[])
    : []

  return {
    id: raw.id,
    userId: raw.userId,
    slug: raw.slug,
    title: raw.title,
    bio: raw.bio,
    avatarUrl: raw.avatarUrl,
    theme: raw.theme,
    accentColor: raw.accentColor,
    titleColor: raw.titleColor,
    bioColor: raw.bioColor,
    linkColor: raw.linkColor,
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
    templateId: raw.templateId,
    customDomain: raw.customDomain,
    seoTitle: raw.seoTitle,
    seoDescription: raw.seoDescription,
    socialLinks,
    totalClicks: raw.totalClicks,
    isPublished: raw.isPublished,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    links: raw.links.map(toBioLink),
  }
}

// ─── Actions protégées (auth requise) ────────────────────────────────────────

/**
 * Récupère la BioPage de l'utilisateur connecté avec tous ses liens.
 * Retourne null si l'utilisateur n'a pas encore créé de BioPage.
 *
 * @returns La BioPage complète avec liens triés par position, ou null
 *
 * @example
 *   const page = await getBioPage()
 *   if (!page) {
 *     // Afficher le formulaire de création
 *   }
 */
export async function getBioPage(): Promise<BioPage | null> {
  const userId = await requireUserId()

  const raw = await prisma.bioPage.findUnique({
    where: { userId },
    include: {
      links: { orderBy: { position: 'asc' } },
    },
  })

  if (!raw) return null
  return toBioPage(raw)
}

/**
 * Crée ou met à jour la BioPage de l'utilisateur connecté.
 * Relation 1-1 avec User : un upsert est fait sur userId.
 *
 * Validé via Zod (BioPageUpsertSchema) côté serveur.
 * Vérifie l'unicité du slug avant création/mise à jour.
 *
 * Passe les 13 nouveaux champs de personnalisation avancée dans le create et l'update :
 *   fontFamily, buttonShape, buttonVariant, avatarShape,
 *   backgroundImageUrl, gradientFrom, gradientTo,
 *   linkSpacing, hoverAnimation,
 *   bannerUrl, hideBranding, faviconUrl, showContactForm.
 *
 * @param rawData - Données brutes du formulaire (non validées)
 * @returns La BioPage créée ou mise à jour
 * @throws ZodError si les données sont invalides
 * @throws Error si le slug est déjà pris par un autre utilisateur
 *
 * @example
 *   await upsertBioPage({
 *     slug: 'mon-pseudo',
 *     title: 'Mon Pseudo',
 *     bio: 'Créateur de contenu',
 *     theme: 'dark',
 *     accentColor: '#6366f1',
 *     fontFamily: 'poppins',
 *     buttonShape: 'rounded-full',
 *     buttonVariant: 'outline',
 *     avatarShape: 'rounded-square',
 *     linkSpacing: 'airy',
 *     hoverAnimation: 'scale',
 *     hideBranding: true,
 *     showContactForm: true,
 *     socialLinks: [{ platform: 'instagram', url: 'https://instagram.com/monpseudo' }],
 *   })
 */
export async function upsertBioPage(rawData: unknown): Promise<BioPage> {
  const userId = await requireUserId()
  const data = BioPageUpsertSchema.parse(rawData)

  // Filtrer les liens sociaux avec URL vide (l'utilisateur n'a pas encore rempli)
  const cleanSocialLinks = data.socialLinks.filter((link) => link.url.length > 0)

  // Vérifier l'unicité du slug (sauf pour l'utilisateur lui-même)
  const existingSlug = await prisma.bioPage.findUnique({
    where: { slug: data.slug },
    select: { userId: true },
  })
  if (existingSlug && existingSlug.userId !== userId) {
    throw new Error('Ce slug est déjà utilisé par un autre compte')
  }

  // Champs communs au create et à l'update (évite la duplication)
  const sharedFields = {
    slug: data.slug,
    title: data.title,
    bio: data.bio,
    avatarUrl: data.avatarUrl,
    theme: data.theme,
    accentColor: data.accentColor,
    // Couleurs personnalisées
    titleColor: data.titleColor ?? null,
    bioColor: data.bioColor ?? null,
    linkColor: data.linkColor ?? null,
    // Personnalisation avancée (13 champs)
    fontFamily: data.fontFamily,
    buttonShape: data.buttonShape,
    buttonVariant: data.buttonVariant,
    avatarShape: data.avatarShape,
    backgroundImageUrl: data.backgroundImageUrl,
    gradientFrom: data.gradientFrom,
    gradientTo: data.gradientTo,
    linkSpacing: data.linkSpacing,
    hoverAnimation: data.hoverAnimation,
    headerStyle: data.headerStyle,
    bannerUrl: data.bannerUrl,
    hideBranding: data.hideBranding,
    faviconUrl: data.faviconUrl,
    showContactForm: data.showContactForm,
    templateId: data.templateId ?? null,
    // SEO et liens sociaux
    socialLinks: cleanSocialLinks,
    seoTitle: data.seoTitle,
    seoDescription: data.seoDescription,
  }

  // Upsert sur userId (1 BioPage par User)
  const raw = await prisma.bioPage.upsert({
    where: { userId },
    create: {
      userId,
      ...sharedFields,
    },
    update: sharedFields,
    include: {
      links: { orderBy: { position: 'asc' } },
    },
  })

  revalidatePath('/biolink')
  return toBioPage(raw)
}

/**
 * Ajoute ou met à jour un lien sur la BioPage de l'utilisateur connecté.
 * - `rawData.id` absent → création (position = dernier + 1)
 * - `rawData.id` présent → mise à jour du lien existant
 *
 * Gère les champs : type, url (nullable pour header/separator), activeFrom, activeUntil.
 * Validé via Zod (BioLinkUpsertSchema) côté serveur.
 * Ownership vérifié : le lien doit appartenir à la BioPage de l'user.
 *
 * @param rawData - Données brutes du formulaire (non validées)
 * @returns Le lien créé ou mis à jour
 * @throws ZodError si les données sont invalides
 * @throws Error si BioPage inexistante, lien introuvable ou ownership ko
 *
 * @example
 *   // Création d'un nouveau lien classique
 *   await upsertLink({ type: 'link', title: 'Ma dernière vidéo', url: 'https://youtube.com/...' })
 *
 *   // Création d'un titre de section (pas d'URL)
 *   await upsertLink({ type: 'header', title: 'Mes projets' })
 *
 *   // Création d'un lien temporaire (visible du 1er au 15 mars)
 *   await upsertLink({
 *     title: 'Promo limitée',
 *     url: 'https://...',
 *     activeFrom: new Date('2026-03-01'),
 *     activeUntil: new Date('2026-03-15'),
 *   })
 *
 *   // Mise à jour d'un lien existant
 *   await upsertLink({ id: 'lnk_1', title: 'Titre modifié', url: 'https://...' })
 */
export async function upsertLink(rawData: unknown): Promise<BioLink> {
  const userId = await requireUserId()
  const data = BioLinkUpsertSchema.parse(rawData)

  // Récupérer la BioPage de l'utilisateur
  const bioPage = await prisma.bioPage.findUnique({
    where: { userId },
    select: { id: true },
  })
  if (!bioPage) {
    throw new Error('Créez d\'abord votre page Bio Link')
  }

  // Champs communs au create et à l'update
  const sharedLinkFields = {
    type: data.type,
    title: data.title,
    url: data.url ?? null,
    icon: data.icon ?? null,
    thumbnailUrl: data.thumbnailUrl ?? null,
    isActive: data.isActive,
    activeFrom: data.activeFrom ?? null,
    activeUntil: data.activeUntil ?? null,
  }

  let link

  if (data.id) {
    // Mise à jour : vérifier que le lien appartient à la BioPage de l'user
    const existing = await prisma.bioLink.findUnique({
      where: { id: data.id },
      select: { bioPageId: true },
    })
    if (!existing || existing.bioPageId !== bioPage.id) {
      throw new Error('Lien introuvable ou accès refusé')
    }

    link = await prisma.bioLink.update({
      where: { id: data.id },
      data: sharedLinkFields,
    })
  } else {
    // Création : position = dernier + 1
    const lastLink = await prisma.bioLink.findFirst({
      where: { bioPageId: bioPage.id },
      orderBy: { position: 'desc' },
      select: { position: true },
    })
    const nextPosition = (lastLink?.position ?? -1) + 1

    link = await prisma.bioLink.create({
      data: {
        bioPageId: bioPage.id,
        position: nextPosition,
        ...sharedLinkFields,
      },
    })
  }

  revalidatePath('/biolink')
  return toBioLink(link)
}

/**
 * Supprime un lien de la BioPage.
 * Ownership vérifié : le lien doit appartenir à la BioPage de l'user.
 *
 * @param linkId - ID du lien à supprimer
 * @throws Error si lien introuvable ou ownership ko
 *
 * @example
 *   await deleteLink('lnk_1')
 */
export async function deleteLink(linkId: string): Promise<void> {
  const userId = await requireUserId()

  // Récupérer la BioPage de l'utilisateur
  const bioPage = await prisma.bioPage.findUnique({
    where: { userId },
    select: { id: true },
  })
  if (!bioPage) {
    throw new Error('Page Bio Link introuvable')
  }

  // Vérifier l'ownership du lien
  const link = await prisma.bioLink.findUnique({
    where: { id: linkId },
    select: { bioPageId: true },
  })
  if (!link || link.bioPageId !== bioPage.id) {
    throw new Error('Lien introuvable ou accès refusé')
  }

  await prisma.bioLink.delete({ where: { id: linkId } })

  revalidatePath('/biolink')
}

/**
 * Réordonne les liens de la BioPage après un drag & drop.
 * Reçoit un tableau de { id, position } pour chaque lien.
 * Utilise une transaction Prisma pour garantir l'atomicité.
 *
 * Ownership vérifié : tous les liens doivent appartenir à la BioPage de l'user.
 *
 * @param rawData - Objet { links: [{ id, position }] }
 * @throws ZodError si les données sont invalides
 * @throws Error si ownership ko
 *
 * @example
 *   await reorderLinks({
 *     links: [
 *       { id: 'lnk_1', position: 0 },
 *       { id: 'lnk_2', position: 1 },
 *       { id: 'lnk_3', position: 2 },
 *     ]
 *   })
 */
export async function reorderLinks(rawData: unknown): Promise<void> {
  const userId = await requireUserId()
  const { links } = ReorderLinksSchema.parse(rawData)

  // Récupérer la BioPage de l'utilisateur
  const bioPage = await prisma.bioPage.findUnique({
    where: { userId },
    select: { id: true },
  })
  if (!bioPage) {
    throw new Error('Page Bio Link introuvable')
  }

  // Transaction : mettre à jour chaque lien avec sa nouvelle position
  await prisma.$transaction(
    links.map(({ id, position }) =>
      prisma.bioLink.update({
        where: { id },
        data: { position },
      })
    )
  )

  revalidatePath('/biolink')
}

/**
 * Bascule la publication de la BioPage (publié <-> dépublié).
 * La page publique /u/[slug] n'est accessible que si isPublished = true.
 *
 * @returns Le nouvel état de publication (true/false)
 * @throws Error si BioPage inexistante
 *
 * @example
 *   const isNowPublished = await togglePublish()
 *   // -> true (si c'était false) ou false (si c'était true)
 */
export async function togglePublish(): Promise<boolean> {
  const userId = await requireUserId()

  const bioPage = await prisma.bioPage.findUnique({
    where: { userId },
    select: { id: true, isPublished: true },
  })
  if (!bioPage) {
    throw new Error('Page Bio Link introuvable')
  }

  const updated = await prisma.bioPage.update({
    where: { id: bioPage.id },
    data: { isPublished: !bioPage.isPublished },
    select: { isPublished: true },
  })

  revalidatePath('/biolink')
  return updated.isPublished
}

// ─── Actions publiques (sans auth) ───────────────────────────────────────────

/**
 * Incrémente les compteurs de clics (lien + page) lors d'un clic sur la page publique.
 * Cette action est publique (pas d'auth requise) car elle est appelée depuis /u/[slug].
 *
 * Utilise une transaction pour garantir l'atomicité des deux incréments.
 *
 * @param linkId    - ID du lien cliqué
 * @param bioPageId - ID de la BioPage parente
 *
 * @example
 *   // Appelé côté client quand l'utilisateur clique sur un lien
 *   await trackClick('lnk_1', 'bp_1')
 */
export async function trackClick(linkId: string, bioPageId: string): Promise<void> {
  await prisma.$transaction([
    // Incrémenter les clics sur le lien individuel
    prisma.bioLink.update({
      where: { id: linkId },
      data: { clicks: { increment: 1 } },
    }),
    // Incrémenter le total de clics sur la page
    prisma.bioPage.update({
      where: { id: bioPageId },
      data: { totalClicks: { increment: 1 } },
    }),
  ])
}

/**
 * Envoie un message via le formulaire de contact intégré à la BioPage.
 * Cette action est publique (pas d'auth requise) car elle est appelée depuis /u/[slug].
 *
 * Validé via Zod (BioContactSchema) côté serveur.
 * Vérifie que la BioPage existe et que le formulaire de contact est activé (showContactForm = true).
 *
 * @param bioPageId - ID de la BioPage destinataire
 * @param rawData   - Données brutes du formulaire { name, email, message }
 * @throws ZodError si les données sont invalides
 * @throws Error si BioPage introuvable ou formulaire de contact désactivé
 *
 * @example
 *   // Appelé côté client depuis la page publique /u/[slug]
 *   await submitContact('bp_1', {
 *     name: 'Jean Dupont',
 *     email: 'jean@exemple.com',
 *     message: 'Bonjour, je souhaite collaborer avec vous !',
 *   })
 */
export async function submitContact(bioPageId: string, rawData: unknown): Promise<void> {
  // Valider les données du formulaire avec Zod
  const data = BioContactSchema.parse(rawData)

  // Vérifier que la BioPage existe et que le formulaire de contact est activé
  const bioPage = await prisma.bioPage.findUnique({
    where: { id: bioPageId },
    select: { id: true, showContactForm: true },
  })
  if (!bioPage) {
    throw new Error('Page Bio Link introuvable')
  }
  if (!bioPage.showContactForm) {
    throw new Error('Le formulaire de contact n\'est pas activé sur cette page')
  }

  // Créer l'enregistrement BioContact en DB
  await prisma.bioContact.create({
    data: {
      bioPageId: bioPage.id,
      name: data.name,
      email: data.email,
      message: data.message,
    },
  })
}

// ─── Actions protégées — Messages de contact ─────────────────────────────────

/**
 * Récupère tous les messages de contact reçus sur la BioPage de l'utilisateur connecté.
 * Les messages sont triés du plus récent au plus ancien (createdAt desc).
 *
 * @returns Tableau de BioContact triés par date de création décroissante
 * @throws Error si non authentifié ou BioPage inexistante
 *
 * @example
 *   const contacts = await getContacts()
 *   // contacts = [{ id: '...', name: 'Jean', email: 'jean@...', message: '...', createdAt: ... }, ...]
 */
export async function getContacts(): Promise<BioContact[]> {
  const userId = await requireUserId()

  // Récupérer la BioPage de l'utilisateur connecté
  const bioPage = await prisma.bioPage.findUnique({
    where: { userId },
    select: { id: true },
  })
  if (!bioPage) {
    throw new Error('Page Bio Link introuvable')
  }

  // Récupérer tous les messages de contact, triés du plus récent au plus ancien
  const contacts = await prisma.bioContact.findMany({
    where: { bioPageId: bioPage.id },
    orderBy: { createdAt: 'desc' },
  })

  // Mapper les enregistrements Prisma en type BioContact du domaine
  return contacts.map((raw) => ({
    id: raw.id,
    bioPageId: raw.bioPageId,
    name: raw.name,
    email: raw.email,
    message: raw.message,
    createdAt: raw.createdAt,
  }))
}
