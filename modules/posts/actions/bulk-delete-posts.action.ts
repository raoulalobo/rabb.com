/**
 * @file modules/posts/actions/bulk-delete-posts.action.ts
 * @module posts
 * @description Server Action : suppression en masse de posts.
 *
 *   Supprime plusieurs posts d'un coup, en filtrant les posts non éligibles
 *   (les posts PUBLISHED sont ignorés — ils ne peuvent pas être supprimés).
 *   Annule les runs Inngest des posts SCHEDULED avant leur suppression.
 *
 *   Règles d'éligibilité :
 *   - DRAFT    → supprimable
 *   - SCHEDULED → supprimable (+ annulation run Inngest)
 *   - FAILED   → supprimable
 *   - PUBLISHED → ignoré (comptabilisé dans `skipped`)
 *
 *   Ownership : seuls les posts appartenant à l'utilisateur connecté sont traités.
 *   L'ownership est implicitement vérifié via `where: { id: { in: postIds }, userId }`.
 *
 * @example
 *   const result = await bulkDeletePosts(['abc123', 'def456', 'ghi789'])
 *   // { deleted: 2, skipped: 1, errors: [] }
 *   // → 2 posts supprimés, 1 ignoré (PUBLISHED)
 */

'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'

import { auth } from '@/lib/auth'
import { inngest } from '@/lib/inngest/client'
import { prisma } from '@/lib/prisma'
import { BulkDeleteSchema } from '@/modules/posts/schemas/post.schema'

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Résultat de la suppression en masse.
 * Permet à l'UI d'afficher un toast précis ("2 supprimés, 1 ignoré").
 */
export interface BulkDeleteResult {
  /** Nombre de posts effectivement supprimés */
  deleted: number
  /** Nombre de posts ignorés (status PUBLISHED — non supprimables) */
  skipped: number
  /** Messages d'erreur éventuels (ex: post introuvable) */
  errors: string[]
}

// ─── Action ───────────────────────────────────────────────────────────────────

/**
 * Supprime en masse les posts sélectionnés (DRAFT / SCHEDULED / FAILED uniquement).
 * Les posts PUBLISHED sont ignorés et comptabilisés dans `skipped`.
 *
 * @param postIds - IDs des posts à supprimer (max 100)
 * @returns Résultat : deleted + skipped + errors
 *
 * @example
 *   // Sélection de 3 posts : 2 DRAFT + 1 PUBLISHED
 *   const result = await bulkDeletePosts(['id1', 'id2', 'id3'])
 *   // → { deleted: 2, skipped: 1, errors: [] }
 */
export async function bulkDeletePosts(postIds: string[]): Promise<BulkDeleteResult> {
  // ── Validation Zod ─────────────────────────────────────────────────────────
  const parsed = BulkDeleteSchema.safeParse({ postIds })
  if (!parsed.success) {
    return {
      deleted: 0,
      skipped: 0,
      errors: [parsed.error.issues[0]?.message ?? 'Données invalides'],
    }
  }

  // ── Vérification de la session ─────────────────────────────────────────────
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return { deleted: 0, skipped: 0, errors: ['Non authentifié'] }
  }

  const userId = session.user.id

  // ── Chargement des posts avec ownership check ──────────────────────────────
  // On filtre par userId pour garantir que l'utilisateur ne supprime que ses posts.
  const posts = await prisma.post.findMany({
    where: { id: { in: parsed.data.postIds }, userId },
    select: { id: true, status: true },
  })

  if (posts.length === 0) {
    return { deleted: 0, skipped: 0, errors: ['Aucun post trouvé'] }
  }

  // ── Séparation : éligibles vs ignorés ─────────────────────────────────────
  // PUBLISHED ne peut pas être supprimé — il est déjà sur les réseaux sociaux
  const eligible = posts.filter((p) => p.status !== 'PUBLISHED')
  const skipped = posts.filter((p) => p.status === 'PUBLISHED')

  if (eligible.length === 0) {
    return {
      deleted: 0,
      skipped: skipped.length,
      errors: ['Tous les posts sélectionnés sont publiés et ne peuvent pas être supprimés'],
    }
  }

  const eligibleIds = eligible.map((p) => p.id)
  // Extraire les IDs des posts SCHEDULED (nécessitent l'annulation du run Inngest)
  const scheduledIds = eligible.filter((p) => p.status === 'SCHEDULED').map((p) => p.id)

  // ── Transaction Prisma : suppression atomique ──────────────────────────────
  await prisma.$transaction([
    prisma.post.deleteMany({
      where: { id: { in: eligibleIds }, userId },
    }),
  ])

  // ── Annulation des runs Inngest pour les posts SCHEDULED ──────────────────
  // Non-bloquant : un échec Inngest (dev server absent) ne doit pas faire échouer
  // la suppression déjà effectuée en DB.
  if (scheduledIds.length > 0) {
    if (!process.env.INNGEST_EVENT_KEY) {
      // En local sans clé, on saute l'annulation
      console.warn('[bulk-delete] INNGEST_EVENT_KEY non défini — annulations Inngest ignorées')
    } else {
      try {
        // Envoyer un event post/cancel pour chaque post SCHEDULED en batch
        await inngest.send(
          scheduledIds.map((id) => ({ name: 'post/cancel' as const, data: { postId: id } })),
        )
      } catch (inngestError) {
        // Log sans faire échouer l'action — le post est déjà supprimé en DB
        console.error('[bulk-delete] Inngest send échoué (non-bloquant) :', inngestError)
      }
    }
  }

  // ── Invalidation du cache Next.js ──────────────────────────────────────────
  revalidatePath('/compose')
  revalidatePath('/calendar')
  revalidatePath('/')

  return {
    deleted: eligible.length,
    skipped: skipped.length,
    errors: [],
  }
}
