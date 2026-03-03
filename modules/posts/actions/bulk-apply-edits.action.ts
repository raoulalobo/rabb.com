/**
 * @file modules/posts/actions/bulk-apply-edits.action.ts
 * @module posts
 * @description Server Action : application des modifications IA confirmées sur plusieurs posts.
 *
 *   Reçoit le tableau de ProposedEdit générées par /api/agent/edit-posts-batch
 *   et confirmées par l'utilisateur dans la phase preview d'AgentModalBulkEdit.
 *   Persist chaque modification en DB via une transaction Prisma.
 *   Gère les events Inngest (annulation + re-planification si scheduledFor change).
 *
 *   Logique du statut résultant :
 *   - scheduledFor future valide → status SCHEDULED + event Inngest post/schedule
 *   - scheduledFor null ou passée → status DRAFT
 *   - Les anciens runs Inngest SCHEDULED sont annulés avant d'en créer de nouveaux
 *
 *   Ownership : vérification implicite via `where: { id: postId, userId }` dans chaque update.
 *
 * @example
 *   const result = await bulkApplyEdits([
 *     { postId: 'abc', text: 'Texte #promo2026', mediaUrls: [], scheduledFor: '2026-03-15T09:00:00Z' },
 *     { postId: 'def', text: 'Autre texte #promo2026', mediaUrls: [], scheduledFor: null },
 *   ])
 *   // → { updated: 2, errors: [] }
 */

'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'

import { auth } from '@/lib/auth'
import { inngest } from '@/lib/inngest/client'
import { prisma } from '@/lib/prisma'
import { BulkApplyEditsSchema } from '@/modules/posts/schemas/post.schema'
import type { ProposedEdit } from '@/modules/posts/schemas/post.schema'

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Résultat de l'application des modifications.
 * Permet à l'UI d'afficher un toast et passer à la phase succès.
 */
export interface BulkApplyResult {
  /** Nombre de posts effectivement mis à jour */
  updated: number
  /** Messages d'erreur éventuels */
  errors: string[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Détermine si une date ISO est valide et dans le futur.
 * Utilisé pour décider si le statut du post devient SCHEDULED ou DRAFT.
 *
 * @param dateStr - Chaîne ISO 8601 ou null
 * @param now - Référence temporelle (définie une seule fois pour la transaction)
 * @returns true si la date est valide et strictement future
 *
 * @example
 *   isValidFutureDate('2099-01-01T09:00:00Z', new Date()) // true
 *   isValidFutureDate('2020-01-01T09:00:00Z', new Date()) // false (passé)
 *   isValidFutureDate(null, new Date()) // false
 */
function isValidFutureDate(dateStr: string | null, now: Date): boolean {
  if (!dateStr) return false
  const date = new Date(dateStr)
  return !isNaN(date.getTime()) && date > now
}

// ─── Action ───────────────────────────────────────────────────────────────────

/**
 * Applique les modifications IA confirmées sur plusieurs posts en une transaction.
 * Gère les statuts résultants (DRAFT / SCHEDULED) et les events Inngest.
 *
 * @param edits - Tableau de modifications proposées (max 50) issues de l'agent IA
 * @returns Résultat : updated + errors
 *
 * @example
 *   const result = await bulkApplyEdits([
 *     { postId: 'abc', text: 'Nouveau texte', mediaUrls: [], scheduledFor: '2026-03-15T09:00:00Z' },
 *   ])
 *   // → { updated: 1, errors: [] }
 */
export async function bulkApplyEdits(edits: ProposedEdit[]): Promise<BulkApplyResult> {
  // ── Validation Zod ─────────────────────────────────────────────────────────
  const parsed = BulkApplyEditsSchema.safeParse({ edits })
  if (!parsed.success) {
    return {
      updated: 0,
      errors: [parsed.error.issues[0]?.message ?? 'Données invalides'],
    }
  }

  // ── Vérification de la session ─────────────────────────────────────────────
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return { updated: 0, errors: ['Non authentifié'] }
  }

  const userId = session.user.id
  const validEdits = parsed.data.edits
  const postIds = validEdits.map((e) => e.postId)

  // ── Ownership check + récupération du statut précédent ────────────────────
  // Le statut précédent est nécessaire pour savoir si on doit annuler un run Inngest.
  const existingPosts = await prisma.post.findMany({
    where: { id: { in: postIds }, userId },
    select: { id: true, status: true },
  })

  // Index par ID pour accès O(1) lors de la construction des updates
  const existingMap = new Map(existingPosts.map((p) => [p.id, p]))

  // Filtrer les edits dont on n'a pas pu vérifier l'ownership
  const authorizedEdits = validEdits.filter((edit) => existingMap.has(edit.postId))

  if (authorizedEdits.length === 0) {
    return { updated: 0, errors: ['Aucun post autorisé trouvé'] }
  }

  // ── Calcul des statuts résultants ──────────────────────────────────────────
  // La référence temporelle est fixée une seule fois pour toute la transaction.
  const now = new Date()

  // Pour chaque edit : déterminer le nouveau statut (DRAFT ou SCHEDULED)
  const editDetails = authorizedEdits.map((edit) => ({
    edit,
    previousStatus: existingMap.get(edit.postId)?.status ?? 'DRAFT',
    // `as const` est nécessaire pour que TypeScript infère 'SCHEDULED' | 'DRAFT'
    // plutôt que `string` — Prisma exige le type énuméré exact.
    newStatus: isValidFutureDate(edit.scheduledFor, now) ? ('SCHEDULED' as const) : ('DRAFT' as const),
    newScheduledDate: isValidFutureDate(edit.scheduledFor, now)
      ? new Date(edit.scheduledFor!)
      : null,
  }))

  // ── Transaction Prisma : N updates atomiques ───────────────────────────────
  await prisma.$transaction(
    editDetails.map(({ edit, newStatus, newScheduledDate }) =>
      prisma.post.update({
        where: { id: edit.postId, userId },
        data: {
          text: edit.text,
          // Filtrer les URLs vides ou invalides avant persistance
          mediaUrls: edit.mediaUrls.filter((url) => url.startsWith('http')),
          scheduledFor: newScheduledDate,
          status: newStatus,
          // Réinitialiser les champs de publication précédents
          latePostId: null,
          failureReason: null,
          publishedAt: null,
        },
      }),
    ),
  )

  // ── Events Inngest en batch ────────────────────────────────────────────────
  // Opérations non-bloquantes : un échec Inngest ne doit pas faire échouer les updates.
  if (!process.env.INNGEST_EVENT_KEY) {
    console.warn('[bulk-apply-edits] INNGEST_EVENT_KEY non défini — events Inngest ignorés')
  } else {
    try {
      const inngestEvents: Array<{ name: string; data: Record<string, unknown> }> = []

      for (const { edit, previousStatus, newStatus, newScheduledDate } of editDetails) {
        // Annuler le run précédent si le post était SCHEDULED (évite les runs dupliqués)
        if (previousStatus === 'SCHEDULED') {
          inngestEvents.push({ name: 'post/cancel', data: { postId: edit.postId } })
        }

        // Créer un nouveau run si le post devient SCHEDULED
        if (newStatus === 'SCHEDULED' && newScheduledDate) {
          inngestEvents.push({
            name: 'post/schedule',
            data: {
              postId: edit.postId,
              scheduledFor: newScheduledDate.toISOString(),
            },
          })
        }
      }

      if (inngestEvents.length > 0) {
        // Envoyer tous les events en un seul appel réseau
        await inngest.send(
          inngestEvents as Parameters<typeof inngest.send>[0],
        )
      }
    } catch (inngestError) {
      console.error('[bulk-apply-edits] Inngest send échoué (non-bloquant) :', inngestError)
    }
  }

  // ── Invalidation du cache Next.js ──────────────────────────────────────────
  revalidatePath('/compose')
  revalidatePath('/calendar')
  revalidatePath('/')

  return {
    updated: authorizedEdits.length,
    errors: [],
  }
}
