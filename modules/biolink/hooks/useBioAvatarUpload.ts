/**
 * @file modules/biolink/hooks/useBioAvatarUpload.ts
 * @module biolink/hooks
 * @description Hook client pour l'upload d'un avatar de BioPage vers Supabase Storage.
 *
 *   Enchaîne 2 étapes :
 *   1. POST /api/biolink/upload-url { filename, contentType }
 *      → récupère { signedUrl, publicUrl, path }
 *   2. PUT signedUrl avec le `File` brut en body (upload direct Supabase)
 *
 *   Le hook retourne uniquement `publicUrl` en cas de succès — c'est à
 *   l'appelant de persister cette URL via `updateBioPage({ avatarUrl })`.
 *
 *   L'état `uploading` peut être utilisé pour désactiver le bouton de sélection
 *   ou afficher un loader pendant le PUT (étape 2 = la plus longue).
 *
 * @example
 *   const { upload, uploading } = useBioAvatarUpload()
 *   const onFile = async (file: File) => {
 *     const res = await upload(file)
 *     if ('error' in res) return toast.error(res.error)
 *     await updateBioPage({ avatarUrl: res.publicUrl })
 *   }
 */

'use client'

import { useState } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

/** Résultat d'un upload réussi — URL publique permanente sur le CDN Supabase */
interface UploadSuccess {
  publicUrl: string
}

/** Résultat d'un upload en erreur — message localisé en français */
interface UploadError {
  error: string
}

/** Union discriminée : succès ou erreur, jamais les deux en même temps */
type UploadResult = UploadSuccess | UploadError

/** Valeur de retour du hook — fonction `upload` + état `uploading` */
interface UseBioAvatarUploadReturn {
  /**
   * Lance le flow presigned URL + PUT. Ne throw jamais — retourne toujours
   * un objet `{ publicUrl }` ou `{ error }` pour faciliter l'appel.
   */
  upload: (file: File) => Promise<UploadResult>
  /** `true` pendant le POST presigned + le PUT — utilisable pour un loader */
  uploading: boolean
}

// ─── Constantes ───────────────────────────────────────────────────────────────

/** Taille maximale autorisée côté client — 5 Mo (pareil que l'avatar user) */
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Hook gérant l'upload d'un avatar de BioPage vers Supabase Storage
 * via le pattern presigned URL de `app/api/biolink/upload-url/route.ts`.
 *
 * @returns `{ upload, uploading }` — fonction asynchrone + état de chargement
 *
 * @example
 *   const { upload, uploading } = useBioAvatarUpload()
 */
export function useBioAvatarUpload(): UseBioAvatarUploadReturn {
  const [uploading, setUploading] = useState<boolean>(false)

  /**
   * Upload un fichier image vers Supabase Storage via presigned URL.
   *
   * @param file - Fichier image sélectionné par l'utilisateur (File object)
   * @returns `{ publicUrl }` en cas de succès, `{ error }` sinon
   */
  const upload = async (file: File): Promise<UploadResult> => {
    // ── Validation client préalable ─────────────────────────────────────────
    if (!file.type.startsWith('image/')) {
      return { error: 'Le fichier doit être une image' }
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return { error: 'Le fichier ne doit pas dépasser 5 Mo' }
    }

    setUploading(true)
    try {
      // ── Étape 1 : demande d'URL signée au serveur ─────────────────────────
      const presignedRes = await fetch('/api/biolink/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type,
        }),
      })

      if (!presignedRes.ok) {
        const body = (await presignedRes.json().catch(() => ({}))) as {
          error?: string
        }
        return { error: body.error ?? "Impossible d'obtenir l'URL d'upload" }
      }

      const { signedUrl, publicUrl } = (await presignedRes.json()) as {
        signedUrl: string
        publicUrl: string
        path: string
      }

      // ── Étape 2 : PUT direct du fichier vers Supabase Storage ─────────────
      // Pas besoin d'Authorization header — le signedUrl contient déjà le token.
      const putRes = await fetch(signedUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      })

      if (!putRes.ok) {
        return { error: "L'upload du fichier a échoué" }
      }

      return { publicUrl }
    } catch (err) {
      console.error('[useBioAvatarUpload] Erreur inattendue :', err)
      return { error: 'Erreur réseau pendant l\'upload' }
    } finally {
      setUploading(false)
    }
  }

  return { upload, uploading }
}
