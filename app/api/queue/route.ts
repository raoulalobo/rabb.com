/**
 * @file app/api/queue/route.ts
 * @description API Route pour la file d'attente — proxy vers Zernio.
 *   Zernio est la source de vérité unique pour les schedules (queues).
 *   Chaque plateforme a son propre schedule (convention "queue:<platform>").
 *
 *   GET /api/queue → Liste tous les schedules du profil et merge les slots
 *   avec l'info plateforme extraite du nom du schedule.
 *
 * @example
 *   fetch('/api/queue')
 *   // → { slots: QueueSlot[], schedules: [...], nextSlots: string[] }
 */

import { NextResponse } from 'next/server'
import { headers } from 'next/headers'

import { auth } from '@/lib/auth'
import { late } from '@/lib/late'
import { prisma } from '@/lib/prisma'
import {
  mapZernioSlots,
  platformFromScheduleName,
} from '@/modules/queue/types'
import type {
  ZernioQueueListAllResponse,
  ZernioQueueListResponse,
  ZernioSchedule,
} from '@/modules/queue/types'

// ─── GET /api/queue ──────────────────────────────────────────────────────────

/**
 * Liste tous les schedules du profil via Zernio (all: true).
 * Normalise les slots de chaque schedule en ajoutant la plateforme
 * extraite du nom du schedule ("queue:linkedin" → platform: "linkedin").
 *
 * @returns JSON { slots: QueueSlot[], schedules: [...], nextSlots: string[] }
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
    // Tenter de lire tous les schedules (all: true)
    const rawData = await late.queue.list(user.lateWorkspaceId, undefined, true)
    const data = rawData as Record<string, unknown>

    // Zernio retourne `queues` (all: true), `schedule` (unique), ou `schedules`
    let schedules: ZernioSchedule[] = []
    if ('queues' in data && Array.isArray(data.queues)) {
      schedules = data.queues as ZernioSchedule[]
    } else if ('schedules' in data && Array.isArray(data.schedules)) {
      schedules = data.schedules as ZernioSchedule[]
    } else if ('schedule' in data && data.schedule) {
      schedules = [data.schedule as ZernioSchedule]
    }

    if (schedules.length === 0) {
      return NextResponse.json({ slots: [], schedules: [], nextSlots: [] })
    }

    // Merger les slots de tous les schedules avec l'info plateforme
    const allSlots = schedules.flatMap((schedule) => {
      const platform = platformFromScheduleName(schedule.name)
      return mapZernioSlots(schedule.slots, platform, schedule._id)
    })

    // Trier par dayOfWeek puis heure
    allSlots.sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.hour - b.hour || a.minute - b.minute)

    return NextResponse.json({
      slots: allSlots,
      schedules: schedules.map((s) => ({
        id: s._id,
        name: s.name,
        platform: platformFromScheduleName(s.name),
        timezone: s.timezone,
        active: s.active,
        slotsCount: s.slots.length,
      })),
      nextSlots: (Array.isArray(data.nextSlots)
        ? data.nextSlots
        : schedules.flatMap((s) => (s as unknown as Record<string, unknown>).nextSlots as string[] ?? [])
      ) as string[],
    })
  } catch (error) {
    console.error('[GET /api/queue] Erreur Zernio :', error)
    const message = error instanceof Error ? error.message : 'Erreur inconnue'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
