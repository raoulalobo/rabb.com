/**
 * @file modules/posts/actions/update-post.action.ts
 * @module posts
 * @description Server Action : modification d'un post existant via l'API Zernio.
 *   Met à jour le contenu, la date de planification, les médias, etc.
 *   Supporte également la publication immédiate et la mise en file d'attente.
 *   Aucune donnée en DB locale — Zernio est la source de vérité unique.
 *
 * @example
 *   // Modifier le contenu et reprogrammer
 *   await updatePost('69b43106a444e408431e0801', {
 *     text: 'Nouveau contenu',
 *     scheduledFor: new Date('2026-04-01T10:00:00'),
 *   })
 *
 *   // Publier immédiatement un post planifié (testé le 2026-03-29)
 *   await updatePost('69b43106a444e408431e0801', { publishNow: true })
 *
 *   // Mettre en file d'attente un post existant
 *   await updatePost('69b43106a444e408431e0801', { useQueue: true, platform: 'instagram' })
 */

'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'

import { auth } from '@/lib/auth'
import { late } from '@/lib/late'
import { prisma } from '@/lib/prisma'
import { mapZernioPost } from '@/modules/posts/types'
import type { SavePostResult, ZernioRawPost } from '@/modules/posts/types'

/**
 * Met à jour un post existant chez Zernio.
 * Testé le 2026-03-29 : PUT /v1/posts/:id accepte publishNow: true
 * et répond "Post updated and published successfully" avec status "published".
 *
 * @param postId - ID Zernio du post à modifier
 * @param data - Champs à mettre à jour
 * @param data.text - Nouveau contenu textuel
 * @param data.scheduledFor - Nouvelle date planifiée (null = repasser en brouillon)
 * @param data.mediaUrls - Nouvelles URLs médias
 * @param data.publishNow - Si true : publie immédiatement (exclusif avec scheduledFor)
 * @param data.useQueue - Si true : Zernio assigne le prochain créneau libre de la file
 * @param data.platform - Plateforme cible — requis uniquement quand useQueue: true
 * @param data.platformSpecificData - Données spécifiques plateforme
 * @returns SavePostResult avec le post mis à jour ou un message d'erreur
 */
export async function updatePost(
  postId: string,
  data: {
    text?: string
    scheduledFor?: Date | null
    mediaUrls?: string[]
    /** Si true, Zernio publie immédiatement (testé : accepté sur PUT /v1/posts/:id) */
    publishNow?: boolean
    /**
     * Si true, Zernio assigne le prochain créneau libre de la file d'attente.
     * Requiert `platform` pour trouver le schedule spécifique à la plateforme.
     */
    useQueue?: boolean
    /** Plateforme cible — requis uniquement quand useQueue: true */
    platform?: string
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

  // Publication immédiate — testé le 2026-03-29 : accepté sur PUT /v1/posts/:id
  // Répond { status: "published", message: "Post updated and published successfully" }
  if (data.publishNow) {
    params.publishNow = true
  }

  // ─── Mode file d'attente ─────────────────────────────────────────────────
  // Même logique que createPost : récupérer le profileId depuis Prisma (1 requête légère),
  // puis le queueId spécifique à la plateforme via l'API Zernio.
  if (data.useQueue) {
    // Une seule requête Prisma pour obtenir le lateWorkspaceId (profileId Zernio)
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { lateWorkspaceId: true },
    })
    const profileId = user?.lateWorkspaceId

    if (!profileId) {
      return { success: false, error: 'Profil Zernio non configuré' }
    }

    // Le profileId est requis par Zernio pour assigner un créneau de la file
    params.queuedFromProfile = profileId

    // Chercher le schedule spécifique à la plateforme ("queue:<platform>")
    // pour que Zernio utilise les bons créneaux et avance au prochain slot libre
    if (data.platform) {
      try {
        const { scheduleNameForPlatform } = await import('@/modules/queue/types')
        const rawData = await late.queue.list(profileId, undefined, true)
        const queueData = rawData as Record<string, unknown>
        const queues = (Array.isArray(queueData.queues) ? queueData.queues : []) as Array<{ _id: string; name: string }>
        const targetName = scheduleNameForPlatform(data.platform)
        const platformQueue = queues.find((q) => q.name === targetName)
        if (platformQueue) {
          params.queueId = platformQueue._id
        }
      } catch {
        // Pas de schedule trouvé → Zernio utilisera le schedule par défaut du profil
      }
    }
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
