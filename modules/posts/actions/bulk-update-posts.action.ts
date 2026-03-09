/**
 * @file modules/posts/actions/bulk-update-posts.action.ts
 * @module posts
 * @description Server Action : mise à jour en masse du statut ou de la date de planification.
 *
 *   Deux opérations possibles (mutuellement exclusives) :
 *   1. **Replanifier** (scheduledFor fourni) : met le statut à SCHEDULED, annule les anciens
 *      runs Inngest des posts déjà SCHEDULED, crée de nouveaux events post/schedule.
 *   2. **Passer en brouillon** (newStatus: 'DRAFT') : met le statut à DRAFT, efface scheduledFor
 *      et failureReason, annule les runs Inngest des posts SCHEDULED.
 *
 *   Règles d'éligibilité :
 *   - DRAFT, SCHEDULED, FAILED → éligibles
 *   - PUBLISHED                → ignorés (comptabilisés dans `skipped`)
 *
 *   Ownership : vérification implicite via `where: { id: { in: postIds }, userId }`.
 *
 * @example
 *   // Replanifier 2 posts
 *   const result = await bulkUpdatePosts(['abc', 'def'], { scheduledFor: new Date('2026-04-01T10:00:00') })
 *   // → { updated: 2, skipped: 0, errors: [] }
 *
 *   // Passer en brouillon
 *   const result = await bulkUpdatePosts(['abc'], { newStatus: 'DRAFT' })
 *   // → { updated: 1, skipped: 0, errors: [] }
 */

'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'

import { auth } from '@/lib/auth'
import { inngest } from '@/lib/inngest/client'
import { prisma } from '@/lib/prisma'
import { BulkUpdateSchema } from '@/modules/posts/schemas/post.schema'
import type { BulkUpdate } from '@/modules/posts/schemas/post.schema'

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Résultat de la mise à jour en masse.
 * Permet à l'UI d'afficher un toast précis ("2 mis à jour, 1 ignoré").
 */
export interface BulkUpdateResult {
  /** Nombre de posts effectivement mis à jour */
  updated: number
  /** Nombre de posts ignorés (status PUBLISHED — non modifiables) */
  skipped: number
  /** Messages d'erreur éventuels */
  errors: string[]
}

// ─── Action ───────────────────────────────────────────────────────────────────

/**
 * Met à jour en masse le statut ou la date de planification des posts sélectionnés.
 *
 * @param postIds - IDs des posts à mettre à jour (max 100)
 * @param options - { scheduledFor } pour replanifier, { newStatus: 'DRAFT' } pour brouillon
 * @returns Résultat : updated + skipped + errors
 *
 * @example
 *   await bulkUpdatePosts(['id1', 'id2'], { scheduledFor: new Date('2026-04-01T10:00:00') })
 *   await bulkUpdatePosts(['id1'], { newStatus: 'DRAFT' })
 */
export async function bulkUpdatePosts(
  postIds: string[],
  options: Omit<BulkUpdate, 'postIds'>,
): Promise<BulkUpdateResult> {
  // ── Validation Zod ─────────────────────────────────────────────────────────
  const parsed = BulkUpdateSchema.safeParse({ postIds, ...options })
  if (!parsed.success) {
    return {
      updated: 0,
      skipped: 0,
      errors: [parsed.error.issues[0]?.message ?? 'Données invalides'],
    }
  }

  // ── Vérification de la session ─────────────────────────────────────────────
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return { updated: 0, skipped: 0, errors: ['Non authentifié'] }
  }

  const userId = session.user.id

  // ── Chargement des posts avec ownership check ──────────────────────────────
  const posts = await prisma.post.findMany({
    where: { id: { in: parsed.data.postIds }, userId },
    select: { id: true, status: true },
  })

  if (posts.length === 0) {
    return { updated: 0, skipped: 0, errors: ['Aucun post trouvé'] }
  }

  // ── Séparation : éligibles vs ignorés (PUBLISHED non modifiable) ───────────
  const eligible = posts.filter((p) => p.status !== 'PUBLISHED')
  const skipped = posts.filter((p) => p.status === 'PUBLISHED')

  if (eligible.length === 0) {
    return {
      updated: 0,
      skipped: skipped.length,
      errors: ['Tous les posts sélectionnés sont publiés et ne peuvent pas être modifiés'],
    }
  }

  const eligibleIds = eligible.map((p) => p.id)
  // IDs des posts actuellement SCHEDULED (leur run Inngest doit être annulé)
  const scheduledIds = eligible.filter((p) => p.status === 'SCHEDULED').map((p) => p.id)

  // ── Transaction Prisma ─────────────────────────────────────────────────────
  if (parsed.data.scheduledFor) {
    // Mode replanification : SCHEDULED avec nouvelle date
    await prisma.$transaction([
      prisma.post.updateMany({
        where: { id: { in: eligibleIds }, userId },
        data: {
          scheduledFor: parsed.data.scheduledFor,
          status: 'SCHEDULED',
          // Efface le failureReason si le post était en FAILED
          failureReason: null,
        },
      }),
    ])
  } else {
    // Mode brouillon : effacer la date + passer en DRAFT
    await prisma.$transaction([
      prisma.post.updateMany({
        where: { id: { in: eligibleIds }, userId },
        data: {
          status: 'DRAFT',
          scheduledFor: null,
          failureReason: null,
        },
      }),
    ])
  }

  // ── Gestion Inngest (non-bloquant) ─────────────────────────────────────────
  if (!process.env.INNGEST_EVENT_KEY) {
    console.warn('[bulk-update] INNGEST_EVENT_KEY non défini — events Inngest ignorés')
  } else {
    try {
      // Annuler les runs en cours pour les posts qui étaient SCHEDULED
      if (scheduledIds.length > 0) {
        await inngest.send(
          scheduledIds.map((id) => ({ name: 'post/cancel' as const, data: { postId: id } })),
        )
      }

      // Si on replanifie → créer de nouveaux events post/schedule pour tous les posts éligibles
      if (parsed.data.scheduledFor) {
        await inngest.send(
          eligibleIds.map((id) => ({
            name: 'post/schedule' as const,
            data: { postId: id, scheduledFor: parsed.data.scheduledFor!.toISOString() },
          })),
        )
      }
    } catch (inngestError) {
      // Log sans faire échouer l'action — la DB est déjà mise à jour
      console.error('[bulk-update] Inngest send échoué (non-bloquant) :', inngestError)
    }
  }

  // ── Invalidation du cache Next.js ──────────────────────────────────────────
  revalidatePath('/compose')
  revalidatePath('/calendar')
  revalidatePath('/')

  return {
    updated: eligible.length,
    skipped: skipped.length,
    errors: [],
  }
}
