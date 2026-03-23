/**
 * @file modules/posts/components/PostComposer/CarouselEditor.tsx
 * @module posts
 * @description Zone intégrée d'upload de médias en mode carrousel.
 *   Remplace le MediaUpload classique quand contentType = "carousel".
 *   Affiche un bandeau informatif (compteur, limites par plateforme)
 *   + une grille de vignettes des médias uploadés avec drag-and-drop
 *   + un bouton d'ajout et un bouton galerie.
 *
 *   Fonctionnalités :
 *   - Grille de vignettes 64×64 avec bouton × pour supprimer
 *   - Drag-and-drop avec feedback visuel (bordure + animation)
 *   - Bouton "+ Ajouter" intégré dans la grille
 *   - Bouton "Galerie" pour réutiliser des médias existants
 *   - Barre de progression pour les fichiers en cours d'upload
 *   - Compteur de médias vs limite la plus restrictive
 *   - Infos par plateforme (limites spécifiques)
 *
 *   Visible uniquement quand contentType = "carousel".
 *   Quand actif, MediaUpload.tsx se masque (guard contentType).
 *
 * @example
 *   <PostComposer>
 *     <PostComposer.ContentTypePicker />
 *     <PostComposer.CarouselEditor />
 *     <PostComposer.Editor />
 *     {/* MediaUpload se masque automatiquement en mode carousel *\/}
 *     <PostComposer.MediaUpload />
 *   </PostComposer>
 */

'use client'

import { ImagePlus, Images, Info, Loader2, UploadCloud, X } from 'lucide-react'
import { useRef, useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { MediaPicker } from '@/modules/media/components/MediaPicker'

import { usePostComposerContext } from './context'

// ─── Limites de carrousel par plateforme ──────────────────────────────────────

/** Nombre maximum de médias dans un carrousel par plateforme */
const CAROUSEL_LIMITS: Record<string, number> = {
  instagram: 10,
  tiktok: 35,
  facebook: 10,
  linkedin: 20,
}

/** Labels français des plateformes */
const PLATFORM_LABELS: Record<string, string> = {
  instagram: 'Instagram',
  tiktok: 'TikTok',
  facebook: 'Facebook',
  linkedin: 'LinkedIn',
}

/** Types MIME acceptés pour l'upload */
const ACCEPTED_TYPES = 'image/*,video/*'

/** Taille maximale autorisée (500 Mo en octets) */
const MAX_SIZE_BYTES = 500 * 1024 * 1024

// ─── Composant ────────────────────────────────────────────────────────────────

/**
 * Zone d'upload intégrée pour le mode carrousel.
 * Fusionne le bandeau informatif + la grille de vignettes + le drag-and-drop.
 * Remplace le MediaUpload classique en mode carrousel.
 *
 * @returns Zone carrousel complète ou null si contentType !== "carousel"
 */
export function CarouselEditor(): React.JSX.Element | null {
  const {
    contentType,
    activeMediaUrls,
    uploadingFiles,
    uploadFile,
    removeUploadedFile,
    addActiveMediaUrl,
    platforms,
    activePlatformTab,
    readOnly,
    isSubmitting,
  } = usePostComposerContext()

  const inputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  // Compteur d'entrées drag pour éviter le flickering sur les éléments enfants
  const dragCounterRef = useRef(0)

  // Ne s'affiche que pour les carrousels
  if (contentType !== 'carousel') return null

  // ── Calcul des limites ──────────────────────────────────────────────────────
  const relevantPlatforms = platforms.filter((p) => p in CAROUSEL_LIMITS)
  const maxFiles = relevantPlatforms.length > 0
    ? Math.min(...relevantPlatforms.map((p) => CAROUSEL_LIMITS[p] ?? 10))
    : 10

  const totalFiles = activeMediaUrls.length + uploadingFiles.length
  const isOverLimit = totalFiles > maxFiles
  const canAddMore = totalFiles < maxFiles && !isSubmitting && !readOnly

  // ── Traitement des fichiers (partagé entre clic et drop) ──────────────────

  /**
   * Valide et lance l'upload d'une liste de fichiers.
   * @param files - Fichiers à traiter
   */
  const processFiles = async (files: File[]): Promise<void> => {
    if (!canAddMore) return
    const targetTab = activePlatformTab
    const allowedFiles = files.slice(0, maxFiles - totalFiles)

    for (const file of allowedFiles) {
      if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) continue
      if (file.size > MAX_SIZE_BYTES) continue
      await uploadFile(file, targetTab)
    }
  }

  // ── Handlers clic ─────────────────────────────────────────────────────────

  const handleTriggerClick = (): void => {
    if (!canAddMore) return
    inputRef.current?.click()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    await processFiles(files)
  }

  // ── Handlers drag-and-drop ────────────────────────────────────────────────

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>): void => {
    e.preventDefault()
    if (!e.dataTransfer.types.includes('Files')) return
    dragCounterRef.current++
    if (!isSubmitting && !readOnly) setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>): void => {
    e.preventDefault()
    dragCounterRef.current--
    if (dragCounterRef.current === 0) setIsDragging(false)
  }

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>): void => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>): Promise<void> => {
    e.preventDefault()
    dragCounterRef.current = 0
    setIsDragging(false)
    if (isSubmitting || readOnly) return
    const files = Array.from(e.dataTransfer.files)
    await processFiles(files)
  }

  return (
    <div
      className={[
        'rounded-lg border-2 border-dashed p-3 space-y-3 transition-all duration-150',
        isDragging && canAddMore
          ? 'border-primary bg-primary/5'
          : 'border-border/60',
      ].join(' ')}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* ── En-tête : titre + compteur ─────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Images className="size-4 text-primary" />
          <span className="text-sm font-medium">Mode Carrousel</span>
        </div>
        <Badge variant={isOverLimit ? 'destructive' : 'secondary'} className="text-xs">
          {totalFiles} / {maxFiles} médias
        </Badge>
      </div>

      {/* ── Infos par plateforme ────────────────────────────────────────── */}
      {relevantPlatforms.length > 0 && (
        <div className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
          <Info className="size-3 mt-0.5 shrink-0" />
          <span>
            Limites :{' '}
            {relevantPlatforms.map((p, i) => (
              <span key={p}>
                {PLATFORM_LABELS[p] ?? p} ({CAROUSEL_LIMITS[p]})
                {i < relevantPlatforms.length - 1 ? ', ' : ''}
              </span>
            ))}
          </span>
        </div>
      )}

      {/* ── Grille de vignettes + bouton d'ajout ───────────────────────── */}
      <div className="flex flex-wrap gap-2">
        {/* Médias déjà uploadés */}
        {activeMediaUrls.map((url) => {
          const isVideo = /\.(mp4|mov|webm|avi)$/i.test(url)

          return (
            <div key={url} className="group relative size-16 overflow-hidden rounded-lg border border-border">
              {isVideo ? (
                <video src={url} className="size-full object-cover" muted />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={url} alt="Média carrousel" className="size-full object-cover" />
              )}

              {/* Bouton supprimer au survol */}
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => removeUploadedFile('', url)}
                  disabled={isSubmitting}
                  className={[
                    'absolute inset-0 flex items-center justify-center',
                    'bg-black/50 opacity-0 transition-opacity group-hover:opacity-100',
                    'disabled:cursor-not-allowed',
                  ].join(' ')}
                  aria-label="Supprimer ce média"
                >
                  <X className="size-4 text-white" />
                </button>
              )}
            </div>
          )
        })}

        {/* Fichiers en cours d'upload */}
        {uploadingFiles.map((file) => (
          <div
            key={file.id}
            className={[
              'flex size-16 flex-col items-center justify-center gap-1 rounded-lg border',
              file.error ? 'border-destructive/50 bg-destructive/10' : 'border-border bg-muted/30',
            ].join(' ')}
            title={file.error ?? file.file.name}
          >
            {file.error ? (
              <X className="size-4 text-destructive" />
            ) : (
              <>
                <Loader2 className="size-4 animate-spin text-primary" />
                <span className="text-[10px] tabular-nums text-muted-foreground">{file.progress}%</span>
              </>
            )}
          </div>
        ))}

        {/* Bouton d'ajout intégré dans la grille */}
        {canAddMore && (
          <button
            type="button"
            onClick={handleTriggerClick}
            className={[
              'flex size-16 flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed',
              'text-muted-foreground transition-colors',
              'hover:border-primary hover:text-primary',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            ].join(' ')}
            aria-label={`Ajouter des médias (${totalFiles}/${maxFiles})`}
          >
            {isDragging ? (
              <UploadCloud className="size-5 animate-bounce text-primary" />
            ) : (
              <>
                <ImagePlus className="size-5" />
                <span className="text-[9px]">Ajouter</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* ── Message drag-and-drop ──────────────────────────────────────── */}
      {isDragging && canAddMore && (
        <p className="text-center text-xs text-primary font-medium animate-pulse">
          Déposez vos fichiers ici
        </p>
      )}

      {/* ── Message si aucun média ─────────────────────────────────────── */}
      {totalFiles === 0 && !isDragging && (
        <p className="text-xs text-muted-foreground italic">
          Ajoutez au moins 2 médias pour créer un carrousel.
        </p>
      )}

      {/* ── Bouton Galerie ──────────────────────────────────────────────── */}
      {canAddMore && !isDragging && (
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          disabled={isSubmitting || readOnly}
          className={[
            'flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-primary',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            'disabled:cursor-not-allowed disabled:opacity-50',
          ].join(' ')}
        >
          <Images className="size-3.5" />
          <span>Choisir depuis la galerie</span>
        </button>
      )}

      {/* Input file caché */}
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_TYPES}
        multiple
        className="hidden"
        onChange={handleFileChange}
        aria-hidden="true"
      />

      {/* Dialog galerie */}
      <MediaPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        selectedUrls={activeMediaUrls}
        onConfirm={(urls) => {
          const newUrls = urls
            .filter((url) => !activeMediaUrls.includes(url))
            .slice(0, maxFiles - activeMediaUrls.length)
          for (const url of newUrls) {
            addActiveMediaUrl(url)
          }
        }}
      />
    </div>
  )
}
