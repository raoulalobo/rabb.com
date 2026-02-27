/**
 * @file app/api/gallery/upload-url/route.ts
 * @description Route Handler POST : génère une URL signée pour l'upload direct
 *   vers Supabase Storage depuis le navigateur (galerie de médias).
 *
 *   Identique à `/api/posts/upload-url` mais avec un chemin différent dans le bucket :
 *   - Posts :   `{userId}/{timestamp}-{filename}`
 *   - Galerie : `{userId}/gallery/{timestamp}-{filename}`
 *
 *   Même bucket `post-media`. L'enregistrement en DB se fait côté client
 *   via saveMedia() après le PUT réussi.
 *
 *   POST /api/gallery/upload-url
 *   → Body : { filename: string, mimeType: string, size: number }
 *   → Response : { signedUrl: string, publicUrl: string, path: string, mimeType: string }
 *
 * @example
 *   const res = await fetch('/api/gallery/upload-url', {
 *     method: 'POST',
 *     headers: { 'Content-Type': 'application/json' },
 *     body: JSON.stringify({ filename: 'photo.jpg', mimeType: 'image/jpeg', size: 1024 }),
 *   })
 *   const { signedUrl, publicUrl } = await res.json()
 *   // Ensuite : PUT signedUrl avec le fichier binaire
 */

import { headers } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

import { auth } from '@/lib/auth'
// createServiceClient bypasse la RLS Supabase — l'auth est gérée par better-auth
// et déjà vérifiée dans ce handler (session obligatoire).
import { createServiceClient } from '@/lib/supabase/server'
import { MediaUploadRequestSchema } from '@/modules/posts/schemas/post.schema'

/** Bucket Supabase Storage pour les médias (partagé avec les posts) */
const MEDIA_BUCKET = 'post-media'

/**
 * POST /api/gallery/upload-url
 * Génère un presigned URL Supabase Storage pour l'upload direct d'un fichier
 * dans la galerie de l'utilisateur.
 *
 * Chemin galerie : `{userId}/gallery/{timestamp}-{filename}`
 * (distinct du chemin posts : `{userId}/{timestamp}-{filename}`)
 *
 * @param request - Requête Next.js avec body JSON { filename, mimeType, size }
 * @returns 200 avec { signedUrl, publicUrl, path, mimeType }
 * @returns 400 si les données sont invalides
 * @returns 401 si non authentifié
 * @returns 500 si la génération du presigned URL échoue
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  // ─── Authentification ──────────────────────────────────────────────────────
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  // ─── Validation du corps de la requête ─────────────────────────────────────
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Corps JSON invalide' }, { status: 400 })
  }

  // Réutilisation du schéma de validation des posts (même structure de requête)
  const parsed = MediaUploadRequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Données invalides', details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const { filename, mimeType } = parsed.data

  // ─── Construction du chemin dans le bucket ─────────────────────────────────
  // Format galerie : userId/gallery/timestamp-filename (préfixe "gallery/" distinctif)
  const sanitizedFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_')
  const path = `${session.user.id}/gallery/${Date.now()}-${sanitizedFilename}`

  // ─── Génération du presigned URL Supabase Storage ──────────────────────────
  // Service client (bypass RLS) : l'auth est déjà vérifiée par better-auth ci-dessus.
  const supabase = createServiceClient()

  const { data, error } = await supabase.storage
    .from(MEDIA_BUCKET)
    .createSignedUploadUrl(path)

  if (error || !data) {
    console.error('[gallery/upload-url] Erreur Supabase Storage :', error?.message)
    return NextResponse.json(
      { error: "Impossible de générer le lien d'upload" },
      { status: 500 },
    )
  }

  // ─── Construction de l'URL publique permanente ─────────────────────────────
  // Disponible immédiatement après l'upload, sans appel supplémentaire à Supabase.
  const { data: publicUrlData } = supabase.storage
    .from(MEDIA_BUCKET)
    .getPublicUrl(path)

  return NextResponse.json({
    /** URL signée pour l'upload direct (méthode PUT) */
    signedUrl: data.signedUrl,
    /** URL publique permanente du fichier après upload */
    publicUrl: publicUrlData.publicUrl,
    /** Chemin du fichier dans le bucket */
    path,
    /** Type MIME pour l'en-tête Content-Type lors de l'upload */
    mimeType,
  } satisfies { signedUrl: string; publicUrl: string; path: string; mimeType: string })
}
