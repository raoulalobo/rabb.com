/**
 * @file modules/media/actions/media.action.ts
 * @module media
 * @description Server Actions Next.js pour la Galerie de médias.
 *
 *   Expose trois actions :
 *   - `listMedia(cursor?, limit?)` — liste paginée (40 items, tri createdAt DESC)
 *   - `saveMedia(rawData)`         — sauvegarde les métadonnées après upload Supabase
 *   - `deleteMedia(id)`            — vérifie l'ownership, supprime Storage + DB
 *
 *   Chaque action authentifie l'utilisateur via better-auth (headers()) et
 *   retourne une structure { data?, error? } pour gérer les erreurs côté client.
 *
 * @example
 *   // Dans un Client Component
 *   const { data, error } = await listMedia()
 *   const { error } = await saveMedia({ url, filename, mimeType, size })
 *   const { error } = await deleteMedia('clx123')
 */

'use server'

import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createServiceClient } from '@/lib/supabase/server'
import type { MediaItem, MediaPage } from '@/modules/media/types'
import { MediaDeleteSchema, MediaSaveSchema } from '@/modules/media/schemas/media.schema'

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

// ─── Actions ──────────────────────────────────────────────────────────────────

/**
 * Liste les médias de l'utilisateur connecté avec pagination par curseur.
 * Tri : createdAt DESC (les plus récents en premier).
 *
 * @param cursor - ID du dernier item de la page précédente (undefined = première page)
 * @param limit  - Nombre d'items par page (défaut : 40)
 * @returns `{ data: MediaPage }` ou `{ error: string }`
 *
 * @example
 *   // Première page
 *   const { data } = await listMedia()
 *   // Page suivante
 *   const { data } = await listMedia(data.nextCursor)
 */
export async function listMedia(
  cursor?: string,
  limit = PAGE_SIZE,
): Promise<{ data?: MediaPage; error?: string }> {
  // ── Authentification ──────────────────────────────────────────────────────
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return { error: 'Non authentifié' }

  try {
    // ── Requête paginée par curseur ────────────────────────────────────────
    // On récupère limit+1 items pour savoir s'il y a une page suivante.
    const items = await prisma.media.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      // Si cursor fourni, on reprend APRÈS le curseur (skip le curseur lui-même)
      ...(cursor
        ? { cursor: { id: cursor }, skip: 1 }
        : {}),
    })

    // ── Déterminer s'il y a une page suivante ─────────────────────────────
    const hasNextPage = items.length > limit
    const pageItems = hasNextPage ? items.slice(0, limit) : items

    return {
      data: {
        // Prisma retourne des objets avec des types compatibles — on cast explicitement
        items: pageItems as MediaItem[],
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
    })

    // Revalidation de la page galerie pour le cache Next.js
    revalidatePath('/gallery')

    return { data: media as MediaItem }
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
