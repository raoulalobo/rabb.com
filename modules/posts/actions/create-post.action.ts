/**
 * @file modules/posts/actions/create-post.action.ts
 * @module posts
 * @description Server Action : création d'un post via l'API Zernio.
 *   Supporte 3 modes :
 *   - Brouillon : ni scheduledFor ni publishNow → sauvegardé comme draft chez Zernio
 *   - Planifié : scheduledFor + timezone → Zernio publie à l'heure prévue
 *   - Publication immédiate : publishNow: true → publié immédiatement
 *
 *   Aucune donnée n'est stockée en DB locale — Zernio est la source de vérité unique.
 *
 * @example
 *   // Brouillon
 *   const result = await createPost({ text: 'Mon post', platform: 'instagram' })
 *
 *   // Planifié
 *   const result = await createPost({
 *     text: 'Mon post',
 *     platform: 'instagram',
 *     scheduledFor: new Date('2026-04-01T10:00:00'),
 *   })
 */

'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'

import { auth } from '@/lib/auth'
import { late } from '@/lib/late'
import { prisma } from '@/lib/prisma'
import { mapZernioPost } from '@/modules/posts/types'
import type { Post, SavePostResult, ZernioRawPost } from '@/modules/posts/types'
import type { LateCreatePostParams } from '@/lib/late'

/**
 * Crée un post chez Zernio (draft, scheduled ou publish now).
 *
 * @param data - Données du post
 * @param data.text - Contenu textuel
 * @param data.platform - Plateforme cible (ex: "instagram")
 * @param data.mediaUrls - URLs des médias Supabase Storage
 * @param data.scheduledFor - Date de publication (null = brouillon)
 * @param data.publishNow - Publier immédiatement
 * @param data.platformSpecificData - Données spécifiques plateforme (firstComment, tiktokSettings, etc.)
 * @returns SavePostResult avec le post normalisé ou un message d'erreur
 */
export async function createPost(data: {
  text: string
  platform: string
  mediaUrls?: string[]
  scheduledFor?: Date | null
  publishNow?: boolean
  /** Planifier via la file d'attente (Zernio assigne le prochain créneau libre) */
  useQueue?: boolean
  platformSpecificData?: Record<string, unknown>
  customContent?: string
}): Promise<SavePostResult> {
  // ─── Authentification ─────────────────────────────────────────────────────
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return { success: false, error: 'Non authentifié' }
  }

  // ─── Récupérer le profileId et l'accountId Zernio ─────────────────────────
  const connectedPlatform = await prisma.connectedPlatform.findFirst({
    where: {
      userId: session.user.id,
      platform: data.platform,
      isActive: true,
    },
    select: { lateProfileId: true },
  })

  if (!connectedPlatform) {
    return { success: false, error: `La plateforme ${data.platform} n'est pas connectée` }
  }

  // Résoudre l'accountId Zernio via l'API accounts
  let accountId: string
  try {
    const accounts = await late.accounts.list() as unknown as Array<{ _id: string; platform: string; profileId: { _id: string } | string }>
    const account = accounts.find(
      (a) => {
        // Gérer l'alias Twitter/X
        const platformMatch = a.platform === data.platform ||
          (data.platform === 'twitter' && a.platform === 'x') ||
          (data.platform === 'x' && a.platform === 'twitter')
        const profileIdStr = typeof a.profileId === 'string' ? a.profileId : a.profileId._id
        return platformMatch && profileIdStr === connectedPlatform.lateProfileId
      },
    )

    if (!account) {
      return { success: false, error: `Compte ${data.platform} introuvable chez Zernio` }
    }
    accountId = account._id
  } catch (error) {
    console.error('[createPost] Erreur résolution accountId :', error)
    return { success: false, error: 'Impossible de résoudre le compte Zernio' }
  }

  // ─── Construire les paramètres Zernio ─────────────────────────────────────
  const params: LateCreatePostParams = {
    profileId: connectedPlatform.lateProfileId,
    content: data.text,
    platforms: [{
      platform: data.platform,
      accountId,
      ...(data.platformSpecificData && { platformSpecificData: data.platformSpecificData }),
      ...(data.customContent && { customContent: data.customContent }),
    }],
    // Mapper les URLs Supabase vers le format LateMediaItem
    ...(data.mediaUrls && data.mediaUrls.length > 0 && {
      mediaItems: data.mediaUrls.map((url) => ({
        type: (url.match(/\.(mp4|mov|avi|webm)$/i) ? 'video' : 'image') as 'image' | 'video',
        url,
        mimeType: url.match(/\.(mp4|mov)$/i) ? 'video/mp4' : 'image/jpeg',
      })),
    }),
  }

  // Mode planifié : ajouter scheduledFor + timezone
  if (data.scheduledFor) {
    // Format ISO sans Z (Zernio attend "2026-04-01T10:00:00", pas "2026-04-01T10:00:00.000Z")
    const d = data.scheduledFor
    const pad = (n: number): string => String(n).padStart(2, '0')
    params.scheduledFor = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
    params.timezone = 'Europe/Paris' // MVP francophone — à rendre configurable
  }

  // Mode publication immédiate
  if (data.publishNow) {
    params.publishNow = true
  }

  // Mode file d'attente : Zernio assigne le prochain créneau libre (avec locking).
  // On passe le queueId du schedule de la plateforme pour que Zernio utilise
  // les bons créneaux et avance correctement au prochain slot libre.
  if (data.useQueue) {
    params.queuedFromProfile = connectedPlatform.lateProfileId

    // Chercher le schedule spécifique à cette plateforme ("queue:<platform>")
    try {
      const { scheduleNameForPlatform } = await import('@/modules/queue/types')
      const rawData = await late.queue.list(connectedPlatform.lateProfileId, undefined, true)
      const queueData = rawData as Record<string, unknown>
      const queues = (Array.isArray(queueData.queues) ? queueData.queues : []) as Array<{ _id: string; name: string }>
      const targetName = scheduleNameForPlatform(data.platform)
      const platformQueue = queues.find((q) => q.name === targetName)
      if (platformQueue) {
        params.queueId = platformQueue._id
      }
    } catch {
      // Pas de schedule trouvé → Zernio utilisera le schedule par défaut
    }
  }

  // ─── Appel Zernio — API-first (rien en DB locale) ────────────────────────
  try {
    const zernioPost = await late.posts.create(params)
    const post = mapZernioPost(zernioPost as unknown as ZernioRawPost)

    // Invalider le cache calendrier
    revalidatePath('/calendar')
    revalidatePath('/')

    return { success: true, post }
  } catch (error) {
    console.error('[createPost] Erreur Zernio :', error)
    const message = error instanceof Error ? error.message : 'Erreur lors de la création'
    return { success: false, error: message }
  }
}
