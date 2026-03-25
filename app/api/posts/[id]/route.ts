/**
 * @file app/api/posts/[id]/route.ts
 * @description Route Handler pour les opérations sur un post individuel via Zernio.
 *
 *   GET /api/posts/[id]
 *   → Récupère un post par son ID Zernio
 *
 *   DELETE /api/posts/[id]
 *   → Supprime un post chez Zernio
 *
 * @example
 *   const res = await fetch(`/api/posts/${postId}`, { method: 'DELETE' })
 */

import { headers } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'

import { auth } from '@/lib/auth'
import { late } from '@/lib/late'
import { mapZernioPost } from '@/modules/posts/types'
import type { ZernioRawPost } from '@/modules/posts/types'

/**
 * GET /api/posts/[id]
 * Récupère un post par son ID Zernio.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  const { id: postId } = await params

  try {
    const zernioPost = await late.posts.get(postId)
    const post = mapZernioPost(zernioPost as unknown as ZernioRawPost)
    return NextResponse.json(post)
  } catch (error) {
    console.error('[GET /api/posts/[id]] Erreur Zernio :', error)
    return NextResponse.json({ error: 'Post introuvable' }, { status: 404 })
  }
}

/**
 * DELETE /api/posts/[id]
 * Supprime un post chez Zernio.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  const { id: postId } = await params

  try {
    await late.posts.delete(postId)

    revalidatePath('/calendar')
    revalidatePath('/')

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[DELETE /api/posts/[id]] Erreur Zernio :', error)
    const message = error instanceof Error ? error.message : 'Erreur lors de la suppression'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
