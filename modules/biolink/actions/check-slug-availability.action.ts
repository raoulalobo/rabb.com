/**
 * @file modules/biolink/actions/check-slug-availability.action.ts
 * @module biolink
 * @description Server Action — vérifie si un slug est disponible globalement.
 *
 *   Appelée en debounce pendant la saisie du slug dans l'éditeur pour afficher
 *   un badge vert ✓ (disponible) ou rouge ✗ (pris).
 *
 *   Important : on exclut le slug du user courant de la vérification,
 *   sinon un user voit son propre slug "indisponible" lorsqu'il édite.
 *
 *   Cette action valide aussi le format du slug via le schéma Zod — si le
 *   format est invalide, on retourne `available: false` avec un message d'erreur.
 *
 * @example
 *   const res = await checkSlugAvailability('mimisara')
 *   if (res.available) showGreenBadge()
 *   else showRedBadge(res.error ?? 'Ce slug est déjà pris')
 */

'use server'

import { headers } from 'next/headers'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { BioPageInfosSchema } from '@/modules/biolink/schemas/biopage.schema'

// ─── Action ───────────────────────────────────────────────────────────────────

/**
 * Vérifie si un slug est disponible (hors slug du user courant).
 *
 * @param slug - Slug à tester (3-30 chars, regex `/^[a-z0-9-]+$/`)
 * @returns `{ available: true }` | `{ available: false; error?: string }`
 *
 * @example
 *   const { available } = await checkSlugAvailability('mon-slug')
 */
export async function checkSlugAvailability(
  slug: string,
): Promise<{ available: boolean; error?: string }> {
  // ── Authentification ────────────────────────────────────────────────────────
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) {
    return { available: false, error: 'Non authentifié' }
  }

  // ── Validation du format (la regex + longueur sont exposées au front) ──────
  const parsed = BioPageInfosSchema.shape.slug.safeParse(slug)
  if (!parsed.success) {
    return {
      available: false,
      error: parsed.error.issues[0]?.message ?? 'Slug invalide',
    }
  }

  try {
    // ── Vérification d'unicité (exclut le slug du user courant) ──────────────
    // findFirst avec where.userId != session.user.id → si on trouve un match,
    // c'est qu'un AUTRE user a déjà ce slug → indisponible.
    const existing = await prisma.bioPage.findFirst({
      where: {
        slug: parsed.data,
        NOT: { userId: session.user.id },
      },
      select: { id: true },
    })

    return { available: existing === null }
  } catch (err) {
    console.error('[checkSlugAvailability] Erreur DB :', err)
    return { available: false, error: 'Impossible de vérifier la disponibilité' }
  }
}
