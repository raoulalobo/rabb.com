/**
 * @file app/api/posts/[id]/route.ts
 * @description Route Handler pour les opérations sur un post individuel.
 *
 *   DELETE /api/posts/[id]
 *   → Supprime le post si l'utilisateur en est le propriétaire et si le statut le permet
 *     (DRAFT ou SCHEDULED uniquement — pas PUBLISHED ni FAILED).
 *
 *   PATCH /api/posts/[id]
 *   → Replanifie le post (change scheduledFor).
 *     Body : { scheduledFor: string (ISO) | null }
 *     - null           : retire la date → status passe à DRAFT + cancel Inngest
 *     - date future    : status passe à SCHEDULED + cancel Inngest existant + reschedule
 *     Retourne le post mis à jour (objet Post complet).
 *
 * @example
 *   // Replanification depuis PostComposeCard
 *   const res = await fetch(`/api/posts/${post.id}`, {
 *     method: 'PATCH',
 *     headers: { 'Content-Type': 'application/json' },
 *     body: JSON.stringify({ scheduledFor: '2026-03-01T09:00:00.000Z' }),
 *   })
 *   const updatedPost = await res.json()
 *
 *   // Suppression de la date (retour en DRAFT)
 *   const res = await fetch(`/api/posts/${post.id}`, {
 *     method: 'PATCH',
 *     body: JSON.stringify({ scheduledFor: null }),
 *   })
 */

import { headers } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { auth } from '@/lib/auth'
import { inngest } from '@/lib/inngest/client'
import { prisma } from '@/lib/prisma'

// ─── Schéma PATCH ─────────────────────────────────────────────────────────────

/**
 * Validation Zod du body PATCH.
 * scheduledFor : ISO string (date future) ou null (retour en DRAFT).
 */
const PatchBodySchema = z.object({
  scheduledFor: z.string().datetime().nullable(),
})

/**
 * DELETE /api/posts/[id]
 * Supprime un post DRAFT ou SCHEDULED appartenant à l'utilisateur connecté.
 *
 * @param request - Requête HTTP
 * @param params - Paramètres de route contenant l'ID du post
 * @returns 200 si supprimé, 401/403/404/409 selon le cas
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  // ── Authentification ────────────────────────────────────────────────────
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  const { id: postId } = await params

  // ── Ownership check + vérification du statut ────────────────────────────
  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: { userId: true, status: true },
  })

  if (!post || post.userId !== session.user.id) {
    // Ne pas révéler si le post existe ou non (sécurité)
    return NextResponse.json({ error: 'Post introuvable' }, { status: 404 })
  }

  // Seuls les posts DRAFT ou SCHEDULED peuvent être supprimés
  if (post.status === 'PUBLISHED' || post.status === 'FAILED') {
    return NextResponse.json(
      { error: 'Ce post ne peut pas être supprimé (déjà publié ou en échec)' },
      { status: 409 },
    )
  }

  // ── Suppression ──────────────────────────────────────────────────────────
  try {
    await prisma.post.delete({ where: { id: postId } })
  } catch (error) {
    console.error('[DELETE /api/posts/[id]] Erreur suppression :', error)
    return NextResponse.json({ error: 'Erreur lors de la suppression' }, { status: 500 })
  }

  // ── Annulation du run Inngest (séparée pour ne pas faire échouer la réponse) ──
  // Sans cet event, le run resterait en état sleeping jusqu'à scheduledFor
  // avant de retourner { skipped: true } ("run zombie").
  // Le `cancelOn` défini dans publish-scheduled-post.ts corrèle les deux
  // events via data.postId → Inngest annule immédiatement le run correspondant.
  if (post.status === 'SCHEDULED') {
    if (!process.env.INNGEST_EVENT_KEY) {
      // En local sans clé Inngest, on skip l'annulation — pas de run à annuler.
      console.warn('[DELETE /api/posts/[id]] INNGEST_EVENT_KEY non défini — annulation Inngest ignorée (mode local).')
    } else {
      try {
        await inngest.send({ name: 'post/cancel', data: { postId } })
      } catch (inngestError) {
        // Le post est déjà supprimé en DB. Le run Inngest "zombie" échouera à
        // retrouver le post et sera skippé proprement par le cancelOn.
        console.error('[DELETE /api/posts/[id]] Échec annulation Inngest (post supprimé en DB) :', inngestError)
      }
    }
  }

  // Invalide les caches des pages affectées
  revalidatePath('/compose')

  return NextResponse.json({ success: true })
}

// ─── PATCH /api/posts/[id] — replanification inline ──────────────────────────

/**
 * PATCH /api/posts/[id]
 * Modifie uniquement scheduledFor (et le status associé) d'un post DRAFT ou SCHEDULED.
 *
 * Logique Inngest :
 *   - Si le post était SCHEDULED → cancel l'ancien run via "post/cancel"
 *   - Si la nouvelle date est fournie → déclenche un nouveau run via "post/schedule"
 *   - Si scheduledFor = null → le post repasse en DRAFT, aucun nouveau run
 *
 * @param request - Body JSON : { scheduledFor: string (ISO) | null }
 * @param params  - Paramètres de route : { id: string }
 * @returns 200 Post mis à jour | 400 body invalide | 401 | 403 | 404 | 409
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  // ── Authentification ───────────────────────────────────────────────────────
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  // ── Validation du body ─────────────────────────────────────────────────────
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body JSON invalide' }, { status: 400 })
  }

  const parsed = PatchBodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Données invalides', details: parsed.error.issues },
      { status: 400 },
    )
  }

  const { scheduledFor: scheduledForRaw } = parsed.data
  const { id: postId } = await params

  // ── Ownership check + vérification du statut ───────────────────────────────
  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: { userId: true, status: true },
  })

  if (!post || post.userId !== session.user.id) {
    return NextResponse.json({ error: 'Post introuvable' }, { status: 404 })
  }

  // Seuls les DRAFT et SCHEDULED peuvent être replanifiés
  if (post.status === 'PUBLISHED' || post.status === 'FAILED') {
    return NextResponse.json(
      { error: 'Ce post ne peut pas être replanifié (déjà publié ou en échec)' },
      { status: 409 },
    )
  }

  // ── Calcul du nouveau statut ───────────────────────────────────────────────
  // - scheduledFor fourni → SCHEDULED
  // - scheduledFor null   → DRAFT (retrait de la date)
  const newScheduledFor = scheduledForRaw ? new Date(scheduledForRaw) : null
  const newStatus = newScheduledFor ? 'SCHEDULED' : 'DRAFT'

  // ── Mise à jour en DB ──────────────────────────────────────────────────────
  let updatedPost
  try {
    updatedPost = await prisma.post.update({
      where: { id: postId },
      data: {
        scheduledFor: newScheduledFor,
        status: newStatus,
      },
    })
  } catch (error) {
    console.error('[PATCH /api/posts/[id]] Erreur DB :', error)
    return NextResponse.json({ error: 'Erreur lors de la mise à jour' }, { status: 500 })
  }

  // ── Gestion Inngest (cancel + reschedule) ──────────────────────────────────
  // Ne tenter les appels Inngest qu'en production (clé présente)
  if (process.env.INNGEST_EVENT_KEY) {
    try {
      // 1. Annuler l'ancien run si le post était SCHEDULED
      if (post.status === 'SCHEDULED') {
        await inngest.send({ name: 'post/cancel', data: { postId } })
      }

      // 2. Déclencher un nouveau run si une date future est fournie
      if (newScheduledFor) {
        await inngest.send({
          name: 'post/schedule',
          data: { postId, scheduledFor: newScheduledFor.toISOString() },
        })
      }
    } catch (inngestError) {
      // Inngest non critique : la DB est déjà à jour, on loggue sans faire échouer la réponse
      console.error('[PATCH /api/posts/[id]] Erreur Inngest (non bloquante) :', inngestError)
    }
  } else {
    console.warn('[PATCH /api/posts/[id]] INNGEST_EVENT_KEY absent — events Inngest ignorés (mode local).')
  }

  revalidatePath('/compose')

  // Retourner le post complet pour la mise à jour optimiste côté client
  return NextResponse.json(updatedPost)
}
