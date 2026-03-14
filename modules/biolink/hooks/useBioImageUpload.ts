/**
 * @file modules/biolink/hooks/useBioImageUpload.ts
 * @module biolink
 * @description Hook d'upload d'images pour le module biolink (banniere, fond, favicon).
 *   Encapsule le workflow complet :
 *   1. Demande un presigned URL a `/api/biolink/upload-url`
 *   2. Upload le fichier via XHR PUT (avec tracking de progression)
 *   3. Retourne l'URL publique Supabase du fichier uploade
 *
 *   Expose l'etat d'upload (uploading, progress, error) pour le feedback UI.
 *
 * @example
 *   const { uploadFile, uploading, progress, error } = useBioImageUpload()
 *
 *   async function handleFileDrop(file: File) {
 *     const publicUrl = await uploadFile(file)
 *     if (publicUrl) setBannerUrl(publicUrl)
 *   }
 */

'use client'

import { useCallback, useState } from 'react'

// --- Types de retour du hook --------------------------------------------------

interface UseBioImageUploadReturn {
  /**
   * Upload un fichier vers Supabase Storage via presigned URL.
   * @param file - Fichier a uploader (image)
   * @returns URL publique du fichier uploade, ou null en cas d'erreur
   */
  uploadFile: (file: File) => Promise<string | null>
  /** true pendant l'upload (entre le debut du fetch presigned URL et la fin du PUT) */
  uploading: boolean
  /** Progression de l'upload en pourcentage (0-100) */
  progress: number
  /** Message d'erreur si l'upload echoue, null sinon */
  error: string | null
}

// --- Reponse de l'API route ---------------------------------------------------

/** Structure de la reponse JSON de POST /api/biolink/upload-url */
interface UploadUrlResponse {
  signedUrl: string
  publicUrl: string
  path: string
  mimeType: string
}

// --- Hook ---------------------------------------------------------------------

/**
 * Hook d'upload d'images biolink avec progression et gestion d'erreur.
 * Utilise l'API route `/api/biolink/upload-url` pour obtenir un presigned URL
 * puis effectue un PUT XHR direct vers Supabase Storage.
 *
 * @returns Objet avec uploadFile, uploading, progress, error
 *
 * @example
 *   const { uploadFile, uploading, progress } = useBioImageUpload()
 *   // Dans un handler drag & drop :
 *   const url = await uploadFile(droppedFile)
 */
export function useBioImageUpload(): UseBioImageUploadReturn {
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const uploadFile = useCallback(async (file: File): Promise<string | null> => {
    setUploading(true)
    setProgress(0)
    setError(null)

    try {
      // --- Etape 1 : obtenir le presigned URL depuis l'API route ---------------
      const res = await fetch('/api/biolink/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: file.name,
          mimeType: file.type,
          size: file.size,
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Erreur inconnue' }))
        throw new Error(data.error ?? `Erreur ${res.status}`)
      }

      const { signedUrl, publicUrl, mimeType } = (await res.json()) as UploadUrlResponse

      // --- Etape 2 : upload du fichier via XHR PUT avec tracking progression ---
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest()

        // Tracking de la progression de l'upload
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const pct = Math.round((event.loaded / event.total) * 100)
            setProgress(pct)
          }
        }

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve()
          } else {
            reject(new Error(`Upload echoue (status ${xhr.status})`))
          }
        }

        xhr.onerror = () => reject(new Error('Erreur reseau pendant l\'upload'))

        xhr.open('PUT', signedUrl)
        xhr.setRequestHeader('Content-Type', mimeType)
        xhr.send(file)
      })

      // --- Etape 3 : succes — retourne l'URL publique -------------------------
      setProgress(100)
      return publicUrl
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur inconnue'
      setError(message)
      return null
    } finally {
      setUploading(false)
    }
  }, [])

  return { uploadFile, uploading, progress, error }
}
