/**
 * @file modules/posts/actions/update-post.action.ts
 * @module posts
 * @description Server Action : modification d'un post existant via l'API Zernio.
 *   Met à jour le contenu, la date de planification, les médias, etc.
 *   Aucune donnée en DB locale — Zernio est la source de vérité unique.
 *
 * @example
 *   const result = await updatePost('69b43106a444e408431e0801', {
 *     text: 'Nouveau contenu',
 *     scheduledFor: new Date('2026-04-01T10:00:00'),
 *   })
 */

'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'

import { auth } from '@/lib/auth'
import { late } from '@/lib/late'
import { mapZernioPost } from '@/modules/posts/types'
import type { SavePostResult, ZernioRawPost } from '@/modules/posts/types'

/**
 * Met à jour un post existant chez Zernio.
 *
 * @param postId - ID Zernio du post à modifier
 * @param data - Champs à mettre à jour
 * @returns SavePostResult avec le post mis à jour ou un message d'erreur
 */
export async function updatePost(
  postId: string,
  data: {
    text?: string
    scheduledFor?: Date | null
    mediaUrls?: string[]
    platformSpecificData?: Record<string, unknown>
  },
): Promise<SavePostResult> {
  // ─── Authentification ─────────────────────────────────────────────────────
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return { success: false, error: 'Non authentifié' }
  }

  // ─── Construire les paramètres de mise à jour ─────────────────────────────
  const params: Record<string, unknown> = {}

  if (data.text !== undefined) {
    params.content = data.text
  }

  if (data.scheduledFor !== undefined) {
    if (data.scheduledFor) {
      // Format ISO sans Z pour Zernio
      const d = data.scheduledFor
      const pad = (n: number): string => String(n).padStart(2, '0')
      params.scheduledFor = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
      params.timezone = 'Europe/Paris'
    } else {
      // Supprimer la date de planification (repasser en draft)
      params.scheduledFor = null
    }
  }

  if (data.mediaUrls !== undefined) {
    params.mediaItems = data.mediaUrls.map((url) => ({
      type: url.match(/\.(mp4|mov|avi|webm)$/i) ? 'video' : 'image',
      url,
      mimeType: url.match(/\.(mp4|mov)$/i) ? 'video/mp4' : 'image/jpeg',
    }))
  }

  // ─── Appel Zernio ────────────────────────────────────────────────────────
  try {
    const zernioPost = await late.posts.update(postId, params as never)
    const post = mapZernioPost(zernioPost as unknown as ZernioRawPost)

    // Invalider le cache calendrier
    revalidatePath('/calendar')
    revalidatePath('/')

    return { success: true, post }
  } catch (error) {
    console.error('[updatePost] Erreur Zernio :', error)
    const message = error instanceof Error ? error.message : 'Erreur lors de la modification'
    return { success: false, error: message }
  }
}
