/**
 * @file app/api/queue/route.ts
 * @description API Route pour la file d'attente (liste + création de créneaux).
 *
 *   GET  /api/queue → Liste tous les créneaux de l'utilisateur connecté
 *   POST /api/queue → Crée un nouveau créneau (corps validé par Zod)
 *
 *   Authentification requise via better-auth.
 *   Les créneaux sont triés par dayOfWeek ASC, hour ASC, minute ASC.
 *
 * @example
 *   // GET — récupérer tous les créneaux
 *   fetch('/api/queue')
 *   // → { slots: [{ id, dayOfWeek, hour, minute, platform, active, ... }] }
 *
 *   // POST — créer un créneau lundi 9h00
 *   fetch('/api/queue', {
 *     method: 'POST',
 *     body: JSON.stringify({ dayOfWeek: 1, hour: 9, minute: 0 }),
 *   })
 *   // → { slot: { id, dayOfWeek: 1, hour: 9, minute: 0, ... } }
 */

import { NextResponse } from 'next/server'
import { headers } from 'next/headers'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { QueueSlotCreateSchema } from '@/modules/queue/schemas/queue.schema'

// ─── GET /api/queue ──────────────────────────────────────────────────────────

/**
 * Liste tous les créneaux de file d'attente de l'utilisateur connecté.
 * Triés par jour de la semaine puis par heure croissante.
 *
 * @returns JSON { slots: QueueSlot[] }
 */
export async function GET(): Promise<NextResponse> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  try {
    const slots = await prisma.queueSlot.findMany({
      where: { userId: session.user.id },
      orderBy: [
        { dayOfWeek: 'asc' },
        { hour: 'asc' },
        { minute: 'asc' },
      ],
    })

    return NextResponse.json({ slots })
  } catch (error) {
    console.error('[GET /api/queue] Erreur :', error)
    return NextResponse.json(
      { error: 'Erreur lors du chargement des créneaux' },
      { status: 500 },
    )
  }
}

// ─── POST /api/queue ─────────────────────────────────────────────────────────

/**
 * Crée un nouveau créneau de file d'attente.
 * Le corps de la requête est validé par QueueSlotCreateSchema (Zod).
 *
 * @returns JSON { slot: QueueSlot } si créé, { error: string } si échec
 */
export async function POST(request: Request): Promise<NextResponse> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  try {
    const body = await request.json()

    // Validation Zod
    const parsed = QueueSlotCreateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Données invalides' },
        { status: 400 },
      )
    }

    const { dayOfWeek, hour, minute, platform, active } = parsed.data

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

    return NextResponse.json({ slot }, { status: 201 })
  } catch (error) {
    console.error('[POST /api/queue] Erreur :', error)
    return NextResponse.json(
      { error: 'Erreur lors de la création du créneau' },
      { status: 500 },
    )
  }
}
