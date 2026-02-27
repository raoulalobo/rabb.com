/**
 * @file modules/media/components/MediaUploader.tsx
 * @module media
 * @description Zone drag-and-drop réutilisable pour sélectionner des fichiers image/vidéo.
 *
 *   Fonctionnalités :
 *   - Bouton "Importer" qui ouvre un input file caché
 *   - Zone de glisser-déposer avec feedback visuel (anti-faux-dragLeave via compteur)
 *   - Filtre automatique : seuls les fichiers image/* et video/* sont acceptés
 *   - Callback `onFilesSelected` déclenché avec la liste des fichiers valides
 *
 *   Utilisé dans :
 *   - `MediaGrid` (galerie principale)
 *   - `MediaPicker` (dialog de sélection depuis AgentModal)
 *
 * @example
 *   <MediaUploader
 *     onFilesSelected={(files) => {
 *       for (const file of files) uploadFile(file)
 *     }}
 *     disabled={isUploading}
 *   />
 */

'use client'

import { Upload } from 'lucide-react'
import { useCallback, useRef } from 'react'

import { Button } from '@/components/ui/button'

// ─── Props ────────────────────────────────────────────────────────────────────

interface MediaUploaderProps {
  /**
   * Callback déclenché avec les fichiers sélectionnés (filtrés : image/* + video/* seulement).
   * Peut être appelé depuis l'input file ou le drop.
   */
  onFilesSelected: (files: File[]) => void
  /** Si true, désactive l'input et la zone de drop (ex: pendant un upload en cours) */
  disabled?: boolean
  /**
   * Texte affiché dans la zone de drop quand elle est vide.
   * Défaut : "Glissez des images ou vidéos ici"
   */
  placeholder?: string
}

// ─── Composant ────────────────────────────────────────────────────────────────

/**
 * Zone drag-and-drop pour la sélection de fichiers image/vidéo.
 * Filtre automatiquement les fichiers non-image/vidéo.
 */
export function MediaUploader({
  onFilesSelected,
  disabled = false,
  placeholder = 'Glissez des images ou vidéos ici',
}: MediaUploaderProps): React.JSX.Element {
  const fileInputRef = useRef<HTMLInputElement>(null)

  /**
   * Compteur d'entrées DnD.
   * Incrémenté sur dragEnter, décrémenté sur dragLeave.
   * Évite les faux dragLeave causés par les éléments enfants de la zone de drop.
   */
  const dragCounterRef = useRef(0)

  // ─── Helpers de filtrage ─────────────────────────────────────────────────

  /**
   * Filtre les fichiers pour ne garder que les images et vidéos.
   *
   * @param files - Liste de fichiers bruts (depuis l'input ou le drop)
   * @returns Sous-liste filtrée
   */
  const filterFiles = (files: File[]): File[] =>
    files.filter((f) => f.type.startsWith('image/') || f.type.startsWith('video/'))

  // ─── Handlers input ──────────────────────────────────────────────────────

  /** Gère la sélection via l'input file caché */
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>): void => {
      const valid = filterFiles(Array.from(e.target.files ?? []))
      if (valid.length > 0) onFilesSelected(valid)
      // Réinitialise l'input pour permettre la re-sélection du même fichier
      if (fileInputRef.current) fileInputRef.current.value = ''
    },
    [onFilesSelected],
  )

  // ─── Handlers Drag & Drop ────────────────────────────────────────────────

  const handleDragEnter = useCallback((e: React.DragEvent): void => {
    e.preventDefault()
    dragCounterRef.current += 1
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent): void => {
    e.preventDefault()
    dragCounterRef.current -= 1
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent): void => {
    // Nécessaire pour autoriser le drop (preventDefault)
    e.preventDefault()
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent): void => {
      e.preventDefault()
      dragCounterRef.current = 0

      const valid = filterFiles(Array.from(e.dataTransfer.files))
      if (valid.length > 0) onFilesSelected(valid)
    },
    [onFilesSelected],
  )

  // ─── Rendu ───────────────────────────────────────────────────────────────

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className="flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-border/60 bg-muted/20 px-4 py-8 text-center transition-colors hover:border-border hover:bg-muted/30"
    >
      {/* Icône upload */}
      <div className="flex size-10 items-center justify-center rounded-full bg-muted">
        <Upload className="size-4 text-muted-foreground" />
      </div>

      {/* Texte d'invite */}
      <div className="space-y-1">
        <p className="text-sm text-muted-foreground">{placeholder}</p>
        <p className="text-xs text-muted-foreground/60">
          ou importez depuis votre appareil
        </p>
      </div>

      {/* Input file caché */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        multiple
        disabled={disabled}
        className="hidden"
        onChange={handleInputChange}
      />

      {/* Bouton qui déclenche l'input file */}
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled}
        onClick={() => fileInputRef.current?.click()}
        className="gap-1.5"
      >
        <Upload className="size-3.5" />
        Choisir des fichiers
      </Button>
    </div>
  )
}
