/**
 * @file modules/media/actions/media.action.ts
 * @module media
 * @description Server Actions Next.js pour la Media Library (galerie de médias).
 *
 *   Actions médias :
 *   - `listMedia(params?)`          — liste filtrée/triée/paginée avec folder et tags
 *   - `saveMedia(rawData)`          — sauvegarde les métadonnées après upload Supabase
 *   - `deleteMedia(id)`             — vérifie l'ownership, supprime Storage + DB
 *   - `updateMedia(rawData)`        — met à jour folderId et/ou tags d'un média
 *
 *   Actions dossiers :
 *   - `listFolders()`               — liste tous les dossiers avec compteur de médias
 *   - `createFolder(name)`          — crée un nouveau dossier
 *   - `deleteFolder(id)`            — supprime un dossier (médias → folderId = null)
 *
 *   Actions tags :
 *   - `listTags()`                  — liste tous les tags de l'utilisateur
 *   - `createTag(name, color)`      — crée un nouveau tag coloré
 *   - `deleteTag(id)`               — supprime un tag
 *
 *   Chaque action authentifie l'utilisateur via better-auth (headers()) et
 *   retourne une structure { data?, error? } pour gérer les erreurs côté client.
 *
 * @example
 *   // Utilisation dans un Client Component
 *   const { data, error } = await listMedia({ type: 'image', sortBy: 'newest' })
 *   const { data: folder } = await createFolder('Campagne été')
 *   const { data: tag } = await createTag('Promo', '#f59e0b')
 */

'use server'

import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createServiceClient } from '@/lib/supabase/server'
import type { MediaItem, MediaPage, MediaFolder, MediaTag, MediaSortBy, MediaTypeFilter } from '@/modules/media/types'
import {
  MediaDeleteSchema,
  MediaSaveSchema,
  MediaUpdateSchema,
  MediaFolderCreateSchema,
  MediaTagCreateSchema,
} from '@/modules/media/schemas/media.schema'

// ─── Constantes ───────────────────────────────────────────────────────────────

/** Nombre d'items par page pour la pagination de la galerie */
const PAGE_SIZE = 40

/** Bucket Supabase Storage contenant les médias */
const MEDIA_BUCKET = 'post-media'

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Extrait le chemin (path) d'un fichier Supabase depuis son URL publique.
 * Nécessaire pour appeler storage.remove() lors de la suppression.
 *
 * @param url - URL publique du fichier (ex: https://…/storage/v1/object/public/post-media/userId/gallery/file.jpg)
 * @returns Chemin relatif dans le bucket (ex: "userId/gallery/file.jpg")
 *
 * @example
 *   extractSupabasePath('https://proj.supabase.co/storage/v1/object/public/post-media/u1/gallery/f.jpg')
 *   // → 'u1/gallery/f.jpg'
 */
function extractSupabasePath(url: string): string {
  // Sépare sur "/post-media/" et prend ce qui suit
  const marker = `/${MEDIA_BUCKET}/`
  const idx = url.indexOf(marker)
  if (idx === -1) return url
  return url.slice(idx + marker.length)
}

/**
 * Construit la clause `orderBy` Prisma selon le critère de tri choisi.
 *
 * @param sortBy - Critère de tri (newest | oldest | name | size)
 * @returns Objet orderBy compatible avec Prisma
 */
function buildOrderBy(sortBy: MediaSortBy): object {
  switch (sortBy) {
    case 'oldest': return { createdAt: 'asc' }
    case 'name':   return { filename: 'asc' }
    case 'size':   return { size: 'desc' }
    case 'newest':
    default:       return { createdAt: 'desc' }
  }
}

// ─── Actions médias ───────────────────────────────────────────────────────────

/**
 * Liste les médias de l'utilisateur connecté avec filtres et pagination par curseur.
 *
 * @param params.cursor      - ID du dernier item de la page précédente (undefined = première page)
 * @param params.folderId    - Filtrer par dossier (null = sans dossier, undefined = tous)
 * @param params.type        - Filtrer par type : 'all' | 'image' | 'video'
 * @param params.tagId       - Filtrer par tag (ID du tag)
 * @param params.sortBy      - Critère de tri (newest | oldest | name | size)
 * @param params.limit       - Nombre d'items par page (défaut : 40)
 * @returns `{ data: MediaPage }` ou `{ error: string }`
 *
 * @example
 *   // Première page, images seulement, triées par nom
 *   const { data } = await listMedia({ type: 'image', sortBy: 'name' })
 *   // Page suivante dans un dossier spécifique
 *   const { data } = await listMedia({ cursor: data.nextCursor, folderId: 'clf123' })
 */
export async function listMedia(params?: {
  cursor?: string
  folderId?: string | null
  type?: MediaTypeFilter
  tagId?: string
  sortBy?: MediaSortBy
  limit?: number
}): Promise<{ data?: MediaPage; error?: string }> {
  // ── Authentification ──────────────────────────────────────────────────────
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return { error: 'Non authentifié' }

  const {
    cursor,
    folderId,
    type = 'all',
    tagId,
    sortBy = 'newest',
    limit = PAGE_SIZE,
  } = params ?? {}

  try {
    // ── Construction des filtres WHERE ────────────────────────────────────
    const where: Record<string, unknown> = { userId: session.user.id }

    // Filtre dossier : null = sans dossier, string = dossier spécifique
    if (folderId !== undefined) {
      where.folderId = folderId
    }

    // Filtre type MIME
    if (type === 'image') {
      where.mimeType = { startsWith: 'image/' }
    } else if (type === 'video') {
      where.mimeType = { startsWith: 'video/' }
    }

    // Filtre par tag (many-to-many via relation tags)
    if (tagId) {
      where.tags = { some: { id: tagId } }
    }

    // ── Requête paginée par curseur ────────────────────────────────────────
    // On récupère limit+1 items pour savoir s'il y a une page suivante.
    const items = await prisma.media.findMany({
      where,
      orderBy: buildOrderBy(sortBy),
      take: limit + 1,
      // Si cursor fourni, on reprend APRÈS le curseur (skip le curseur lui-même)
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      // Inclure le dossier et les tags dans le résultat
      include: {
        folder: true,
        tags: true,
      },
    })

    // ── Déterminer s'il y a une page suivante ─────────────────────────────
    const hasNextPage = items.length > limit
    const pageItems = hasNextPage ? items.slice(0, limit) : items

    return {
      data: {
        items: pageItems as unknown as MediaItem[],
        nextCursor: hasNextPage ? (pageItems[pageItems.length - 1]?.id ?? null) : null,
      },
    }
  } catch (err) {
    console.error('[listMedia] Erreur DB :', err)
    return { error: 'Impossible de charger la galerie' }
  }
}

/**
 * Sauvegarde les métadonnées d'un média après son upload réussi vers Supabase Storage.
 * À appeler côté client une fois le PUT vers le presigned URL réussi.
 *
 * @param rawData - Données brutes à valider avec MediaSaveSchema
 * @returns `{ data: MediaItem }` ou `{ error: string }`
 *
 * @example
 *   const { data, error } = await saveMedia({
 *     url: 'https://…/post-media/userId/gallery/1710000000000-photo.jpg',
 *     filename: 'photo.jpg',
 *     mimeType: 'image/jpeg',
 *     size: 204800,
 *   })
 */
export async function saveMedia(
  rawData: unknown,
): Promise<{ data?: MediaItem; error?: string }> {
  // ── Authentification ──────────────────────────────────────────────────────
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return { error: 'Non authentifié' }

  // ── Validation Zod ────────────────────────────────────────────────────────
  const parsed = MediaSaveSchema.safeParse(rawData)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Données invalides' }
  }

  const { url, filename, mimeType, size } = parsed.data

  try {
    // ── Création de l'entrée en DB ────────────────────────────────────────
    const media = await prisma.media.create({
      data: {
        userId: session.user.id,
        url,
        filename,
        mimeType,
        size,
      },
      // Inclure folder et tags (vides à la création)
      include: { folder: true, tags: true },
    })

    // Revalidation de la page galerie pour le cache Next.js
    revalidatePath('/gallery')

    return { data: media as unknown as MediaItem }
  } catch (err) {
    console.error('[saveMedia] Erreur DB :', err)
    return { error: "Impossible d'enregistrer le média" }
  }
}

/**
 * Supprime un média : vérifie l'ownership, efface le fichier de Supabase Storage
 * puis supprime l'entrée en DB.
 *
 * @param id - Identifiant unique du média à supprimer
 * @returns `{}` (succès) ou `{ error: string }`
 *
 * @example
 *   const { error } = await deleteMedia('clx123abc')
 *   if (error) console.error(error)
 */
export async function deleteMedia(
  id: string,
): Promise<{ error?: string }> {
  // ── Authentification ──────────────────────────────────────────────────────
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return { error: 'Non authentifié' }

  // ── Validation ────────────────────────────────────────────────────────────
  const parsed = MediaDeleteSchema.safeParse({ id })
  if (!parsed.success) return { error: "ID invalide" }

  try {
    // ── Vérification ownership ────────────────────────────────────────────
    const media = await prisma.media.findUnique({ where: { id } })
    if (!media) return { error: 'Média introuvable' }
    if (media.userId !== session.user.id) return { error: 'Accès refusé' }

    // ── Suppression du fichier dans Supabase Storage ──────────────────────
    const supabase = createServiceClient()
    const storagePath = extractSupabasePath(media.url)

    const { error: storageError } = await supabase.storage
      .from(MEDIA_BUCKET)
      .remove([storagePath])

    // On log l'erreur Storage mais on continue la suppression DB
    // (le fichier peut être déjà supprimé ou le chemin incorrect)
    if (storageError) {
      console.warn('[deleteMedia] Avertissement Storage :', storageError.message)
    }

    // ── Suppression de l'entrée en DB ─────────────────────────────────────
    await prisma.media.delete({ where: { id } })

    // Revalidation de la page galerie
    revalidatePath('/gallery')

    return {}
  } catch (err) {
    console.error('[deleteMedia] Erreur :', err)
    return { error: 'Impossible de supprimer le média' }
  }
}

/**
 * Met à jour le dossier et/ou les tags d'un média.
 * Le tableau tagIds remplace entièrement les tags existants (set, pas append).
 *
 * @param rawData - Données à valider avec MediaUpdateSchema
 * @returns `{ data: MediaItem }` ou `{ error: string }`
 *
 * @example
 *   // Déplacer un média dans un dossier + ajouter des tags
 *   const { data } = await updateMedia({ id: 'clx123', folderId: 'clf456', tagIds: ['clt789'] })
 *   // Retirer le média de tout dossier
 *   const { data } = await updateMedia({ id: 'clx123', folderId: null })
 */
export async function updateMedia(
  rawData: unknown,
): Promise<{ data?: MediaItem; error?: string }> {
  // ── Authentification ──────────────────────────────────────────────────────
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return { error: 'Non authentifié' }

  // ── Validation Zod ────────────────────────────────────────────────────────
  const parsed = MediaUpdateSchema.safeParse(rawData)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Données invalides' }
  }

  const { id, folderId, tagIds } = parsed.data

  try {
    // ── Vérification ownership ────────────────────────────────────────────
    const existing = await prisma.media.findUnique({ where: { id } })
    if (!existing) return { error: 'Média introuvable' }
    if (existing.userId !== session.user.id) return { error: 'Accès refusé' }

    // ── Mise à jour ───────────────────────────────────────────────────────
    const media = await prisma.media.update({
      where: { id },
      data: {
        // Ne mettre à jour folderId que si explicitement fourni
        ...(folderId !== undefined && { folderId }),
        // Remplacer les tags si tagIds fourni (set = remplace entièrement)
        ...(tagIds !== undefined && {
          tags: { set: tagIds.map((tagId) => ({ id: tagId })) },
        }),
      },
      include: { folder: true, tags: true },
    })

    revalidatePath('/gallery')

    return { data: media as unknown as MediaItem }
  } catch (err) {
    console.error('[updateMedia] Erreur :', err)
    return { error: 'Impossible de mettre à jour le média' }
  }
}

// ─── Actions dossiers ─────────────────────────────────────────────────────────

/**
 * Liste tous les dossiers de l'utilisateur connecté, avec le nombre de médias dans chacun.
 *
 * @returns `{ data: MediaFolder[] }` ou `{ error: string }`
 *
 * @example
 *   const { data: folders } = await listFolders()
 *   // folders[0]._count.media → 12
 */
export async function listFolders(): Promise<{ data?: MediaFolder[]; error?: string }> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return { error: 'Non authentifié' }

  try {
    const folders = await prisma.mediaFolder.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: 'asc' },
      // Compter le nombre de médias dans chaque dossier
      include: { _count: { select: { media: true } } },
    })

    return { data: folders as unknown as MediaFolder[] }
  } catch (err) {
    console.error('[listFolders] Erreur :', err)
    return { error: 'Impossible de charger les dossiers' }
  }
}

/**
 * Crée un nouveau dossier de galerie pour l'utilisateur connecté.
 *
 * @param name - Nom du dossier (1–50 caractères)
 * @returns `{ data: MediaFolder }` ou `{ error: string }`
 *
 * @example
 *   const { data, error } = await createFolder('Campagne Printemps')
 */
export async function createFolder(name: string): Promise<{ data?: MediaFolder; error?: string }> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return { error: 'Non authentifié' }

  // ── Validation Zod ────────────────────────────────────────────────────────
  const parsed = MediaFolderCreateSchema.safeParse({ name })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Nom invalide' }
  }

  try {
    const folder = await prisma.mediaFolder.create({
      data: { userId: session.user.id, name: parsed.data.name },
      include: { _count: { select: { media: true } } },
    })

    revalidatePath('/gallery')

    return { data: folder as unknown as MediaFolder }
  } catch (err) {
    console.error('[createFolder] Erreur :', err)
    return { error: 'Impossible de créer le dossier' }
  }
}

/**
 * Supprime un dossier.
 * Les médias dans ce dossier ont leur folderId mis à null (Prisma onDelete: SetNull).
 *
 * @param id - Identifiant du dossier à supprimer
 * @returns `{}` (succès) ou `{ error: string }`
 *
 * @example
 *   const { error } = await deleteFolder('clf123')
 */
export async function deleteFolder(id: string): Promise<{ error?: string }> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return { error: 'Non authentifié' }

  try {
    // ── Vérification ownership ────────────────────────────────────────────
    const folder = await prisma.mediaFolder.findUnique({ where: { id } })
    if (!folder) return { error: 'Dossier introuvable' }
    if (folder.userId !== session.user.id) return { error: 'Accès refusé' }

    await prisma.mediaFolder.delete({ where: { id } })

    revalidatePath('/gallery')

    return {}
  } catch (err) {
    console.error('[deleteFolder] Erreur :', err)
    return { error: 'Impossible de supprimer le dossier' }
  }
}

// ─── Actions tags ─────────────────────────────────────────────────────────────

/**
 * Liste tous les tags de l'utilisateur connecté.
 *
 * @returns `{ data: MediaTag[] }` ou `{ error: string }`
 *
 * @example
 *   const { data: tags } = await listTags()
 */
export async function listTags(): Promise<{ data?: MediaTag[]; error?: string }> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return { error: 'Non authentifié' }

  try {
    const tags = await prisma.mediaTag.findMany({
      where: { userId: session.user.id },
      orderBy: { name: 'asc' },
    })

    return { data: tags as unknown as MediaTag[] }
  } catch (err) {
    console.error('[listTags] Erreur :', err)
    return { error: 'Impossible de charger les tags' }
  }
}

/**
 * Crée un nouveau tag coloré pour l'utilisateur connecté.
 *
 * @param name  - Nom du tag (1–30 caractères)
 * @param color - Couleur hexadécimale (ex: "#f59e0b")
 * @returns `{ data: MediaTag }` ou `{ error: string }`
 *
 * @example
 *   const { data } = await createTag('Été', '#f59e0b')
 */
export async function createTag(
  name: string,
  color: string,
): Promise<{ data?: MediaTag; error?: string }> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return { error: 'Non authentifié' }

  // ── Validation Zod ────────────────────────────────────────────────────────
  const parsed = MediaTagCreateSchema.safeParse({ name, color })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Données invalides' }
  }

  try {
    const tag = await prisma.mediaTag.create({
      data: {
        userId: session.user.id,
        name: parsed.data.name,
        color: parsed.data.color,
      },
    })

    revalidatePath('/gallery')

    return { data: tag as unknown as MediaTag }
  } catch (err) {
    // Erreur unicité : user + name déjà existant
    if ((err as { code?: string }).code === 'P2002') {
      return { error: `Un tag nommé "${name}" existe déjà` }
    }
    console.error('[createTag] Erreur :', err)
    return { error: 'Impossible de créer le tag' }
  }
}

/**
 * Supprime un tag.
 * Les relations avec les médias sont supprimées automatiquement (cascade Many-to-Many).
 *
 * @param id - Identifiant du tag à supprimer
 * @returns `{}` (succès) ou `{ error: string }`
 *
 * @example
 *   const { error } = await deleteTag('clt123')
 */
export async function deleteTag(id: string): Promise<{ error?: string }> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return { error: 'Non authentifié' }

  try {
    // ── Vérification ownership ────────────────────────────────────────────
    const tag = await prisma.mediaTag.findUnique({ where: { id } })
    if (!tag) return { error: 'Tag introuvable' }
    if (tag.userId !== session.user.id) return { error: 'Accès refusé' }

    await prisma.mediaTag.delete({ where: { id } })

    revalidatePath('/gallery')

    return {}
  } catch (err) {
    console.error('[deleteTag] Erreur :', err)
    return { error: 'Impossible de supprimer le tag' }
  }
}
