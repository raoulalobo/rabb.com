/**
 * @file modules/biolink/actions/update-biopage-appearance.action.ts
 * @module biolink
 * @description Server Action — met à jour les couleurs personnalisées d'une BioPage.
 *
 *   Champs modifiables (tous optionnels, null autorisé pour revenir au défaut) :
 *   - accentColor : couleur d'accent du CTA (défaut #E8B87A)
 *   - titleColor  : couleur du titre hero (défaut design)
 *   - bioColor    : couleur de la bio courte (défaut design)
 *   - linkColor   : couleur du texte des liens glass (défaut design)
 *
 *   Validation Zod via BioAppearanceSchema (regex hex #RRGGBB).
 *   Accepte explicitement `null` pour retirer une personnalisation (retour au défaut).
 *
 * @example
 *   await updateBioPageAppearance({ accentColor: '#6366f1', titleColor: null })
 */

'use server'

import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { BioAppearanceSchema } from '@/modules/biolink/schemas/biopage.schema'

import type { BioPage } from '@prisma/client'

// ─── Schéma local acceptant null (pour reset) ─────────────────────────────────

/**
 * Reprend BioAppearanceSchema mais accepte `null` en plus de `undefined` :
 * - `undefined` → le champ n'est pas modifié
 * - `null`      → la personnalisation est retirée (retour au défaut)
 * - string hex  → la personnalisation est appliquée
 */
const UpdateAppearanceSchema = z.object({
  accentColor: BioAppearanceSchema.shape.accentColor.nullable().optional(),
  titleColor: BioAppearanceSchema.shape.titleColor.nullable().optional(),
  bioColor: BioAppearanceSchema.shape.bioColor.nullable().optional(),
  linkColor: BioAppearanceSchema.shape.linkColor.nullable().optional(),
})

type UpdateAppearancePayload = z.infer<typeof UpdateAppearanceSchema>

// ─── Action ───────────────────────────────────────────────────────────────────

/**
 * Met à jour les couleurs personnalisées d'une BioPage.
 *
 * @param data - Couleurs à mettre à jour (null pour retirer, undefined pour ignorer)
 * @returns `{ success: true, data: BioPage }` ou `{ success: false, error: string }`
 *
 * @example
 *   await updateBioPageAppearance({ accentColor: '#E8B87A', bioColor: null })
 */
export async function updateBioPageAppearance(
  data: UpdateAppearancePayload,
): Promise<{ success: true; data: BioPage } | { success: false; error: string }> {
  // ── Authentification ────────────────────────────────────────────────────────
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) {
    return { success: false, error: 'Non authentifié' }
  }

  // ── Validation Zod ──────────────────────────────────────────────────────────
  const parsed = UpdateAppearanceSchema.safeParse(data)
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Données invalides',
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

    // ── Construction du payload d'update — ignore les undefined ──────────────
    // Mais `null` est conservé pour permettre le reset d'une couleur custom.
    const updateData: Record<string, unknown> = {}
    if (parsed.data.accentColor !== undefined) {
      // accentColor a un défaut en DB ("#6366f1") — null retombe sur le défaut
      // Prisma via `{ set: null }` pas supporté sur un String non-nullable.
      // accentColor est non-nullable en schema → on ignore null et on force le défaut design.
      updateData.accentColor = parsed.data.accentColor ?? '#E8B87A'
    }
    if (parsed.data.titleColor !== undefined) updateData.titleColor = parsed.data.titleColor
    if (parsed.data.bioColor !== undefined) updateData.bioColor = parsed.data.bioColor
    if (parsed.data.linkColor !== undefined) updateData.linkColor = parsed.data.linkColor

    const updated = await prisma.bioPage.update({
      where: { id: bioPage.id },
      data: updateData,
    })

    // Revalidation de l'éditeur et de la page publique
    revalidatePath('/biolink')
    revalidatePath(`/u/${updated.slug}`)

    return { success: true, data: updated }
  } catch (err) {
    console.error('[updateBioPageAppearance] Erreur DB :', err)
    return { success: false, error: 'Impossible de mettre à jour l\'apparence' }
  }
}
