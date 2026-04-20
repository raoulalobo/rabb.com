/**
 * @file app/api/biolink/upload-url/route.ts
 * @description Route Handler POST — génère une URL signée pour l'upload direct
 *   d'un avatar Bio Link vers Supabase Storage depuis le navigateur.
 *
 *   Cloné depuis `app/api/user/avatar/route.ts` avec 3 différences :
 *   - Chemin : `{userId}/biolink/{timestamp}-avatar.{ext}` (distinct de l'avatar user)
 *   - Bucket : `post-media` (partagé avec les posts/galerie — pas de bucket dédié pour simplifier)
 *   - Whitelist MIME : toutes les images (image/*), pas juste jpeg/png/webp/gif
 *
 *   POST /api/biolink/upload-url
 *   → Body : { filename: string, contentType: string }
 *   → Response : { signedUrl: string, publicUrl: string, path: string }
 *
 *   Sécurité :
 *   - Session better-auth vérifiée avant génération
 *   - Chemin isolé par userId (pas de collision inter-users)
 *   - Service client Supabase (bypass RLS — auth déjà vérifiée ici)
 *
 * @example
 *   const res = await fetch('/api/biolink/upload-url', {
 *     method: 'POST',
 *     headers: { 'Content-Type': 'application/json' },
 *     body: JSON.stringify({ filename: 'avatar.jpg', contentType: 'image/jpeg' }),
 *   })
 *   const { signedUrl, publicUrl } = await res.json()
 *   // Puis PUT signedUrl avec le fichier binaire
 */

import { headers } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

import { auth } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Corps attendu du POST — validation manuelle (pas de Zod ici pour rester
 * cohérent avec `app/api/user/avatar/route.ts` dont on clone la structure).
 */
interface BioLinkUploadRequest {
  /** Nom original du fichier (utilisé pour extraire l'extension) */
  filename: string
  /** Type MIME du fichier (ex: "image/jpeg", "image/webp") */
  contentType: string
}

interface BioLinkUploadResponse {
  /** URL signée pour l'upload PUT direct vers Supabase Storage (expire vite) */
  signedUrl: string
  /** URL publique permanente à persister dans BioPage.avatarUrl */
  publicUrl: string
  /** Chemin relatif dans le bucket (ex: "u123/biolink/1710000000-avatar.jpg") */
  path: string
}

// ─── Constantes ───────────────────────────────────────────────────────────────

/** Bucket Supabase Storage réutilisé (partagé posts/galerie/biolink) */
const MEDIA_BUCKET = 'post-media'

/**
 * Whitelist MIME : toutes les images. On accepte un set plus large que pour
 * l'avatar utilisateur pour permettre webp/avif côté biolink.
 */
const ALLOWED_CONTENT_TYPE_REGEX = /^image\//

// ─── Handler POST ─────────────────────────────────────────────────────────────

/**
 * Génère un presigned URL pour l'upload d'un avatar Bio Link vers Supabase Storage.
 *
 * @returns 200 `{ signedUrl, publicUrl, path }` | 400 | 401 | 500
 *
 * @example
 *   POST /api/biolink/upload-url
 *   { "filename": "photo.jpg", "contentType": "image/jpeg" }
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  // ── Vérification de la session ────────────────────────────────────────────
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  // ── Lecture et validation du body ─────────────────────────────────────────
  let body: BioLinkUploadRequest
  try {
    body = (await request.json()) as BioLinkUploadRequest
  } catch {
    return NextResponse.json({ error: 'Corps JSON invalide' }, { status: 400 })
  }

  const { filename, contentType } = body

  if (!filename || !contentType) {
    return NextResponse.json(
      { error: 'filename et contentType sont requis' },
      { status: 400 },
    )
  }

  // ── Whitelist MIME : uniquement des images ────────────────────────────────
  if (!ALLOWED_CONTENT_TYPE_REGEX.test(contentType)) {
    return NextResponse.json(
      { error: 'Seules les images sont autorisées comme avatar' },
      { status: 400 },
    )
  }

  // ── Construction du chemin dans le bucket ─────────────────────────────────
  // Format : {userId}/biolink/{timestamp}-avatar.{ext}
  // Préfixe "biolink/" pour isoler de posts/gallery dans le même bucket.
  const ext = filename.includes('.') ? filename.split('.').pop() : 'jpg'
  const path = `${session.user.id}/biolink/${Date.now()}-avatar.${ext}`

  // ── Génération du presigned URL (service role = bypass RLS) ───────────────
  const supabase = createServiceClient()

  const { data, error } = await supabase.storage
    .from(MEDIA_BUCKET)
    .createSignedUploadUrl(path)

  if (error || !data) {
    console.error('[POST /api/biolink/upload-url] Erreur Supabase :', error?.message)
    return NextResponse.json(
      { error: "Impossible de générer l'URL de téléchargement" },
      { status: 500 },
    )
  }

  // ── URL publique permanente (disponible dès la fin de l'upload) ──────────
  const {
    data: { publicUrl },
  } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path)

  const response: BioLinkUploadResponse = {
    signedUrl: data.signedUrl,
    publicUrl,
    path,
  }

  return NextResponse.json(response)
}
