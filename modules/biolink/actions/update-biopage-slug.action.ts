/**
 * @file modules/biolink/actions/update-biopage-slug.action.ts
 * @module biolink
 * @description Server Action — met à jour le slug d'une BioPage avec gestion
 *   spécifique de l'erreur d'unicité (P2002 Prisma = slug déjà pris).
 *
 *   Le slug est le chemin public `/u/{slug}` — il doit être unique globalement.
 *   En cas de collision, on retourne un message d'erreur clair en français
 *   pour que l'éditeur puisse afficher un badge rouge ✗ à côté du champ.
 *
 *   Revalide /biolink et /u/{ancien-slug} + /u/{nouveau-slug}.
 *
 * @example
 *   const res = await updateBioPageSlug('mimisara')
 *   if (!res.success && res.error === 'Ce slug est déjà pris') showSlugTakenBadge()
 */

'use server'

import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { BioPageInfosSchema } from '@/modules/biolink/schemas/biopage.schema'

import type { BioPage } from '@prisma/client'

// ─── Action ───────────────────────────────────────────────────────────────────

/**
 * Met à jour le slug de la BioPage de l'utilisateur connecté.
 *
 * @param slug - Nouveau slug souhaité (3-30 chars, regex `/^[a-z0-9-]+$/`)
 * @returns `{ success: true, data: BioPage }` ou `{ success: false, error: string }`
 *
 * @example
 *   const res = await updateBioPageSlug('mimisara')
 *   if (!res.success) toast.error(res.error)
 */
export async function updateBioPageSlug(
  slug: string,
): Promise<{ success: true; data: BioPage } | { success: false; error: string }> {
  // ── Authentification ────────────────────────────────────────────────────────
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) {
    return { success: false, error: 'Non authentifié' }
  }

  // ── Validation Zod (on ne valide que le slug du schéma complet) ────────────
  const parsed = BioPageInfosSchema.shape.slug.safeParse(slug)
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Slug invalide',
    }
  }

  try {
    // ── Ownership check ──────────────────────────────────────────────────────
    const bioPage = await prisma.bioPage.findFirst({
      where: { userId: session.user.id },
    })
    if (!bioPage) {
      return { success: false, error: 'BioPage introuvable' }
    }

    // Si le slug est identique, on renvoie la BioPage sans modifier ni revalider
    if (bioPage.slug === parsed.data) {
      return { success: true, data: bioPage }
    }

    const oldSlug = bioPage.slug

    // ── Mise à jour — P2002 = slug déjà pris par un autre user ───────────────
    try {
      const updated = await prisma.bioPage.update({
        where: { id: bioPage.id },
        data: { slug: parsed.data },
      })

      // Revalide les deux slugs (ancien et nouveau)
      revalidatePath('/biolink')
      revalidatePath(`/u/${oldSlug}`)
      revalidatePath(`/u/${updated.slug}`)

      return { success: true, data: updated }
    } catch (err) {
      // Erreur d'unicité Prisma → message français explicite
      if ((err as { code?: string }).code === 'P2002') {
        return { success: false, error: 'Ce slug est déjà pris' }
      }
      throw err
    }
  } catch (err) {
    console.error('[updateBioPageSlug] Erreur DB :', err)
    return { success: false, error: 'Impossible de mettre à jour le slug' }
  }
}
