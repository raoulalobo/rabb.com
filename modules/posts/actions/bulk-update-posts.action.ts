/**
 * @file modules/posts/actions/bulk-update-posts.action.ts
 * @module posts
 * @description Server Action : mise à jour groupée de posts via l'API Zernio.
 *   Supporte trois opérations :
 *   - Replanifier : met à jour scheduledFor + timezone pour chaque post (parallèle)
 *   - Passer en brouillon : supprime scheduledFor (parallèle)
 *   - File d'attente : récupère les N prochains créneaux via preview, puis assigne
 *     chaque post au créneau suivant via update (parallèle entre plateformes,
 *     séquentiel au sein d'une même plateforme pour éviter les doublons)
 *
 * @example
 *   // Replanifier au 1er avril (parallèle)
 *   await bulkUpdatePosts(['id1', 'id2'], { scheduledFor: new Date('2026-04-01T10:00:00') })
 *
 *   // File d'attente : parallèle entre plateformes, séquentiel par plateforme
 *   await bulkUpdatePosts(['insta-1', 'insta-2', 'twitter-1'], { useQueue: true })
 */

'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'

import { auth } from '@/lib/auth'
import { late } from '@/lib/late'
import type { LatePost } from '@/lib/late'
import { prisma } from '@/lib/prisma'
import { platformFromScheduleName } from '@/modules/queue/types'
import type { ZernioSchedule } from '@/modules/queue/types'

// ─── Types ───────────────────────────────────────────────────────────────────

interface BulkUpdateResult {
  updated: number
  skipped: number
  errors: string[]
}

// ─── Helpers pour le mode file d'attente ─────────────────────────────────────

/**
 * Lit un post Zernio et extrait sa plateforme.
 *
 * @param postId - ID du post Zernio
 * @returns { postId, platform } ou null si le post n'existe plus
 */
async function getPostPlatform(postId: string): Promise<{
  postId: string
  platform: string
} | null> {
  try {
    const post: LatePost = await late.posts.get(postId)
    const platform = post?.platforms?.[0]?.platform ?? 'unknown'
    return { postId, platform }
  } catch {
    return null
  }
}

/**
 * Groupe les posts par plateforme.
 * Lit chaque post en parallèle (lecture seule, pas de locking).
 *
 * @param postIds - IDs Zernio des posts à grouper
 * @returns Map<platform, postIds[]>
 */
async function groupPostsByPlatform(
  postIds: string[],
): Promise<Map<string, string[]>> {
  const posts = await Promise.all(postIds.map(getPostPlatform))

  const groups = new Map<string, string[]>()
  for (const p of posts) {
    if (!p) continue
    const list = groups.get(p.platform) ?? []
    list.push(p.postId)
    groups.set(p.platform, list)
  }
  return groups
}

/**
 * Résout les queueId par plateforme en lisant tous les schedules Zernio.
 * Convention : le nom du schedule est "queue:<platform>".
 *
 * @param profileId - ID du profil Zernio
 * @returns Map<platform, queueId>
 */
async function resolveQueueIds(profileId: string): Promise<Map<string, string>> {
  const rawData = await late.queue.list(profileId, undefined, true)
  const data = rawData as Record<string, unknown>
  const queues = (Array.isArray(data.queues) ? data.queues : []) as ZernioSchedule[]

  const map = new Map<string, string>()
  for (const q of queues) {
    const platform = platformFromScheduleName(q.name)
    map.set(platform, q._id)
  }
  return map
}

/**
 * Assigne séquentiellement les posts d'une plateforme aux prochains créneaux.
 * Utilise `preview` pour obtenir N créneaux d'un coup, puis `update` pour assigner
 * chaque post au créneau correspondant. Aucun post n'est supprimé.
 *
 * @param postIds - IDs des posts de cette plateforme
 * @param profileId - ID du profil Zernio
 * @param queueId - ID du schedule pour cette plateforme (optionnel)
 * @returns { updated, errors }
 */
async function processQueueSequential(
  postIds: string[],
  profileId: string,
  queueId: string | undefined,
): Promise<{ updated: number; errors: string[] }> {
  let updated = 0
  const errors: string[] = []

  // 1. Récupérer les N prochains créneaux via preview
  let slotDates: string[] = []
  try {
    const preview = await late.queue.preview(profileId, postIds.length, queueId)
    slotDates = preview.slots ?? []
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { updated: 0, errors: [`Impossible de récupérer les créneaux : ${msg}`] }
  }

  if (slotDates.length === 0) {
    return { updated: 0, errors: ['Aucun créneau disponible pour cette plateforme'] }
  }

  // 2. Assigner séquentiellement chaque post au créneau suivant
  for (let i = 0; i < postIds.length; i++) {
    const postId = postIds[i]
    const slotDate = slotDates[i]

    if (!slotDate) {
      errors.push(`Pas assez de créneaux disponibles (${slotDates.length} créneaux pour ${postIds.length} posts)`)
      break
    }

    try {
      // Convertir la date UTC retournée par preview en heure locale Europe/Paris.
      // preview retourne "2026-04-01T12:30:00.000Z" (UTC).
      // Zernio attend "2026-04-01T14:30:00" (heure Paris) + timezone: "Europe/Paris".
      // Sans conversion, l'heure UTC serait interprétée comme heure Paris → décalage.
      const utcDate = new Date(slotDate)
      const formatter = new Intl.DateTimeFormat('sv-SE', {
        timeZone: 'Europe/Paris',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      })
      // sv-SE produit "YYYY-MM-DD HH:mm:ss" → on remplace l'espace par T
      const scheduledFor = formatter.format(utcDate).replace(' ', 'T')

      await late.posts.update(postId, {
        scheduledFor,
        timezone: 'Europe/Paris',
        status: 'scheduled',
      } as never)
      updated++
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      errors.push(`[${postId}] ${msg}`)
    }
  }

  return { updated, errors }
}

// ─── Action principale ───────────────────────────────────────────────────────

/**
 * Met à jour plusieurs posts chez Zernio.
 * Stratégie d'exécution adaptative selon le type d'opération :
 * - useQueue    → parallèle entre plateformes, séquentiel par plateforme
 * - reschedule  → tout parallèle
 * - draft       → tout parallèle
 *
 * @param postIds - IDs Zernio des posts à modifier
 * @param data - Données de mise à jour (scheduledFor, newStatus, ou useQueue)
 * @returns Nombre de posts mis à jour, ignorés, et erreurs éventuelles
 */
export async function bulkUpdatePosts(
  postIds: string[],
  data: { scheduledFor?: Date; newStatus?: 'DRAFT'; useQueue?: boolean },
): Promise<BulkUpdateResult> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return { updated: 0, skipped: 0, errors: ['Non authentifié'] }

  if (postIds.length === 0) return { updated: 0, skipped: 0, errors: [] }

  let updated = 0
  let skipped = 0
  const errors: string[] = []

  if (data.useQueue) {
    // ── File d'attente : parallèle entre plateformes, séquentiel par plateforme ──
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { lateWorkspaceId: true },
    })
    if (!user?.lateWorkspaceId) return { updated: 0, skipped: 0, errors: ['Profil Zernio non configuré'] }

    const profileId = user.lateWorkspaceId

    // 1. Grouper les posts par plateforme (lecture parallèle)
    const groups = await groupPostsByPlatform(postIds)

    // 2. Résoudre les queueId par plateforme
    const queueIds = await resolveQueueIds(profileId)

    // 3. Traiter chaque groupe : parallèle entre plateformes, séquentiel au sein
    const groupResults = await Promise.all(
      Array.from(groups.entries()).map(([platform, platformPostIds]) =>
        processQueueSequential(platformPostIds, profileId, queueIds.get(platform)),
      ),
    )

    // 4. Agréger les résultats
    for (const r of groupResults) {
      updated += r.updated
      errors.push(...r.errors)
    }
    skipped = postIds.length - updated
  } else {
    // ── Replanifier ou brouillon : tout parallèle (pas de locking) ────────────
    const updateParams: Record<string, unknown> = {}

    if (data.scheduledFor) {
      const d = data.scheduledFor
      const pad = (n: number): string => String(n).padStart(2, '0')
      updateParams.scheduledFor = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
      updateParams.timezone = 'Europe/Paris'
    } else if (data.newStatus === 'DRAFT') {
      updateParams.scheduledFor = null
    }

    const results = await Promise.allSettled(
      postIds.map((id) => late.posts.update(id, updateParams as never)),
    )

    for (const result of results) {
      if (result.status === 'fulfilled') {
        updated++
      } else {
        skipped++
        const msg = result.reason instanceof Error ? result.reason.message : 'Erreur inconnue'
        errors.push(msg)
      }
    }
  }

  revalidatePath('/calendar')
  revalidatePath('/')

  return { updated, skipped, errors }
}
