/**
 * @file modules/biolink/components/BioPageEditor/ImageDropZone.tsx
 * @module biolink
 * @description Zone de drag & drop compacte pour l'upload d'images biolink.
 *   Remplace les inputs URL textuels pour les champs banniere, fond et favicon.
 *
 *   3 etats visuels :
 *   - **Vide** : zone en pointilles avec icone upload + bouton "Importer"
 *   - **Upload en cours** : barre de progression + texte "Upload en cours..."
 *   - **Avec image** : apercu de l'image + boutons "Changer" et "Supprimer" (X)
 *
 *   Utilise le hook `useBioImageUpload` pour le workflow presigned URL + XHR.
 *   Accepte un seul fichier a la fois (pas de multi-upload).
 *
 * @example
 *   <ImageDropZone
 *     value={bannerUrl}
 *     onChange={setBannerUrl}
 *     aspectRatio="16/5"
 *     placeholder="Glissez votre banniere ici"
 *     recommended="1600x500 px (ratio 16:5)"
 *   />
 */

'use client'

import { Upload, X, ImageIcon } from 'lucide-react'
import { useCallback, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useBioImageUpload } from '@/modules/biolink/hooks/useBioImageUpload'

// --- Props --------------------------------------------------------------------

interface ImageDropZoneProps {
  /** URL actuelle de l'image (null si aucune) */
  value: string | null
  /** Callback appele apres un upload reussi (publicUrl) ou une suppression (null) */
  onChange: (url: string | null) => void
  /** Types MIME acceptes (defaut : "image/*") */
  accept?: string
  /** Ratio d'aspect CSS pour l'apercu (ex: "16/5", "1/1") */
  aspectRatio?: string
  /** Texte affiche dans la zone vide */
  placeholder?: string
  /** Taille max du fichier en Mo (defaut : 5) */
  maxSizeMB?: number
  /** Texte d'aide sous la zone (ex: "1600x500 px") */
  recommended?: string
}

// --- Composant ----------------------------------------------------------------

/**
 * Zone de drag & drop compacte avec apercu d'image, barre de progression
 * et boutons d'action (importer, changer, supprimer).
 *
 * @param value        - URL de l'image actuelle
 * @param onChange     - Setter de l'URL
 * @param accept       - Types MIME acceptes
 * @param aspectRatio  - Ratio CSS pour l'apercu
 * @param placeholder  - Texte zone vide
 * @param maxSizeMB    - Taille max en Mo
 * @param recommended  - Texte d'aide
 * @returns Zone interactive d'upload avec 3 etats (vide / upload / apercu)
 */
export function ImageDropZone({
  value,
  onChange,
  accept = 'image/*',
  aspectRatio,
  placeholder = 'Glissez une image ici',
  maxSizeMB = 5,
  recommended,
}: ImageDropZoneProps): React.JSX.Element {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { uploadFile, uploading, progress, error } = useBioImageUpload()

  /**
   * Compteur d'entrees DnD.
   * Incremente sur dragEnter, decremente sur dragLeave.
   * Evite les faux dragLeave causes par les elements enfants de la zone de drop.
   */
  const dragCounterRef = useRef(0)

  /** true quand un fichier est au-dessus de la zone (feedback visuel) */
  const [isDragging, setIsDragging] = useState(false)

  // --- Validation et upload ---------------------------------------------------

  /**
   * Verifie le type MIME et la taille du fichier, puis lance l'upload.
   * Appelle onChange(publicUrl) en cas de succes.
   *
   * @param file - Fichier a valider et uploader
   */
  const handleFile = useCallback(
    async (file: File): Promise<void> => {
      // Validation du type MIME : verifie que le fichier correspond aux types acceptes
      const acceptedTypes = accept.split(',').map((t) => t.trim())
      const isAccepted = acceptedTypes.some((type) => {
        if (type.endsWith('/*')) {
          // Wildcard : "image/*" accepte tout type commencant par "image/"
          return file.type.startsWith(type.replace('/*', '/'))
        }
        return file.type === type
      })

      if (!isAccepted) {
        return // Fichier non-image rejete silencieusement
      }

      // Validation de la taille max
      const maxBytes = maxSizeMB * 1024 * 1024
      if (file.size > maxBytes) {
        return // Le hook affichera l'erreur via setError si necessaire
      }

      const publicUrl = await uploadFile(file)
      if (publicUrl) {
        onChange(publicUrl)
      }
    },
    [accept, maxSizeMB, uploadFile, onChange],
  )

  // --- Handlers input file ----------------------------------------------------

  /** Gere la selection via l'input file cache */
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>): void => {
      const file = e.target.files?.[0]
      if (file) handleFile(file)
      // Reinitialise l'input pour permettre la re-selection du meme fichier
      if (fileInputRef.current) fileInputRef.current.value = ''
    },
    [handleFile],
  )

  // --- Handlers Drag & Drop ---------------------------------------------------

  const handleDragEnter = useCallback((e: React.DragEvent): void => {
    e.preventDefault()
    dragCounterRef.current += 1
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent): void => {
    e.preventDefault()
    dragCounterRef.current -= 1
    if (dragCounterRef.current === 0) {
      setIsDragging(false)
    }
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent): void => {
    // Necessaire pour autoriser le drop (preventDefault)
    e.preventDefault()
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent): void => {
      e.preventDefault()
      dragCounterRef.current = 0
      setIsDragging(false)

      const file = e.dataTransfer.files[0]
      if (file) handleFile(file)
    },
    [handleFile],
  )

  // --- Input file cache (partage entre zone vide et bouton "Changer") ---------

  const fileInput = (
    <input
      ref={fileInputRef}
      type="file"
      accept={accept}
      disabled={uploading}
      className="hidden"
      onChange={handleInputChange}
    />
  )

  // --- Rendu : upload en cours ------------------------------------------------

  if (uploading) {
    return (
      <div className="space-y-2">
        <div
          className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-primary/40 bg-primary/5 px-4 py-6 text-center"
          style={aspectRatio ? { aspectRatio } : undefined}
        >
          {/* Barre de progression */}
          <div className="w-full max-w-48">
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Upload en cours... {progress}%
          </p>
        </div>
        {recommended && (
          <p className="text-xs text-muted-foreground">{recommended}</p>
        )}
      </div>
    )
  }

  // --- Rendu : image presente (apercu + actions) ------------------------------

  if (value) {
    return (
      <div className="space-y-2">
        <div className="group relative overflow-hidden rounded-lg border border-border">
          {/* eslint-disable-next-line @next/next/no-img-element -- Apercu d'URL uploadee par l'utilisateur */}
          <img
            src={value}
            alt="Apercu"
            className="w-full object-cover"
            style={aspectRatio ? { aspectRatio } : undefined}
            // Gestion d'erreur : cache l'image si l'URL est invalide
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none'
            }}
          />

          {/* Overlay avec boutons d'action (visible au hover) */}
          <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
            {fileInput}
            {/* Bouton "Changer" : ouvre le selecteur de fichier */}
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              className="gap-1.5"
            >
              <Upload className="size-3.5" />
              Changer
            </Button>
            {/* Bouton "Supprimer" : remet value a null */}
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => onChange(null)}
              className="gap-1.5"
            >
              <X className="size-3.5" />
              Supprimer
            </Button>
          </div>
        </div>
        {recommended && (
          <p className="text-xs text-muted-foreground">{recommended}</p>
        )}
      </div>
    )
  }

  // --- Rendu : zone vide (drag & drop + bouton importer) ----------------------

  return (
    <div className="space-y-2">
      <div
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className={cn(
          'flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-6 text-center transition-colors',
          isDragging
            ? 'border-primary bg-primary/5'
            : 'border-border/60 bg-muted/20 hover:border-border hover:bg-muted/30',
        )}
        style={aspectRatio ? { aspectRatio } : undefined}
      >
        {/* Icone upload */}
        <div className="flex size-9 items-center justify-center rounded-full bg-muted">
          <ImageIcon className="size-4 text-muted-foreground" />
        </div>

        {/* Texte d'invite */}
        <p className="text-sm text-muted-foreground">{placeholder}</p>

        {/* Input file cache */}
        {fileInput}

        {/* Bouton qui declenche l'input file */}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          className="gap-1.5"
        >
          <Upload className="size-3.5" />
          Importer
        </Button>

        {/* Message d'erreur */}
        {error && (
          <p className="text-xs text-destructive">{error}</p>
        )}
      </div>
      {recommended && (
        <p className="text-xs text-muted-foreground">{recommended}</p>
      )}
    </div>
  )
}
