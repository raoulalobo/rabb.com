/**
 * @file app/api/user/avatar/route.ts
 * @description API Route — génère une URL signée pour l'upload direct d'un avatar
 *   vers Supabase Storage depuis le navigateur.
 *
 *   Flux d'upload avatar (client-side) :
 *   1. Client sélectionne un fichier image
 *   2. POST /api/user/avatar { filename, contentType } → { signedUrl, publicUrl }
 *   3. Client PUT signedUrl avec le fichier (upload direct Supabase)
 *   4. Client appelle Server Action updateAvatarUrl(publicUrl) pour persister l'URL
 *
 *   Sécurité :
 *   - Session better-auth vérifiée avant de générer l'URL signée
 *   - Chemin de fichier : {userId}/{timestamp}.{ext} → isolé par utilisateur
 *   - Bucket : "avatars" (public, lecture seule pour tous, écriture via service role)
 *   - Type MIME validé côté client + chemin contient l'extension
 *
 * @example
 *   const res = await fetch('/api/user/avatar', {
 *     method: 'POST',
 *     headers: { 'Content-Type': 'application/json' },
 *     body: JSON.stringify({ filename: 'photo.jpg', contentType: 'image/jpeg' }),
 *   })
 *   const { signedUrl, publicUrl } = await res.json()
 */

import { headers } from 'next/headers'

import { auth } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'

// ─── Types ────────────────────────────────────────────────────────────────────

interface AvatarUploadRequest {
  /** Nom original du fichier (utilisé pour extraire l'extension) */
  filename: string
  /** Type MIME du fichier (ex: "image/jpeg") */
  contentType: string
}

interface AvatarUploadResponse {
  /** URL signée pour l'upload (PUT direct vers Supabase, valide 60s) */
  signedUrl: string
  /** URL publique permanente — à sauvegarder dans avatarUrl après upload */
  publicUrl: string
}

// ─── Constantes ───────────────────────────────────────────────────────────────

/** Bucket Supabase Storage dédié aux avatars utilisateur */
const AVATARS_BUCKET = 'avatars'

/** Types MIME autorisés pour les avatars */
const ALLOWED_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

// ─── Handler POST ─────────────────────────────────────────────────────────────

/**
 * Génère un presigned URL pour l'upload d'un avatar vers Supabase Storage.
 *
 * @returns 200 { signedUrl, publicUrl } | 400 | 401 | 500
 */
export async function POST(request: Request): Promise<Response> {
  // ── Vérification de la session ─────────────────────────────────────────────
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) {
    return Response.json({ error: 'Non authentifié' }, { status: 401 })
  }

  // ── Lecture et validation du body ──────────────────────────────────────────
  let body: AvatarUploadRequest
  try {
    body = (await request.json()) as AvatarUploadRequest
  } catch {
    return Response.json({ error: 'Body JSON invalide' }, { status: 400 })
  }

  const { filename, contentType } = body

  if (!filename || !contentType) {
    return Response.json({ error: 'filename et contentType sont requis' }, { status: 400 })
  }

  if (!ALLOWED_CONTENT_TYPES.includes(contentType)) {
    return Response.json(
      { error: `Type de fichier non autorisé. Types acceptés : ${ALLOWED_CONTENT_TYPES.join(', ')}` },
      { status: 400 },
    )
  }

  // ── Construction du chemin de fichier ─────────────────────────────────────
  // Format : {userId}/{timestamp}.{ext}
  // Isoler par userId pour éviter toute collision inter-utilisateurs.
  const ext = filename.split('.').pop() ?? 'jpg'
  const path = `${session.user.id}/${Date.now()}.${ext}`

  const supabase = createServiceClient()

  // ── Création du bucket si inexistant ──────────────────────────────────────
  // En développement, le bucket peut ne pas exister encore.
  // `createBucket` avec `upsert: false` est idempotent via la vérification préalable.
  const { data: buckets } = await supabase.storage.listBuckets()
  const bucketExists = buckets?.some((b) => b.name === AVATARS_BUCKET)

  if (!bucketExists) {
    const { error: createError } = await supabase.storage.createBucket(AVATARS_BUCKET, {
      public: true,                  // Les avatars sont publiquement accessibles en lecture
      fileSizeLimit: 5 * 1024 * 1024, // Max 5 Mo par fichier
      allowedMimeTypes: ALLOWED_CONTENT_TYPES,
    })
    if (createError) {
      console.error('[POST /api/user/avatar] Impossible de créer le bucket :', createError)
      return Response.json({ error: 'Erreur de configuration du stockage' }, { status: 500 })
    }
  }

  // ── Génération de l'URL signée (service role = bypass RLS Storage) ─────────
  const { data, error } = await supabase.storage
    .from(AVATARS_BUCKET)
    .createSignedUploadUrl(path)

  if (error || !data) {
    console.error('[POST /api/user/avatar] Erreur Supabase :', error)
    return Response.json({ error: 'Impossible de générer l\'URL de téléchargement' }, { status: 500 })
  }

  // ── URL publique permanente ────────────────────────────────────────────────
  const { data: { publicUrl } } = supabase.storage
    .from(AVATARS_BUCKET)
    .getPublicUrl(path)

  const response: AvatarUploadResponse = {
    signedUrl: data.signedUrl,
    publicUrl,
  }

  return Response.json(response)
}
