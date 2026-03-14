/**
 * @file app/api/biolink/upload-url/route.ts
 * @description Route Handler POST : genere une URL signee pour l'upload direct
 *   vers Supabase Storage depuis le navigateur (images biolink : banniere, fond, favicon).
 *
 *   Meme bucket `post-media` que les posts et la galerie, avec un chemin distinct :
 *   - Posts :   `{userId}/{timestamp}-{filename}`
 *   - Galerie : `{userId}/gallery/{timestamp}-{filename}`
 *   - Biolink : `{userId}/biolink/{timestamp}-{filename}`
 *
 *   POST /api/biolink/upload-url
 *   -> Body : { filename: string, mimeType: string, size: number }
 *   -> Response : { signedUrl: string, publicUrl: string, path: string, mimeType: string }
 *
 * @example
 *   const res = await fetch('/api/biolink/upload-url', {
 *     method: 'POST',
 *     headers: { 'Content-Type': 'application/json' },
 *     body: JSON.stringify({ filename: 'banner.jpg', mimeType: 'image/jpeg', size: 204800 }),
 *   })
 *   const { signedUrl, publicUrl } = await res.json()
 *   // Ensuite : PUT signedUrl avec le fichier binaire
 */

import { headers } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

import { auth } from '@/lib/auth'
// createServiceClient bypasse la RLS Supabase — l'auth est geree par better-auth
// et deja verifiee dans ce handler (session obligatoire).
import { createServiceClient } from '@/lib/supabase/server'
import { MediaUploadRequestSchema } from '@/modules/posts/schemas/post.schema'

/** Bucket Supabase Storage pour les medias (partage avec les posts et la galerie) */
const MEDIA_BUCKET = 'post-media'

/**
 * POST /api/biolink/upload-url
 * Genere un presigned URL Supabase Storage pour l'upload direct d'un fichier
 * biolink (banniere, image de fond, favicon).
 *
 * Chemin biolink : `{userId}/biolink/{timestamp}-{filename}`
 *
 * @param request - Requete Next.js avec body JSON { filename, mimeType, size }
 * @returns 200 avec { signedUrl, publicUrl, path, mimeType }
 * @returns 400 si les donnees sont invalides
 * @returns 401 si non authentifie
 * @returns 500 si la generation du presigned URL echoue
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  // --- Authentification -------------------------------------------------------
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return NextResponse.json({ error: 'Non authentifie' }, { status: 401 })
  }

  // --- Validation du corps de la requete --------------------------------------
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Corps JSON invalide' }, { status: 400 })
  }

  // Reutilisation du schema de validation des posts (meme structure de requete)
  const parsed = MediaUploadRequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Donnees invalides', details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const { filename, mimeType } = parsed.data

  // --- Construction du chemin dans le bucket ----------------------------------
  // Format biolink : userId/biolink/timestamp-filename
  const sanitizedFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_')
  const path = `${session.user.id}/biolink/${Date.now()}-${sanitizedFilename}`

  // --- Generation du presigned URL Supabase Storage ---------------------------
  // Service client (bypass RLS) : l'auth est deja verifiee par better-auth ci-dessus.
  const supabase = createServiceClient()

  const { data, error } = await supabase.storage
    .from(MEDIA_BUCKET)
    .createSignedUploadUrl(path)

  if (error || !data) {
    console.error('[biolink/upload-url] Erreur Supabase Storage :', error?.message)
    return NextResponse.json(
      { error: "Impossible de generer le lien d'upload" },
      { status: 500 },
    )
  }

  // --- Construction de l'URL publique permanente ------------------------------
  // Disponible immediatement apres l'upload, sans appel supplementaire a Supabase.
  const { data: publicUrlData } = supabase.storage
    .from(MEDIA_BUCKET)
    .getPublicUrl(path)

  return NextResponse.json({
    /** URL signee pour l'upload direct (methode PUT) */
    signedUrl: data.signedUrl,
    /** URL publique permanente du fichier apres upload */
    publicUrl: publicUrlData.publicUrl,
    /** Chemin du fichier dans le bucket */
    path,
    /** Type MIME pour l'en-tete Content-Type lors de l'upload */
    mimeType,
  } satisfies { signedUrl: string; publicUrl: string; path: string; mimeType: string })
}
