/**
 * @file modules/posts/actions/retry-post.action.ts
 * @module posts
 * @description Server Action : relance d'un post échoué via l'API Zernio.
 *   Seules les plateformes en échec sont retentées — les publiées sont ignorées.
 *
 * @example
 *   const result = await retryPost('69b3ee39b04b9d38643f3fc3')
 */

'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'

import { auth } from '@/lib/auth'
import { late } from '@/lib/late'
import { mapZernioPost } from '@/modules/posts/types'
import type { SavePostResult, ZernioRawPost } from '@/modules/posts/types'

/**
 * Relance la publication d'un post échoué chez Zernio.
 *
 * @param postId - ID Zernio du post à relancer
 * @returns SavePostResult avec le post mis à jour ou un message d'erreur
 */
export async function retryPost(
  postId: string,
): Promise<SavePostResult> {
  // ─── Authentification ─────────────────────────────────────────────────────
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return { success: false, error: 'Non authentifié' }
  }

  // ─── Appel Zernio ────────────────────────────────────────────────────────
  try {
    const zernioPost = await late.posts.retry(postId)
    const post = mapZernioPost(zernioPost as unknown as ZernioRawPost)

    // Invalider le cache calendrier
    revalidatePath('/calendar')
    revalidatePath('/')

    return { success: true, post }
  } catch (error) {
    console.error('[retryPost] Erreur Zernio :', error)
    const message = error instanceof Error ? error.message : 'Erreur lors de la relance'
    return { success: false, error: message }
  }
}
