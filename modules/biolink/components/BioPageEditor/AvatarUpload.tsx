/**
 * @file modules/biolink/components/BioPageEditor/AvatarUpload.tsx
 * @module biolink
 * @description Zone d'upload d'avatar personnalisé pour la BioPage.
 *   Permet de remplacer l'avatar du compte utilisateur par une image custom.
 *   Affiche l'avatar actuel avec la forme configurée (circle, rounded-square, square),
 *   et propose des boutons pour changer ou supprimer l'avatar personnalisé.
 *   Utilise `ImageDropZone` (même composant que BannerUpload) pour le workflow d'upload.
 *
 * @example
 *   <AvatarUpload
 *     avatarUrl={avatarUrl}
 *     fallbackUrl={userAvatarUrl}
 *     avatarShape="circle"
 *     onChange={(url) => setAvatarUrl(url)}
 *   />
 */

'use client'

import { Upload, X, User } from 'lucide-react'
import { useCallback, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useBioImageUpload } from '@/modules/biolink/hooks/useBioImageUpload'

// --- Props --------------------------------------------------------------------

interface AvatarUploadProps {
  /** URL de l'avatar personnalisé (null si aucun → utilise le fallback) */
  avatarUrl: string | null
  /** URL de l'avatar du compte utilisateur (fallback quand avatarUrl est null) */
  fallbackUrl: string | null
  /** Forme de l'avatar pour l'aperçu : "circle", "rounded-square", "square" */
  avatarShape: string
  /** Callback de changement : url = nouvel avatar personnalisé, null = retour au fallback */
  onChange: (url: string | null) => void
}

// --- Helpers -----------------------------------------------------------------

/**
 * Retourne la classe CSS de border-radius selon la forme d'avatar sélectionnée.
 *
 * @param shape - Forme de l'avatar ("circle", "rounded-square", "square")
 * @returns Classe Tailwind correspondante
 *
 * @example
 *   getShapeClass('circle')          // → 'rounded-full'
 *   getShapeClass('rounded-square')  // → 'rounded-xl'
 *   getShapeClass('square')          // → 'rounded-none'
 */
function getShapeClass(shape: string): string {
  switch (shape) {
    case 'circle':
      return 'rounded-full'
    case 'rounded-square':
      return 'rounded-xl'
    case 'square':
      return 'rounded-none'
    default:
      return 'rounded-full'
  }
}

// --- Composant ----------------------------------------------------------------

/**
 * Section d'upload d'avatar personnalisé avec aperçu, drag & drop et suppression.
 * Affiche l'avatar actuel (personnalisé ou fallback du compte) avec la forme
 * configurée, et des boutons overlay au hover pour changer ou supprimer.
 *
 * @param avatarUrl   - URL de l'avatar personnalisé (null = pas de custom)
 * @param fallbackUrl - URL de l'avatar du compte (affiché quand pas de custom)
 * @param avatarShape - Forme de l'avatar pour le preview
 * @param onChange    - Setter (url string = nouvel avatar, null = suppression du custom)
 * @returns Section avec titre + zone d'aperçu/upload de l'avatar
 */
export function AvatarUpload({
  avatarUrl,
  fallbackUrl,
  avatarShape,
  onChange,
}: AvatarUploadProps): React.JSX.Element {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { uploadFile, uploading, progress } = useBioImageUpload()
  const [isDragging, setIsDragging] = useState(false)
  const dragCounterRef = useRef(0)

  /** URL affichée : avatar personnalisé → fallback du compte → null */
  const displayUrl = avatarUrl ?? fallbackUrl
  /** true si un avatar personnalisé est défini (pas juste le fallback) */
  const hasCustomAvatar = avatarUrl !== null

  // --- Validation et upload ---------------------------------------------------

  /**
   * Valide le fichier (type image, max 2 Mo) puis lance l'upload.
   * Appelle onChange(publicUrl) en cas de succès.
   *
   * @param file - Fichier image sélectionné ou droppé
   */
  const handleFile = useCallback(
    async (file: File): Promise<void> => {
      // Validation type MIME : uniquement les images
      if (!file.type.startsWith('image/')) return

      // Validation taille max : 2 Mo pour un avatar
      const maxBytes = 2 * 1024 * 1024
      if (file.size > maxBytes) return

      const publicUrl = await uploadFile(file)
      if (publicUrl) {
        onChange(publicUrl)
      }
    },
    [uploadFile, onChange],
  )

  // --- Handlers input file ----------------------------------------------------

  /** Gère la sélection de fichier via l'input caché */
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>): void => {
      const file = e.target.files?.[0]
      if (file) handleFile(file)
      // Réinitialise l'input pour permettre la re-sélection du même fichier
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

  // --- Input file caché -------------------------------------------------------

  const fileInput = (
    <input
      ref={fileInputRef}
      type="file"
      accept="image/*"
      disabled={uploading}
      className="hidden"
      onChange={handleInputChange}
    />
  )

  const shapeClass = getShapeClass(avatarShape)

  // --- Rendu : upload en cours ------------------------------------------------

  if (uploading) {
    return (
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-foreground">Avatar</h3>
        <div className="flex items-center gap-4">
          {/* Cercle placeholder avec barre de progression */}
          <div
            className={cn(
              'flex size-20 items-center justify-center border-2 border-dashed border-primary/40 bg-primary/5',
              shapeClass,
            )}
          >
            <div className="text-center">
              <p className="text-xs text-muted-foreground">{progress}%</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">Upload en cours...</p>
        </div>
      </div>
    )
  }

  // --- Rendu : avec avatar (personnalisé ou fallback) -------------------------

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-foreground">Avatar</h3>

      <div className="flex items-center gap-4">
        {/* Aperçu de l'avatar avec overlay au hover */}
        <div
          className="group relative"
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          {displayUrl ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element -- Aperçu d'URL uploadée par l'utilisateur */}
              <img
                src={displayUrl}
                alt="Avatar"
                className={cn(
                  'size-20 object-cover border border-border',
                  shapeClass,
                  isDragging && 'ring-2 ring-primary ring-offset-2',
                )}
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none'
                }}
              />
              {/* Overlay hover avec bouton changer */}
              <div
                className={cn(
                  'absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100',
                  shapeClass,
                )}
              >
                {fileInput}
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  className="size-8"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="size-3.5" />
                </Button>
              </div>
            </>
          ) : (
            /* Zone vide : pas d'avatar du tout */
            <div
              className={cn(
                'flex size-20 cursor-pointer items-center justify-center border-2 border-dashed transition-colors',
                isDragging
                  ? 'border-primary bg-primary/5'
                  : 'border-border/60 bg-muted/20 hover:border-border hover:bg-muted/30',
                shapeClass,
              )}
              onClick={() => fileInputRef.current?.click()}
            >
              {fileInput}
              <User className="size-6 text-muted-foreground" />
            </div>
          )}
        </div>

        {/* Actions textuelles à côté de l'avatar */}
        <div className="flex flex-col gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="size-3.5" />
            {hasCustomAvatar ? 'Changer' : 'Importer un avatar'}
          </Button>

          {/* Bouton supprimer : visible uniquement si un avatar personnalisé est défini */}
          {hasCustomAvatar && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="gap-1.5 text-destructive hover:text-destructive"
              onClick={() => onChange(null)}
            >
              <X className="size-3.5" />
              Supprimer
            </Button>
          )}

          <p className="text-xs text-muted-foreground">
            {hasCustomAvatar
              ? 'Avatar personnalisé actif'
              : 'Utilise l\'avatar de votre compte'}
          </p>
        </div>
      </div>
    </div>
  )
}
