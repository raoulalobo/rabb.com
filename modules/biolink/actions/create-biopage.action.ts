/**
 * @file modules/biolink/actions/create-biopage.action.ts
 * @module biolink
 * @description Server Action — crée une BioPage vide pour l'utilisateur connecté.
 *
 *   Comportement :
 *   - Vérifie la session better-auth
 *   - Si une BioPage existe déjà pour ce user, retourne celle-ci (idempotent)
 *   - Sinon crée une BioPage avec :
 *     - slug = user.id (garanti unique, éditable ensuite)
 *     - En cas de collision (P2002), tente un slug aléatoire 8 chars
 *     - isPublished = false (par défaut Prisma)
 *
 *   Ne nécessite aucun paramètre — tout est dérivé de la session.
 *
 * @example
 *   const res = await createBioPage()
 *   if (res.success) console.log('BioPage créée :', res.data.id)
 */

'use server'

import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

import type { BioPage } from '@prisma/client'

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Génère un slug aléatoire de 8 caractères lowercase/chiffres.
 * Utilisé en fallback si le slug basé sur user.id est déjà pris (edge case).
 *
 * @returns Slug aléatoire ex. "a3b9f1k2"
 */
function generateRandomSlug(): string {
  return Math.random().toString(36).slice(2, 10)
}

// ─── Action ───────────────────────────────────────────────────────────────────

/**
 * Crée une BioPage vide (ou retourne celle existante) pour l'utilisateur connecté.
 *
 * @returns `{ success: true, data: BioPage }` ou `{ success: false, error: string }`
 *
 * @example
 *   const res = await createBioPage()
 *   if (!res.success) toast.error(res.error)
 */
export async function createBioPage(): Promise<
  { success: true; data: BioPage } | { success: false; error: string }
> {
  // ── Authentification ────────────────────────────────────────────────────────
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) {
    return { success: false, error: 'Non authentifié' }
  }

  const userId = session.user.id

  try {
    // ── Idempotence : retourne la BioPage existante si déjà créée ────────────
    const existing = await prisma.bioPage.findUnique({ where: { userId } })
    if (existing) {
      return { success: true, data: existing }
    }

    // ── Création avec slug = user.id (garanti unique côté Prisma) ────────────
    // user.id est un cuid donc déjà lowercase + chiffres + peut contenir des
    // lettres majuscules : on lowercase pour respecter la regex slug publique.
    const baseSlug = userId.toLowerCase()

    try {
      const created = await prisma.bioPage.create({
        data: {
          userId,
          slug: baseSlug,
          // isPublished=false par défaut (Prisma), rien à forcer ici
        },
      })

      revalidatePath('/biolink')

      return { success: true, data: created }
    } catch (err) {
      // ── Fallback en cas de collision rarissime sur le slug (P2002) ────────
      if ((err as { code?: string }).code === 'P2002') {
        // Retry avec un slug aléatoire
        const created = await prisma.bioPage.create({
          data: {
            userId,
            slug: generateRandomSlug(),
          },
        })

        revalidatePath('/biolink')

        return { success: true, data: created }
      }
      throw err
    }
  } catch (err) {
    console.error('[createBioPage] Erreur DB :', err)
    return { success: false, error: 'Impossible de créer la Link-in-Bio' }
  }
}
