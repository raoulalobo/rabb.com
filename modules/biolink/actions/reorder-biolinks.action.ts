/**
 * @file modules/biolink/actions/reorder-biolinks.action.ts
 * @module biolink
 * @description Server Action — réordonne les BioLinks d'une BioPage en batch.
 *
 *   Reçoit un tableau d'IDs dans l'ordre désiré (0 = premier, N-1 = dernier)
 *   et UPDATE chaque row via `prisma.$transaction` pour garantir l'atomicité.
 *
 *   Vérifications de sécurité :
 *   - Session better-auth valide
 *   - Tous les IDs appartiennent à des liens de la BioPage du user courant
 *     (ownership check via la BioPage parente)
 *
 * @example
 *   await reorderBioLinks({ ids: ['clx1', 'clx3', 'clx2'] })
 *   // → clx1.position=0, clx3.position=1, clx2.position=2
 */

'use server'

import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// ─── Schéma local ─────────────────────────────────────────────────────────────

/**
 * Payload de reorder : tableau d'IDs dans l'ordre désiré.
 * Au moins 1 ID requis — le 0 index = position 0 (premier affiché).
 */
const ReorderBioLinksSchema = z.object({
  ids: z.array(z.string().min(1)).min(1, 'Au moins un ID est requis'),
})

type ReorderBioLinksPayload = z.infer<typeof ReorderBioLinksSchema>

// ─── Action ───────────────────────────────────────────────────────────────────

/**
 * Réordonne les BioLinks d'une BioPage.
 *
 * @param data - Objet `{ ids: string[] }` — tableau d'IDs dans l'ordre désiré
 * @returns `{ success: true, data: { count: number } }` ou `{ success: false, error: string }`
 *
 * @example
 *   await reorderBioLinks({ ids: ['clx1', 'clx3', 'clx2'] })
 */
export async function reorderBioLinks(
  data: ReorderBioLinksPayload,
): Promise<
  { success: true; data: { count: number } } | { success: false; error: string }
> {
  // ── Authentification ────────────────────────────────────────────────────────
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) {
    return { success: false, error: 'Non authentifié' }
  }

  // ── Validation Zod ──────────────────────────────────────────────────────────
  const parsed = ReorderBioLinksSchema.safeParse(data)
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Données invalides',
    }
  }

  const { ids } = parsed.data

  try {
    // ── Ownership check : récupère tous les liens concernés + leur BioPage ───
    const links = await prisma.bioLink.findMany({
      where: {
        id: { in: ids },
        bioPage: { userId: session.user.id },
      },
      include: { bioPage: { select: { id: true, slug: true } } },
    })

    // Tous les IDs fournis doivent avoir été trouvés sinon l'un appartient à
    // un autre user (ou n'existe pas) → refus.
    if (links.length !== ids.length) {
      return { success: false, error: 'Unauthorized' }
    }

    // Tous les liens doivent appartenir à la MÊME BioPage (sécurité supplémentaire :
    // pas de reorder cross-page)
    const bioPageIds = new Set(links.map((l) => l.bioPage.id))
    if (bioPageIds.size > 1) {
      return { success: false, error: 'Les liens doivent appartenir à la même BioPage' }
    }

    const slug = links[0]?.bioPage.slug ?? ''

    // ── Transaction : UPDATE position pour chaque lien ───────────────────────
    await prisma.$transaction(
      ids.map((id, position) =>
        prisma.bioLink.update({
          where: { id },
          data: { position },
        }),
      ),
    )

    // ── Revalidation ─────────────────────────────────────────────────────────
    revalidatePath('/biolink')
    if (slug) revalidatePath(`/u/${slug}`)

    return { success: true, data: { count: ids.length } }
  } catch (err) {
    console.error('[reorderBioLinks] Erreur DB :', err)
    return { success: false, error: 'Impossible de réordonner les liens' }
  }
}
