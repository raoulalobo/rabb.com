/**
 * @file modules/biolink/actions/delete-biolink.action.ts
 * @module biolink
 * @description Server Action — supprime un BioLink (cascade delete via Prisma).
 *
 *   Le schéma Prisma définit la relation BioLink → BioPage avec
 *   `onDelete: Cascade` : si une BioPage est supprimée tous ses liens disparaissent.
 *   Ici on supprime un lien individuel directement — rien à cascader côté BioPage.
 *
 *   Flux :
 *   1. Vérifie la session better-auth
 *   2. Vérifie l'ownership via BioLink → BioPage → userId
 *   3. Supprime la row
 *   4. Revalide /biolink et /u/{slug}
 *
 * @example
 *   const res = await deleteBioLink('clx123')
 *   if (!res.success) toast.error(res.error)
 */

'use server'

import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// ─── Action ───────────────────────────────────────────────────────────────────

/**
 * Supprime un BioLink. Vérifie l'ownership via la BioPage parente.
 *
 * @param id - Identifiant du BioLink à supprimer
 * @returns `{ success: true, data: { id: string } }` ou `{ success: false, error: string }`
 *
 * @example
 *   await deleteBioLink('clx123')
 */
export async function deleteBioLink(
  id: string,
): Promise<
  { success: true; data: { id: string } } | { success: false; error: string }
> {
  // ── Authentification ────────────────────────────────────────────────────────
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) {
    return { success: false, error: 'Non authentifié' }
  }

  if (!id || typeof id !== 'string') {
    return { success: false, error: 'ID invalide' }
  }

  try {
    // ── Ownership check via la BioPage parente ───────────────────────────────
    const existing = await prisma.bioLink.findFirst({
      where: {
        id,
        bioPage: { userId: session.user.id },
      },
      include: { bioPage: { select: { slug: true } } },
    })
    if (!existing) {
      return { success: false, error: 'Unauthorized' }
    }

    const slug = existing.bioPage.slug

    // ── Suppression ──────────────────────────────────────────────────────────
    await prisma.bioLink.delete({ where: { id } })

    // ── Revalidation ─────────────────────────────────────────────────────────
    revalidatePath('/biolink')
    revalidatePath(`/u/${slug}`)

    return { success: true, data: { id } }
  } catch (err) {
    console.error('[deleteBioLink] Erreur DB :', err)
    return { success: false, error: 'Impossible de supprimer le lien' }
  }
}
