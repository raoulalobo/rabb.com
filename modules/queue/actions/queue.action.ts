/**
 * @file modules/queue/actions/queue.action.ts
 * @module queue
 * @description Server Actions pour la gestion des créneaux de file d'attente via Zernio.
 *
 *   Chaque plateforme a son propre schedule Zernio (convention "queue:<platform>").
 *   Pour ajouter/supprimer un slot, il faut :
 *   1. Lire les schedules actuels (all: true)
 *   2. Trouver le schedule de la plateforme ciblée
 *   3. Modifier le tableau slots[] en mémoire
 *   4. Envoyer le schedule complet via PUT
 *
 *   Si aucun schedule n'existe pour cette plateforme → POST pour créer le premier.
 *
 * @example
 *   await addQueueSlot(1, '09:00', 'linkedin')     // Ajouter lundi 9h pour LinkedIn
 *   await removeQueueSlot(1, '09:00', 'linkedin')  // Supprimer lundi 9h pour LinkedIn
 */

'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'

import { auth } from '@/lib/auth'
import { late } from '@/lib/late'
import { prisma } from '@/lib/prisma'
import type {
  QueueActionResult,
  ZernioQueueListAllResponse,
  ZernioSchedule,
  ZernioQueueSlot,
} from '@/modules/queue/types'
import { scheduleNameForPlatform } from '@/modules/queue/types'

// ─── Helper : récupérer le profileId Zernio ─────────────────────────────────

/**
 * Récupère le profileId Zernio stocké en DB pour un utilisateur.
 *
 * @param userId - ID de l'utilisateur en DB locale
 * @returns profileId Zernio ou null
 */
async function getProfileId(userId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { lateWorkspaceId: true },
  })
  return user?.lateWorkspaceId ?? null
}

// ─── Helper : trouver le schedule d'une plateforme ──────────────────────────

/**
 * Récupère le schedule Zernio associé à une plateforme.
 * Cherche un schedule dont le nom est "queue:<platform>".
 *
 * @param profileId - ID du profil Zernio
 * @param platform - Nom de la plateforme (ex: "linkedin")
 * @returns Le schedule trouvé ou null
 */
/**
 * Récupère le schedule Zernio associé à une plateforme.
 * Cherche un schedule dont le nom est "queue:<platform>".
 * Gère les deux formats de réponse Zernio : `queues` (array) et `schedules` (array).
 *
 * @param profileId - ID du profil Zernio
 * @param platform - Nom de la plateforme (ex: "linkedin")
 * @returns Le schedule trouvé ou null
 */
async function getScheduleForPlatform(
  profileId: string,
  platform: string,
): Promise<{ scheduleId: string; slots: ZernioQueueSlot[] } | null> {
  const rawData = await late.queue.list(profileId, undefined, true)
  const data = rawData as Record<string, unknown>

  // Zernio retourne `queues` (constaté) ou `schedules` selon la version
  const schedules: ZernioSchedule[] =
    (Array.isArray(data.queues) ? data.queues : Array.isArray(data.schedules) ? data.schedules : []) as ZernioSchedule[]

  if (schedules.length === 0) return null

  const targetName = scheduleNameForPlatform(platform)
  const schedule = schedules.find((s: ZernioSchedule) => s.name === targetName)
  if (!schedule) return null

  return { scheduleId: schedule._id, slots: schedule.slots }
}

// ─── addQueueSlot ────────────────────────────────────────────────────────────

/**
 * Ajoute un créneau au schedule de la plateforme spécifiée.
 * Si aucun schedule n'existe pour cette plateforme, en crée un nouveau.
 *
 * @param dayOfWeek - Jour de la semaine (0=dim, 1=lun, ..., 6=sam)
 * @param time - Heure au format "HH:MM" (ex: "09:00")
 * @param platform - Plateforme ciblée (ex: "linkedin", "instagram")
 */
export async function addQueueSlot(
  dayOfWeek: number,
  time: string,
  platform: string,
  timezone: string,
): Promise<QueueActionResult> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return { success: false, error: 'Non authentifié' }

  const profileId = await getProfileId(session.user.id)
  if (!profileId) return { success: false, error: 'Profil Zernio non configuré' }

  try {
    const current = await getScheduleForPlatform(profileId, platform)

    if (!current) {
      // Pas de schedule pour cette plateforme → créer le premier
      const scheduleName = scheduleNameForPlatform(platform)
      await late.queue.create({
        profileId,
        name: scheduleName,
        timezone,
        slots: [{ dayOfWeek, time }],
      })
    } else {
      // Schedule existant → ajouter le slot et PUT le schedule complet
      const newSlots = [...current.slots, { dayOfWeek, time }]
      await late.queue.update({
        profileId,
        queueId: current.scheduleId,
        timezone,
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
 * Supprime un créneau du schedule de la plateforme.
 * Si c'est le dernier slot → supprime le schedule entier.
 *
 * @param dayOfWeek - Jour de la semaine
 * @param time - Heure au format "HH:MM"
 * @param platform - Plateforme ciblée
 */
export async function removeQueueSlot(
  dayOfWeek: number,
  time: string,
  platform: string,
  timezone: string,
): Promise<QueueActionResult> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return { success: false, error: 'Non authentifié' }

  const profileId = await getProfileId(session.user.id)
  if (!profileId) return { success: false, error: 'Profil Zernio non configuré' }

  try {
    const current = await getScheduleForPlatform(profileId, platform)
    if (!current) return { success: false, error: 'Aucun schedule trouvé pour cette plateforme' }

    const newSlots = current.slots.filter(
      (s) => !(s.dayOfWeek === dayOfWeek && s.time === time),
    )

    if (newSlots.length === 0) {
      // Dernier slot → supprimer le schedule entier
      await late.queue.delete(profileId, current.scheduleId)
    } else {
      await late.queue.update({
        profileId,
        queueId: current.scheduleId,
        timezone,
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
 * Si la plateforme change, le slot est déplacé entre schedules.
 *
 * @param oldDayOfWeek - Ancien jour
 * @param oldTime - Ancienne heure "HH:MM"
 * @param oldPlatform - Ancienne plateforme
 * @param newDayOfWeek - Nouveau jour
 * @param newTime - Nouvelle heure "HH:MM"
 * @param newPlatform - Nouvelle plateforme
 */
export async function updateQueueSlot(
  oldDayOfWeek: number,
  oldTime: string,
  oldPlatform: string,
  newDayOfWeek: number,
  newTime: string,
  newPlatform: string,
  timezone: string,
): Promise<QueueActionResult> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return { success: false, error: 'Non authentifié' }

  const profileId = await getProfileId(session.user.id)
  if (!profileId) return { success: false, error: 'Profil Zernio non configuré' }

  try {
    if (oldPlatform === newPlatform) {
      // Même plateforme → simple remplacement dans le même schedule
      const current = await getScheduleForPlatform(profileId, oldPlatform)
      if (!current) return { success: false, error: 'Aucun schedule trouvé' }

      const newSlots = current.slots
        .filter((s) => !(s.dayOfWeek === oldDayOfWeek && s.time === oldTime))
        .concat({ dayOfWeek: newDayOfWeek, time: newTime })

      await late.queue.update({
        profileId,
        queueId: current.scheduleId,
        timezone,
        slots: newSlots,
      })
    } else {
      // Changement de plateforme → supprimer de l'ancien schedule, ajouter au nouveau
      // 1. Supprimer de l'ancien
      const oldSchedule = await getScheduleForPlatform(profileId, oldPlatform)
      if (oldSchedule) {
        const remainingSlots = oldSchedule.slots.filter(
          (s) => !(s.dayOfWeek === oldDayOfWeek && s.time === oldTime),
        )
        if (remainingSlots.length === 0) {
          await late.queue.delete(profileId, oldSchedule.scheduleId)
        } else {
          await late.queue.update({
            profileId,
            queueId: oldSchedule.scheduleId,
            timezone,
            slots: remainingSlots,
          })
        }
      }

      // 2. Ajouter au nouveau schedule (crée si nécessaire)
      const newSchedule = await getScheduleForPlatform(profileId, newPlatform)
      if (!newSchedule) {
        await late.queue.create({
          profileId,
          name: scheduleNameForPlatform(newPlatform),
          timezone,
          slots: [{ dayOfWeek: newDayOfWeek, time: newTime }],
        })
      } else {
        const newSlots = [...newSchedule.slots, { dayOfWeek: newDayOfWeek, time: newTime }]
        await late.queue.update({
          profileId,
          queueId: newSchedule.scheduleId,
          timezone,
          slots: newSlots,
        })
      }
    }

    revalidatePath('/queue')
    return { success: true }
  } catch (error) {
    console.error('[updateQueueSlot] Erreur Zernio :', error)
    const message = error instanceof Error ? error.message : 'Erreur lors de la modification'
    return { success: false, error: message }
  }
}
