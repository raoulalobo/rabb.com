/**
 * @file modules/queue/actions/queue.action.ts
 * @module queue
 * @description Server Actions pour la gestion des créneaux de file d'attente via Zernio.
 *
 *   Zernio stocke un "schedule" (conteneur) avec N slots.
 *   Pour ajouter/supprimer un slot, il faut :
 *   1. Lire le schedule actuel
 *   2. Modifier le tableau slots[] en mémoire
 *   3. Envoyer le schedule complet via PUT
 *
 *   Si aucun schedule n'existe → POST pour créer le premier.
 *
 * @example
 *   await addQueueSlot(1, '09:00')     // Ajouter lundi 9h
 *   await removeQueueSlot(1, '09:00')  // Supprimer lundi 9h
 */

'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'

import { auth } from '@/lib/auth'
import { late } from '@/lib/late'
import { prisma } from '@/lib/prisma'
import type { QueueActionResult, ZernioQueueListResponse, ZernioQueueSlot } from '@/modules/queue/types'

// ─── Helper : récupérer le profileId Zernio ─────────────────────────────────

async function getProfileId(userId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { lateWorkspaceId: true },
  })
  return user?.lateWorkspaceId ?? null
}

// ─── Helper : lire le schedule actuel ────────────────────────────────────────

async function getCurrentSchedule(profileId: string): Promise<{
  scheduleId: string
  slots: ZernioQueueSlot[]
} | null> {
  const data = await late.queue.list(profileId) as ZernioQueueListResponse
  if (!data.exists || !data.schedule) return null
  return { scheduleId: data.schedule._id, slots: data.schedule.slots }
}

// ─── addQueueSlot ────────────────────────────────────────────────────────────

/**
 * Ajoute un créneau au schedule du profil.
 * Si aucun schedule n'existe, crée le premier.
 *
 * @param dayOfWeek - Jour de la semaine (0=dim, 1=lun, ..., 6=sam)
 * @param time - Heure au format "HH:MM" (ex: "09:00")
 */
export async function addQueueSlot(
  dayOfWeek: number,
  time: string,
): Promise<QueueActionResult> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return { success: false, error: 'Non authentifié' }

  const profileId = await getProfileId(session.user.id)
  if (!profileId) return { success: false, error: 'Profil Zernio non configuré' }

  try {
    const current = await getCurrentSchedule(profileId)

    if (!current) {
      // Pas de schedule → créer le premier
      await late.queue.create({
        profileId,
        name: 'Planning semaine',
        timezone: 'Europe/Paris',
        slots: [{ dayOfWeek, time }],
      })
    } else {
      // Schedule existant → ajouter le slot et PUT le schedule complet
      const newSlots = [...current.slots, { dayOfWeek, time }]
      await late.queue.update({
        profileId,
        queueId: current.scheduleId,
        timezone: 'Europe/Paris',
        slots: newSlots,
      })
    }

    revalidatePath('/queue')
    return { success: true }
  } catch (error) {
    console.error('[addQueueSlot] Erreur Zernio :', error)
    const message = error instanceof Error ? error.message : 'Erreur lors de l\'ajout'
    return { success: false, error: message }
  }
}

// ─── removeQueueSlot ─────────────────────────────────────────────────────────

/**
 * Supprime un créneau du schedule.
 * Si c'est le dernier slot → supprime le schedule entier.
 *
 * @param dayOfWeek - Jour de la semaine
 * @param time - Heure au format "HH:MM"
 */
export async function removeQueueSlot(
  dayOfWeek: number,
  time: string,
): Promise<QueueActionResult> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return { success: false, error: 'Non authentifié' }

  const profileId = await getProfileId(session.user.id)
  if (!profileId) return { success: false, error: 'Profil Zernio non configuré' }

  try {
    const current = await getCurrentSchedule(profileId)
    if (!current) return { success: false, error: 'Aucun schedule trouvé' }

    const newSlots = current.slots.filter(
      (s) => !(s.dayOfWeek === dayOfWeek && s.time === time),
    )

    if (newSlots.length === 0) {
      await late.queue.delete(profileId, current.scheduleId)
    } else {
      await late.queue.update({
        profileId,
        queueId: current.scheduleId,
        timezone: 'Europe/Paris',
        slots: newSlots,
      })
    }

    revalidatePath('/queue')
    return { success: true }
  } catch (error) {
    console.error('[removeQueueSlot] Erreur Zernio :', error)
    const message = error instanceof Error ? error.message : 'Erreur lors de la suppression'
    return { success: false, error: message }
  }
}

// ─── updateQueueSlot ─────────────────────────────────────────────────────────

/**
 * Modifie un créneau existant (remplace ancien par nouveau).
 *
 * @param oldDayOfWeek - Ancien jour
 * @param oldTime - Ancienne heure "HH:MM"
 * @param newDayOfWeek - Nouveau jour
 * @param newTime - Nouvelle heure "HH:MM"
 */
export async function updateQueueSlot(
  oldDayOfWeek: number,
  oldTime: string,
  newDayOfWeek: number,
  newTime: string,
): Promise<QueueActionResult> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return { success: false, error: 'Non authentifié' }

  const profileId = await getProfileId(session.user.id)
  if (!profileId) return { success: false, error: 'Profil Zernio non configuré' }

  try {
    const current = await getCurrentSchedule(profileId)
    if (!current) return { success: false, error: 'Aucun schedule trouvé' }

    const newSlots = current.slots
      .filter((s) => !(s.dayOfWeek === oldDayOfWeek && s.time === oldTime))
      .concat({ dayOfWeek: newDayOfWeek, time: newTime })

    await late.queue.update({
      profileId,
      queueId: current.scheduleId,
      timezone: 'Europe/Paris',
      slots: newSlots,
    })

    revalidatePath('/queue')
    return { success: true }
  } catch (error) {
    console.error('[updateQueueSlot] Erreur Zernio :', error)
    const message = error instanceof Error ? error.message : 'Erreur lors de la modification'
    return { success: false, error: message }
  }
}
