/**
 * @file modules/biolink/actions/update-biolink.action.ts
 * @module biolink
 * @description Server Action — met à jour un BioLink existant.
 *
 *   Champs modifiables : title, url, eyebrow, kind, isActive.
 *   La `position` est gérée par `reorder-biolinks.action.ts` (drag & drop).
 *
 *   Flux :
 *   1. Vérifie la session better-auth
 *   2. Valide les données partielles via BioLinkSchema.partial()
 *   3. Vérifie l'ownership via la relation BioLink → BioPage → userId
 *   4. Met à jour uniquement les champs fournis
 *   5. Revalide /biolink et /u/{slug}
 *
 * @example
 *   await updateBioLink('clx123', { title: 'Nouveau titre', isActive: false })
 */

'use server'

import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { BioLinkSchema } from '@/modules/biolink/schemas/biopage.schema'

import type { BioLink } from '@prisma/client'
import type { z } from 'zod'

// ─── Payload type ────────────────────────────────────────────────────────────

/**
 * Payload d'update — tous les champs du BioLinkSchema sont optionnels.
 * Seuls les champs fournis sont modifiés en DB.
 */
type UpdateBioLinkPayload = Partial<z.infer<typeof BioLinkSchema>>

// ─── Action ───────────────────────────────────────────────────────────────────

/**
 * Met à jour un BioLink existant. Vérifie l'ownership via la BioPage parente.
 *
 * @param id   - Identifiant du BioLink à mettre à jour
 * @param data - Champs à mettre à jour (tous optionnels)
 * @returns `{ success: true, data: BioLink }` ou `{ success: false, error: string }`
 *
 * @example
 *   await updateBioLink('clx123', { title: 'Nouveau', url: 'https://...' })
 */
export async function updateBioLink(
  id: string,
  data: UpdateBioLinkPayload,
): Promise<{ success: true; data: BioLink } | { success: false; error: string }> {
  // ── Authentification ────────────────────────────────────────────────────────
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) {
    return { success: false, error: 'Non authentifié' }
  }

  // ── Validation Zod partielle ────────────────────────────────────────────────
  const parsed = BioLinkSchema.partial().safeParse(data)
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Données invalides',
    }
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

    // ── Construction du payload d'update (uniquement les champs fournis) ─────
    const updateData: Record<string, unknown> = {}
    if (parsed.data.title !== undefined) updateData.title = parsed.data.title
    if (parsed.data.url !== undefined) updateData.url = parsed.data.url
    if (parsed.data.isActive !== undefined) updateData.isActive = parsed.data.isActive
    // `kind` est encodé dans `icon` (convention "kind:primary" / "kind:glass")
    if (parsed.data.kind !== undefined) updateData.icon = `kind:${parsed.data.kind}`
    // `eyebrow` est stocké dans `thumbnailUrl` (slot texte réutilisé — MVP P2)
    // On accepte une chaîne vide en entrée → null en DB (retire l'eyebrow).
    if (parsed.data.eyebrow !== undefined) {
      updateData.thumbnailUrl = parsed.data.eyebrow.length > 0 ? parsed.data.eyebrow : null
    }

    const updated = await prisma.bioLink.update({
      where: { id },
      data: updateData,
    })

    // ── Revalidation ─────────────────────────────────────────────────────────
    revalidatePath('/biolink')
    revalidatePath(`/u/${existing.bioPage.slug}`)

    return { success: true, data: updated }
  } catch (err) {
    console.error('[updateBioLink] Erreur DB :', err)
    return { success: false, error: 'Impossible de mettre à jour le lien' }
  }
}
