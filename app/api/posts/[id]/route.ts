/**
 * @file app/api/posts/[id]/route.ts
 * @description Route Handler pour les opérations sur un post individuel.
 *
 *   DELETE /api/posts/[id]
 *   → Supprime le post si l'utilisateur en est le propriétaire et si le statut le permet
 *     (DRAFT ou SCHEDULED uniquement — pas PUBLISHED ni FAILED).
 *
 * @example
 *   // Depuis PostComposeCard.tsx
 *   const res = await fetch(`/api/posts/${post.id}`, { method: 'DELETE' })
 *   if (res.ok) {
 *     // Post supprimé — retirer de la liste locale
 *   }
 */

import { headers } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'

import { auth } from '@/lib/auth'
import { inngest } from '@/lib/inngest/client'
import { prisma } from '@/lib/prisma'

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

    // Annuler le run Inngest en attente si le post était planifié.
    // Sans cet event, le run resterait en état sleeping jusqu'à scheduledFor
    // avant de retourner { skipped: true } ("run zombie").
    // Le `cancelOn` défini dans publish-scheduled-post.ts corrèle les deux
    // events via data.postId → Inngest annule immédiatement le run correspondant.
    if (post.status === 'SCHEDULED') {
      await inngest.send({ name: 'post/cancel', data: { postId } })
    }

    // Invalide les caches des pages affectées
    revalidatePath('/compose')
    revalidatePath('/calendar')

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[DELETE /api/posts/[id]] Erreur suppression :', error)
    return NextResponse.json({ error: 'Erreur lors de la suppression' }, { status: 500 })
  }
}
