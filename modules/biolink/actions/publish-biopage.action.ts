/**
 * @file modules/biolink/actions/publish-biopage.action.ts
 * @module biolink
 * @description Server Action — bascule le statut de publication d'une BioPage.
 *
 *   Règle métier : on ne peut PASSER à `isPublished=true` que si :
 *   - La BioPage a un `title` non vide
 *   - La BioPage a au moins 1 BioLink avec `isActive=true`
 *
 *   Le passage à `false` (dépublication) n'a aucune condition.
 *
 *   Cette action toggle l'état : si la BioPage est publiée elle dépublie,
 *   sinon elle tente de publier (avec validation des prérequis).
 *
 * @example
 *   const res = await toggleBioPagePublish()
 *   if (!res.success) toast.error(res.error)
 *   // → "Ajoutez un titre avant de publier"
 *   // → "Ajoutez au moins un lien actif avant de publier"
 */

'use server'

import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

import type { BioPage } from '@prisma/client'

// ─── Action ───────────────────────────────────────────────────────────────────

/**
 * Bascule le statut `isPublished` de la BioPage de l'utilisateur connecté.
 * En cas de passage à `true`, vérifie que le titre et au moins 1 lien actif existent.
 *
 * @returns `{ success: true, data: BioPage }` ou `{ success: false, error: string }`
 *
 * @example
 *   const res = await toggleBioPagePublish()
 *   if (res.success) {
 *     toast.success(res.data.isPublished ? 'Page publiée' : 'Page dépubliée')
 *   }
 */
export async function toggleBioPagePublish(): Promise<
  { success: true; data: BioPage } | { success: false; error: string }
> {
  // ── Authentification ────────────────────────────────────────────────────────
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) {
    return { success: false, error: 'Non authentifié' }
  }

  try {
    // ── Ownership + récup des liens actifs (utile pour la pré-validation) ────
    const bioPage = await prisma.bioPage.findFirst({
      where: { userId: session.user.id },
      include: {
        links: {
          where: { isActive: true },
          select: { id: true },
        },
      },
    })
    if (!bioPage) {
      return { success: false, error: 'BioPage introuvable' }
    }

    // ── Nouveau statut = inverse du statut actuel ────────────────────────────
    const nextPublished = !bioPage.isPublished

    // ── Validation pré-publication (uniquement si on passe à `true`) ─────────
    if (nextPublished) {
      // 1. Titre requis
      if (!bioPage.title || bioPage.title.trim().length === 0) {
        return {
          success: false,
          error: 'Ajoutez un titre avant de publier votre page',
        }
      }

      // 2. Au moins 1 lien actif requis
      if (bioPage.links.length === 0) {
        return {
          success: false,
          error: 'Ajoutez au moins un lien actif avant de publier',
        }
      }
    }

    // ── Mise à jour du statut ────────────────────────────────────────────────
    const updated = await prisma.bioPage.update({
      where: { id: bioPage.id },
      data: { isPublished: nextPublished },
    })

    // Revalidation dashboard + page publique (changement de visibilité)
    revalidatePath('/biolink')
    revalidatePath(`/u/${updated.slug}`)

    return { success: true, data: updated }
  } catch (err) {
    console.error('[toggleBioPagePublish] Erreur DB :', err)
    return { success: false, error: 'Impossible de modifier le statut de publication' }
  }
}
