/**
 * @file app/api/posts/upload-url/route.ts
 * @description Route Handler POST : génère une URL signée pour l'upload direct
 *   vers Supabase Storage depuis le navigateur.
 *
 *   Workflow :
 *   1. Le client valide le fichier (type, taille) et envoie { filename, mimeType, size }
 *   2. Ce handler vérifie la session, valide avec Zod, génère un presigned URL
 *   3. Le client uploade directement vers Supabase Storage (sans passer par le serveur)
 *   4. Après l'upload, le client appelle addMediaUrl() dans draftStore avec l'URL publique
 *
 *   POST /api/posts/upload-url
 *   → Body : { filename: string, mimeType: string, size: number }
 *   → Response : { signedUrl: string, publicUrl: string, path: string }
 *
 * @example
 *   const res = await fetch('/api/posts/upload-url', {
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
import { rateLimiters, rateLimitResponse } from '@/lib/rate-limit'
// createServiceClient bypasse la RLS Supabase — l'auth est gérée par better-auth
// et déjà vérifiée dans ce handler (session obligatoire).
import { createServiceClient } from '@/lib/supabase/server'
import { MediaUploadRequestSchema } from '@/modules/posts/schemas/post.schema'

/** Bucket Supabase Storage pour les médias des posts */
const MEDIA_BUCKET = 'post-media'

/**
 * POST /api/posts/upload-url
 * Génère un presigned URL Supabase Storage pour l'upload direct d'un fichier.
 *
 * @param request - Requête Next.js avec body JSON { filename, mimeType, size }
 * @returns 200 avec { signedUrl, publicUrl, path }
 * @returns 400 si les données sont invalides
 * @returns 401 si non authentifié
 * @returns 500 si la génération du presigned URL échoue
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const t0 = Date.now()

  // ─── Authentification ─────────────────────────────────────────────────────────
  const session = await auth.api.getSession({ headers: await headers() })
  console.log('[upload-url] getSession:', Date.now() - t0, 'ms')
  if (!session) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  // ─── Rate limiting ────────────────────────────────────────────────────────────
  // Limite à 20 req/min par userId — anti-abus Supabase Storage
  const rl = await rateLimiters.upload(session.user.id)
  if (!rl.success) return rateLimitResponse(rl.reset)

  // ─── Validation du corps de la requête ────────────────────────────────────────
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Corps JSON invalide' }, { status: 400 })
  }

  const parsed = MediaUploadRequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Données invalides', details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const { filename, mimeType } = parsed.data

  // ─── Construction du chemin dans le bucket ────────────────────────────────────
  // Format : userId/timestamp-filename pour éviter les collisions
  // ex: "usr_abc123/1710000000000-photo.jpg"
  const sanitizedFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_')
  const path = `${session.user.id}/${Date.now()}-${sanitizedFilename}`

  // ─── Génération du presigned URL Supabase Storage ─────────────────────────────
  // Service client (bypass RLS) : l'auth est déjà vérifiée par better-auth ci-dessus.
  // La clé anon + Supabase Auth ne fonctionnerait pas car la session est gérée par
  // better-auth (pas Supabase Auth) → auth.uid() = null → violation RLS.
  const supabase = createServiceClient()

  const t1 = Date.now()
  const { data, error } = await supabase.storage
    .from(MEDIA_BUCKET)
    .createSignedUploadUrl(path)
  console.log('[upload-url] createSignedUploadUrl:', Date.now() - t1, 'ms — erreur:', error?.message ?? 'aucune')

  if (error || !data) {
    console.error('[upload-url] Erreur Supabase Storage complète :', JSON.stringify(error))
    return NextResponse.json(
      { error: 'Impossible de générer le lien d\'upload' },
      { status: 500 },
    )
  }

  // ─── Construction de l'URL publique permanente ────────────────────────────────
  // L'URL publique est construite manuellement car elle est disponible immédiatement
  // après l'upload, sans appel supplémentaire à Supabase.
  const { data: publicUrlData } = supabase.storage
    .from(MEDIA_BUCKET)
    .getPublicUrl(path)

  return NextResponse.json({
    /** URL signée pour l'upload direct (méthode PUT, valide SIGNED_URL_EXPIRES_IN secondes) */
    signedUrl: data.signedUrl,
    /** URL publique permanente du fichier après upload */
    publicUrl: publicUrlData.publicUrl,
    /** Chemin du fichier dans le bucket */
    path,
    /** Type MIME pour l'en-tête Content-Type lors de l'upload */
    mimeType,
  } satisfies { signedUrl: string; publicUrl: string; path: string; mimeType: string })
}
