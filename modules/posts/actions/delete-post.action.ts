/**
 * @file modules/posts/actions/delete-post.action.ts
 * @module posts
 * @description Server Action : suppression d'un post via l'API Zernio.
 *   Supprime le post chez Zernio (source de vérité unique).
 *   Aucune donnée en DB locale à nettoyer.
 *
 * @example
 *   const result = await deletePost('69b43106a444e408431e0801')
 */

'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'

import { auth } from '@/lib/auth'
import { late } from '@/lib/late'

/**
 * Supprime un post chez Zernio.
 *
 * @param postId - ID Zernio du post à supprimer
 * @returns { success: true } si supprimé, { success: false, error } si erreur
 */
export async function deletePost(
  postId: string,
): Promise<{ success: boolean; error?: string }> {
  // ─── Authentification ─────────────────────────────────────────────────────
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return { success: false, error: 'Non authentifié' }
  }

  // ─── Appel Zernio ────────────────────────────────────────────────────────
  try {
    await late.posts.delete(postId)

    // Invalider le cache calendrier
    revalidatePath('/calendar')
    revalidatePath('/')

    return { success: true }
  } catch (error) {
    console.error('[deletePost] Erreur Zernio :', error)
    const message = error instanceof Error ? error.message : 'Erreur lors de la suppression'
    return { success: false, error: message }
  }
}
