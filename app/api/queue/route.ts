/**
 * @file app/api/queue/route.ts
 * @description API Route pour la file d'attente — proxy vers Zernio.
 *   Zernio est la source de vérité unique pour les schedules (queues).
 *
 *   GET /api/queue → Liste les créneaux du schedule par défaut du profil
 *   Retourne les slots normalisés + les prochains créneaux calculés.
 *
 * @example
 *   fetch('/api/queue')
 *   // → { slots: QueueSlot[], schedule: ZernioSchedule | null, nextSlots: string[] }
 */

import { NextResponse } from 'next/server'
import { headers } from 'next/headers'

import { auth } from '@/lib/auth'
import { late } from '@/lib/late'
import { prisma } from '@/lib/prisma'
import { mapZernioSlots } from '@/modules/queue/types'
import type { ZernioQueueListResponse } from '@/modules/queue/types'

// ─── GET /api/queue ──────────────────────────────────────────────────────────

/**
 * Liste les créneaux du schedule par défaut via Zernio.
 * Normalise les slots Zernio (time "HH:MM" → hour + minute) pour l'UI.
 *
 * @returns JSON { slots: QueueSlot[], scheduleId: string | null, nextSlots: string[] }
 */
export async function GET(): Promise<NextResponse> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  // Récupérer le profileId Zernio de l'utilisateur
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { lateWorkspaceId: true },
  })

  if (!user?.lateWorkspaceId) {
    return NextResponse.json({ error: 'Profil Zernio non configuré' }, { status: 400 })
  }

  try {
    const data = await late.queue.list(user.lateWorkspaceId) as ZernioQueueListResponse

    // Si aucun schedule n'existe → retourner un tableau vide
    if (!data.exists || !data.schedule) {
      return NextResponse.json({ slots: [], scheduleId: null, nextSlots: [] })
    }

    // Normaliser les slots Zernio pour l'UI
    const slots = mapZernioSlots(data.schedule.slots)

    return NextResponse.json({
      slots,
      scheduleId: data.schedule._id,
      scheduleName: data.schedule.name,
      timezone: data.schedule.timezone,
      active: data.schedule.active,
      nextSlots: data.nextSlots,
    })
  } catch (error) {
    console.error('[GET /api/queue] Erreur Zernio :', error)
    const message = error instanceof Error ? error.message : 'Erreur inconnue'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
