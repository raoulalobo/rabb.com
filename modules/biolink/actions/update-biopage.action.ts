/**
 * @file modules/biolink/actions/update-biopage.action.ts
 * @module biolink
 * @description Server Action — met à jour les infos éditables d'une BioPage.
 *
 *   Champs modifiables : title, bio, handle, tagline, avatarUrl
 *   Le slug a sa propre action (update-biopage-slug.action.ts) car il nécessite
 *   une gestion dédiée de l'erreur P2002 (unicité).
 *
 *   Flux :
 *   1. Vérifie la session better-auth
 *   2. Valide les champs via Zod (BioPageInfosSchema sans slug)
 *   3. Vérifie l'ownership (la BioPage appartient bien au user connecté)
 *   4. Met à jour les champs fournis (les undefined ne sont pas touchés)
 *   5. Revalide /biolink et /u/{slug}
 *
 * @example
 *   const res = await updateBioPage({ title: 'Mimi\nSara', bio: 'Auteure' })
 *   if (!res.success) toast.error(res.error)
 */

'use server'

import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { BioPageInfosSchema } from '@/modules/biolink/schemas/biopage.schema'

import type { BioPage } from '@prisma/client'

// ─── Schéma local : infos sans slug (géré par update-biopage-slug.action.ts) ─

/**
 * Schéma local — reprend BioPageInfosSchema sans le slug.
 * On ajoute `avatarUrl` qui est mis à jour ici (et pas via le schéma "infos"
 * pur qui sert aussi aux formulaires de texte).
 */
const UpdateBioPageSchema = BioPageInfosSchema.omit({ slug: true }).extend({
  /** URL publique de l'avatar (Supabase Storage) — optionnelle */
  avatarUrl: z.string().url('URL d\'avatar invalide').optional().nullable(),
})

/** Type inféré — payload d'update (partiel, tous les champs optionnels au run-time) */
type UpdateBioPagePayload = Partial<z.infer<typeof UpdateBioPageSchema>>

// ─── Action ───────────────────────────────────────────────────────────────────

/**
 * Met à jour les infos éditables d'une BioPage (title, bio, handle, tagline, avatarUrl).
 *
 * @param data - Champs à mettre à jour (tous optionnels — seuls les fournis sont modifiés)
 * @returns `{ success: true, data: BioPage }` ou `{ success: false, error: string }`
 *
 * @example
 *   await updateBioPage({ title: 'Nouveau titre', tagline: 'Bienvenue...' })
 */
export async function updateBioPage(
  data: UpdateBioPagePayload,
): Promise<{ success: true; data: BioPage } | { success: false; error: string }> {
  // ── Authentification ────────────────────────────────────────────────────────
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) {
    return { success: false, error: 'Non authentifié' }
  }

  // ── Validation Zod partielle ────────────────────────────────────────────────
  const parsed = UpdateBioPageSchema.partial().safeParse(data)
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Données invalides',
    }
  }

  try {
    // ── Ownership check : findFirst sur userId (relation 1-1) ─────────────────
    const bioPage = await prisma.bioPage.findFirst({
      where: { userId: session.user.id },
    })
    if (!bioPage) {
      return { success: false, error: 'BioPage introuvable' }
    }

    // ── Mise à jour : on ne passe que les champs explicitement fournis ────────
    // Distinction critique :
    // - `undefined` → champ absent du payload, on ne touche pas la colonne DB
    // - `null`      → reset volontaire, Prisma écrit `NULL` dans la colonne
    // Cette logique permet à l'éditeur d'effacer un champ déjà rempli
    // (ex: bio déjà saisie → textarea vidé → on veut persister l'effacement).
    const updateData: Record<string, unknown> = {}
    if (parsed.data.title !== undefined) updateData.title = parsed.data.title
    if (parsed.data.bio !== undefined) updateData.bio = parsed.data.bio
    if (parsed.data.handle !== undefined) updateData.handle = parsed.data.handle
    if (parsed.data.tagline !== undefined) updateData.tagline = parsed.data.tagline
    if (parsed.data.avatarUrl !== undefined) updateData.avatarUrl = parsed.data.avatarUrl

    const updated = await prisma.bioPage.update({
      where: { id: bioPage.id },
      data: updateData,
    })

    // ── Revalidation des pages concernées (dashboard + page publique) ─────────
    revalidatePath('/biolink')
    revalidatePath(`/u/${updated.slug}`)

    return { success: true, data: updated }
  } catch (err) {
    console.error('[updateBioPage] Erreur DB :', err)
    return { success: false, error: 'Impossible de mettre à jour la BioPage' }
  }
}
