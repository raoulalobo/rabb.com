/**
 * @file modules/posts/actions/bulk-update-posts.action.ts
 * @module posts
 * @description Server Action : mise à jour groupée de posts via l'API Zernio.
 *   Supporte deux opérations :
 *   - Replanifier : met à jour scheduledFor + timezone pour chaque post
 *   - Passer en brouillon : supprime scheduledFor (le post redevient draft)
 *
 * @example
 *   // Replanifier au 1er avril
 *   await bulkUpdatePosts(['id1', 'id2'], { scheduledFor: new Date('2026-04-01T10:00:00') })
 *
 *   // Passer en brouillon
 *   await bulkUpdatePosts(['id1', 'id2'], { newStatus: 'DRAFT' })
 */

'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'

import { auth } from '@/lib/auth'
import { late } from '@/lib/late'
import { prisma } from '@/lib/prisma'

interface BulkUpdateResult {
  updated: number
  skipped: number
  errors: string[]
}

/**
 * Met à jour plusieurs posts chez Zernio en parallèle.
 *
 * @param postIds - IDs Zernio des posts à modifier
 * @param data - Données de mise à jour (scheduledFor ou newStatus)
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

  // Construire les paramètres de mise à jour
  const updateParams: Record<string, unknown> = {}

  if (data.useQueue) {
    // File d'attente : récupérer le profileId pour queuedFromProfile
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { lateWorkspaceId: true },
    })
    if (!user?.lateWorkspaceId) return { updated: 0, skipped: 0, errors: ['Profil Zernio non configuré'] }
    updateParams.queuedFromProfile = user.lateWorkspaceId
  } else if (data.scheduledFor) {
    // Replanifier : format ISO sans Z + timezone
    const d = data.scheduledFor
    const pad = (n: number): string => String(n).padStart(2, '0')
    updateParams.scheduledFor = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
    updateParams.timezone = 'Europe/Paris'
  } else if (data.newStatus === 'DRAFT') {
    // Passer en brouillon : supprimer la date de planification
    updateParams.scheduledFor = null
  }

  // Mettre à jour chaque post en parallèle
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

  revalidatePath('/calendar')
  revalidatePath('/')

  return { updated, skipped, errors }
}
