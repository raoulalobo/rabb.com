/**
 * @file modules/posts/actions/bulk-delete-posts.action.ts
 * @module posts
 * @description Server Action : suppression groupée de posts via l'API Zernio.
 *   Supprime chaque post en parallèle. Les erreurs individuelles sont collectées
 *   mais n'empêchent pas la suppression des autres posts.
 *
 * @example
 *   const result = await bulkDeletePosts(['69b43106...', '69b3ee39...'])
 *   // → { deleted: 2, skipped: 0, errors: [] }
 */

'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'

import { auth } from '@/lib/auth'
import { late } from '@/lib/late'

interface BulkDeleteResult {
  deleted: number
  skipped: number
  errors: string[]
}

/**
 * Supprime plusieurs posts chez Zernio en parallèle.
 *
 * @param postIds - IDs Zernio des posts à supprimer
 * @returns Nombre de posts supprimés, ignorés, et erreurs éventuelles
 */
export async function bulkDeletePosts(postIds: string[]): Promise<BulkDeleteResult> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return { deleted: 0, skipped: 0, errors: ['Non authentifié'] }

  if (postIds.length === 0) return { deleted: 0, skipped: 0, errors: [] }

  let deleted = 0
  let skipped = 0
  const errors: string[] = []

  // Supprimer chaque post en parallèle
  const results = await Promise.allSettled(
    postIds.map((id) => late.posts.delete(id)),
  )

  for (const result of results) {
    if (result.status === 'fulfilled') {
      deleted++
    } else {
      // Post déjà supprimé ou erreur → compter comme skipped
      skipped++
      const msg = result.reason instanceof Error ? result.reason.message : 'Erreur inconnue'
      errors.push(msg)
    }
  }

  revalidatePath('/calendar')
  revalidatePath('/')

  return { deleted, skipped, errors }
}
