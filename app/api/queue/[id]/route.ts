/**
 * @file app/api/queue/[id]/route.ts
 * @description API Route pour la modification et suppression d'un créneau de file d'attente.
 *
 *   PATCH  /api/queue/:id → Met à jour un créneau existant (champs partiels)
 *   DELETE /api/queue/:id → Supprime un créneau
 *
 *   Authentification requise via better-auth.
 *   Ownership check : seul le propriétaire du créneau peut le modifier/supprimer.
 *
 * @example
 *   // PATCH — modifier l'heure d'un créneau
 *   fetch('/api/queue/clxxx', {
 *     method: 'PATCH',
 *     body: JSON.stringify({ hour: 10, minute: 30 }),
 *   })
 *
 *   // DELETE — supprimer un créneau
 *   fetch('/api/queue/clxxx', { method: 'DELETE' })
 */

import { NextResponse } from 'next/server'
import { headers } from 'next/headers'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { QueueSlotUpdateSchema } from '@/modules/queue/schemas/queue.schema'

// ─── Types des params de route ───────────────────────────────────────────────

/** Paramètres de la route dynamique /api/queue/[id] */
interface RouteParams {
  params: Promise<{ id: string }>
}

// ─── PATCH /api/queue/:id ────────────────────────────────────────────────────

/**
 * Met à jour un créneau de file d'attente existant.
 * Le corps peut contenir n'importe quel sous-ensemble de champs modifiables.
 * L'ID du créneau provient de l'URL.
 *
 * @param request - Requête HTTP avec le corps JSON partiel
 * @param params - Paramètres de route contenant l'ID du créneau
 * @returns JSON { slot: QueueSlot } si mis à jour, { error: string } si échec
 */
export async function PATCH(
  request: Request,
  { params }: RouteParams,
): Promise<NextResponse> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  const { id } = await params

  try {
    const body = await request.json()

    // Ajouter l'ID de l'URL au corps pour la validation Zod
    const parsed = QueueSlotUpdateSchema.safeParse({ ...body, id })
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Données invalides' },
        { status: 400 },
      )
    }

    // Ownership check : vérifier que le créneau appartient à l'utilisateur
    const existing = await prisma.queueSlot.findUnique({
      where: { id },
      select: { userId: true },
    })

    if (!existing || existing.userId !== session.user.id) {
      return NextResponse.json({ error: 'Créneau introuvable' }, { status: 404 })
    }

    const { id: _id, ...updateData } = parsed.data

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

    return NextResponse.json({ slot })
  } catch (error) {
    console.error('[PATCH /api/queue/:id] Erreur :', error)
    return NextResponse.json(
      { error: 'Erreur lors de la mise à jour du créneau' },
      { status: 500 },
    )
  }
}

// ─── DELETE /api/queue/:id ───────────────────────────────────────────────────

/**
 * Supprime un créneau de file d'attente.
 * Vérifie que le créneau appartient à l'utilisateur connecté avant suppression.
 *
 * @param _request - Requête HTTP (non utilisée)
 * @param params - Paramètres de route contenant l'ID du créneau
 * @returns JSON { success: true } si supprimé, { error: string } si échec
 */
export async function DELETE(
  _request: Request,
  { params }: RouteParams,
): Promise<NextResponse> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  const { id } = await params

  try {
    // Ownership check
    const existing = await prisma.queueSlot.findUnique({
      where: { id },
      select: { userId: true },
    })

    if (!existing || existing.userId !== session.user.id) {
      return NextResponse.json({ error: 'Créneau introuvable' }, { status: 404 })
    }

    await prisma.queueSlot.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[DELETE /api/queue/:id] Erreur :', error)
    return NextResponse.json(
      { error: 'Erreur lors de la suppression du créneau' },
      { status: 500 },
    )
  }
}
