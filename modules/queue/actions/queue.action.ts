/**
 * @file modules/queue/actions/queue.action.ts
 * @module queue
 * @description Server Actions CRUD pour les créneaux de file d'attente.
 *   Valide les données avec Zod, vérifie la session, persiste en base de données.
 *
 *   Trois actions exportées :
 *   - createQueueSlot : crée un nouveau créneau horaire récurrent
 *   - updateQueueSlot : modifie un créneau existant (heure, plateforme, actif/inactif)
 *   - deleteQueueSlot : supprime un créneau
 *
 * @example
 *   // Créer un créneau lundi à 9h00
 *   const result = await createQueueSlot({ dayOfWeek: 1, hour: 9, minute: 0 })
 *   if (result.success) {
 *     // result.slot contient le créneau créé
 *   }
 */

'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { QueueSlotCreateSchema, QueueSlotUpdateSchema } from '@/modules/queue/schemas/queue.schema'
import type { QueueActionResult, QueueDeleteResult, QueueSlot } from '@/modules/queue/types'

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Mappe un enregistrement Prisma QueueSlot vers l'interface QueueSlot du module.
 *
 * @param record - Enregistrement Prisma brut
 * @returns QueueSlot typé pour le module
 */
function mapPrismaSlot(record: {
  id: string
  userId: string
  dayOfWeek: number
  hour: number
  minute: number
  platform: string | null
  active: boolean
  createdAt: Date
  updatedAt: Date
}): QueueSlot {
  return {
    id: record.id,
    userId: record.userId,
    dayOfWeek: record.dayOfWeek,
    hour: record.hour,
    minute: record.minute,
    platform: record.platform,
    active: record.active,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  }
}

// ─── createQueueSlot ─────────────────────────────────────────────────────────

/**
 * Crée un nouveau créneau de file d'attente.
 * Valide les données avec QueueSlotCreateSchema, vérifie l'authentification,
 * puis persiste en base de données.
 *
 * @param rawData - Données brutes du formulaire (non validées)
 * @returns { success: true, slot } si OK, { success: false, error } si KO
 *
 * @example
 *   // Créneau lundi 9h00 pour toutes les plateformes
 *   await createQueueSlot({ dayOfWeek: 1, hour: 9, minute: 0 })
 *
 *   // Créneau mercredi 14h30 pour Instagram uniquement
 *   await createQueueSlot({ dayOfWeek: 3, hour: 14, minute: 30, platform: 'instagram' })
 */
export async function createQueueSlot(rawData: unknown): Promise<QueueActionResult> {
  // ─── Authentification ─────────────────────────────────────────────────────
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return { success: false, error: 'Non authentifié' }
  }

  // ─── Validation Zod ────────────────────────────────────────────────────────
  const parsed = QueueSlotCreateSchema.safeParse(rawData)
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Données invalides',
    }
  }

  const { dayOfWeek, hour, minute, platform, active } = parsed.data

  try {
    const slot = await prisma.queueSlot.create({
      data: {
        userId: session.user.id,
        dayOfWeek,
        hour,
        minute,
        platform: platform ?? null,
        active: active ?? true,
      },
    })

    // Invalide le cache de la page queue
    revalidatePath('/queue')

    return { success: true, slot: mapPrismaSlot(slot) }
  } catch (error) {
    console.error('[createQueueSlot] Erreur création créneau :', error)
    return { success: false, error: 'Erreur lors de la création du créneau' }
  }
}

// ─── updateQueueSlot ─────────────────────────────────────────────────────────

/**
 * Met à jour un créneau de file d'attente existant.
 * Vérifie que le créneau appartient à l'utilisateur connecté (ownership check).
 *
 * @param rawData - Données brutes avec `id` (validées par QueueSlotUpdateSchema)
 * @returns { success: true, slot } si OK, { success: false, error } si KO
 *
 * @example
 *   // Changer l'heure d'un créneau à 10h00
 *   await updateQueueSlot({ id: 'clxxx', hour: 10, minute: 0 })
 *
 *   // Désactiver un créneau sans le supprimer
 *   await updateQueueSlot({ id: 'clxxx', active: false })
 */
export async function updateQueueSlot(rawData: unknown): Promise<QueueActionResult> {
  // ─── Authentification ─────────────────────────────────────────────────────
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return { success: false, error: 'Non authentifié' }
  }

  // ─── Validation Zod ────────────────────────────────────────────────────────
  const parsed = QueueSlotUpdateSchema.safeParse(rawData)
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Données invalides',
    }
  }

  const { id, ...updateData } = parsed.data

  // ─── Ownership check ──────────────────────────────────────────────────────
  const existing = await prisma.queueSlot.findUnique({
    where: { id },
    select: { userId: true },
  })

  if (!existing || existing.userId !== session.user.id) {
    return { success: false, error: 'Créneau introuvable' }
  }

  try {
    const slot = await prisma.queueSlot.update({
      where: { id },
      data: {
        ...(updateData.dayOfWeek !== undefined && { dayOfWeek: updateData.dayOfWeek }),
        ...(updateData.hour !== undefined && { hour: updateData.hour }),
        ...(updateData.minute !== undefined && { minute: updateData.minute }),
        ...(updateData.platform !== undefined && { platform: updateData.platform ?? null }),
        ...(updateData.active !== undefined && { active: updateData.active }),
      },
    })

    revalidatePath('/queue')

    return { success: true, slot: mapPrismaSlot(slot) }
  } catch (error) {
    console.error('[updateQueueSlot] Erreur mise à jour créneau :', error)
    return { success: false, error: 'Erreur lors de la mise à jour du créneau' }
  }
}

// ─── deleteQueueSlot ─────────────────────────────────────────────────────────

/**
 * Supprime un créneau de file d'attente.
 * Vérifie que le créneau appartient à l'utilisateur connecté avant suppression.
 *
 * @param slotId - ID du créneau à supprimer
 * @returns { success: true } si supprimé, { success: false, error } si KO
 *
 * @example
 *   const result = await deleteQueueSlot('clxxx')
 *   if (result.success) {
 *     // Créneau supprimé
 *   }
 */
export async function deleteQueueSlot(slotId: string): Promise<QueueDeleteResult> {
  // ─── Authentification ─────────────────────────────────────────────────────
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return { success: false, error: 'Non authentifié' }
  }

  // ─── Ownership check ──────────────────────────────────────────────────────
  const existing = await prisma.queueSlot.findUnique({
    where: { id: slotId },
    select: { userId: true },
  })

  if (!existing || existing.userId !== session.user.id) {
    return { success: false, error: 'Créneau introuvable' }
  }

  try {
    await prisma.queueSlot.delete({ where: { id: slotId } })

    revalidatePath('/queue')

    return { success: true }
  } catch (error) {
    console.error('[deleteQueueSlot] Erreur suppression créneau :', error)
    return { success: false, error: 'Erreur lors de la suppression du créneau' }
  }
}
