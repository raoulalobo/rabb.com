/**
 * @file modules/posts/actions/bulk-edit-content.action.ts
 * @module posts
 * @description Server Action : édition de contenu en masse (texte et/ou médias).
 *
 *   Applique un texte commun et/ou des médias communs à plusieurs posts.
 *   - textMode 'replace' : remplace entièrement le texte existant
 *   - textMode 'append'  : ajoute le texte à la fin du texte existant (séparé par \n)
 *   - mediaUrls          : remplace les médias existants de chaque post
 *
 *   Règles d'éligibilité :
 *   - DRAFT, SCHEDULED, FAILED → éligibles
 *   - PUBLISHED                → ignorés (comptabilisés dans `skipped`)
 *
 *   Note : cette action ne touche pas au statut ni à la date de planification.
 *   Les posts SCHEDULED conservent leur date et leur run Inngest.
 *
 * @example
 *   // Remplacer le texte de 2 posts
 *   await bulkEditContent({ postIds: ['abc', 'def'], text: 'Nouveau texte', textMode: 'replace', mediaUrls: [] })
 *   // → { updated: 2, skipped: 0, errors: [] }
 *
 *   // Ajouter un hashtag à la fin de tous les posts
 *   await bulkEditContent({ postIds: ['abc'], text: '#promo2026', textMode: 'append', mediaUrls: [] })
 *   // → { updated: 1, skipped: 0, errors: [] }
 */

'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { BulkContentEditSchema } from '@/modules/posts/schemas/post.schema'
import type { BulkContentEdit } from '@/modules/posts/schemas/post.schema'

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Résultat de l'édition de contenu en masse.
 */
export interface BulkEditContentResult {
  /** Nombre de posts effectivement mis à jour */
  updated: number
  /** Nombre de posts ignorés (status PUBLISHED — non modifiables) */
  skipped: number
  /** Messages d'erreur éventuels */
  errors: string[]
}

// ─── Action ───────────────────────────────────────────────────────────────────

/**
 * Applique un texte commun et/ou des médias communs à plusieurs posts en masse.
 *
 * @param data - Données d'édition validées par BulkContentEditSchema
 * @returns Résultat : updated + skipped + errors
 *
 * @example
 *   await bulkEditContent({
 *     postIds: ['id1', 'id2'],
 *     text: '#trending',
 *     textMode: 'append',
 *     mediaUrls: ['https://cdn.example.com/photo.jpg'],
 *   })
 */
export async function bulkEditContent(data: BulkContentEdit): Promise<BulkEditContentResult> {
  // ── Validation Zod ─────────────────────────────────────────────────────────
  const parsed = BulkContentEditSchema.safeParse(data)
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

  // ── Chargement des posts avec ownership check + texte courant (pour append) ─
  const posts = await prisma.post.findMany({
    where: { id: { in: parsed.data.postIds }, userId },
    select: { id: true, status: true, text: true },
  })

  if (posts.length === 0) {
    return { updated: 0, skipped: 0, errors: ['Aucun post trouvé'] }
  }

  // ── Séparation : éligibles vs ignorés ─────────────────────────────────────
  const eligible = posts.filter((p) => p.status !== 'PUBLISHED')
  const skipped = posts.filter((p) => p.status === 'PUBLISHED')

  if (eligible.length === 0) {
    return {
      updated: 0,
      skipped: skipped.length,
      errors: ['Tous les posts sélectionnés sont publiés et ne peuvent pas être modifiés'],
    }
  }

  const { text, textMode, mediaUrls } = parsed.data

  // ── Transaction Prisma : mise à jour individuelle pour le mode 'append' ────
  // En mode 'replace' ou si on ne touche qu'aux médias → updateMany suffit
  // En mode 'append' → chaque post a son propre nouveau texte → updates individuels
  await prisma.$transaction(
    eligible.map((post) => {
      // Calcul du nouveau texte selon le mode
      let newText: string | undefined = undefined
      if (text !== undefined) {
        if (textMode === 'append') {
          // Ajouter le texte après le texte existant (séparé par une nouvelle ligne)
          newText = post.text ? `${post.text}\n${text}` : text
        } else {
          // 'replace' : remplacer entièrement le texte existant
          newText = text
        }
      }

      return prisma.post.update({
        where: { id: post.id, userId },
        data: {
          // Mettre à jour le texte seulement si un texte est fourni
          ...(newText !== undefined && { text: newText }),
          // Mettre à jour les médias seulement si fournis (tableau non vide)
          ...(mediaUrls.length > 0 && { mediaUrls }),
        },
      })
    }),
  )

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
