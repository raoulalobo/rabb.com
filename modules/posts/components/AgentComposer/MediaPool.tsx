/**
 * @file modules/posts/components/AgentComposer/MediaPool.tsx
 * @module posts
 * @description Zone d'upload de médias du pool de l'AgentComposer.
 *
 *   Contrairement au MediaUpload du PostComposer, ici les médias n'ont PAS de
 *   destination assignée à l'upload : l'agent Claude décidera ensuite quels médias
 *   vont sur quelle plateforme, en respectant les contraintes de chaque réseau.
 *
 *   Workflow :
 *   1. L'utilisateur sélectionne ou dépose des fichiers (images + vidéos)
 *   2. Validation locale (type MIME, taille max 500 Mo)
 *   3. Appel à POST /api/posts/upload-url → presigned URL Supabase
 *   4. Upload direct vers Supabase Storage (PUT)
 *   5. PoolMedia ajouté au pool : { url, type, filename }
 *
 *   Drag & Drop :
 *   - Le composant entier devient la zone de dépôt (pas seulement le bouton)
 *   - Utilise un compteur `dragCounterRef` pour éviter le flickering de `isDragging`
 *     quand le curseur survole les éléments enfants (chaque survol d'un enfant
 *     déclenche un `dragleave` sur le parent suivi d'un `dragenter` : le compteur
 *     neutralise ces fausses sorties)
 *   - `dragover.dropEffect = 'copy'` affiche l'icône + du curseur
 *
 * @example
 *   <MediaPool
 *     mediaPool={mediaPool}
 *     uploadingFiles={uploadingFiles}
 *     onUpload={handleUploadFile}
 *     onRemove={handleRemoveMedia}
 *     disabled={isGenerating}
 *   />
 */

'use client'

import { ImagePlus, Loader2, UploadCloud, X } from 'lucide-react'
import { useRef, useState } from 'react'

import type { PoolMedia, UploadingFile } from '@/modules/posts/types'

// ─── Constantes ───────────────────────────────────────────────────────────────

/** Types MIME acceptés dans le pool (pas de restriction par plateforme ici — c'est l'agent qui gère) */
const ACCEPTED_TYPES = 'image/*,video/*'

/** Taille maximale d'un fichier : 500 Mo */
const MAX_SIZE_BYTES = 500 * 1024 * 1024

/** Nombre maximum de fichiers dans le pool */
const MAX_POOL_SIZE = 50

// ─── Props ────────────────────────────────────────────────────────────────────

interface MediaPoolProps {
  /** Médias déjà uploadés dans le pool */
  mediaPool: PoolMedia[]
  /** Fichiers en cours d'upload (avec progression) */
  uploadingFiles: UploadingFile[]
  /** Callback pour uploader un fichier dans le pool */
  onUpload: (file: File) => Promise<void>
  /** Callback pour retirer un média du pool (par son URL) */
  onRemove: (url: string) => void
  /** Désactiver toutes les interactions (ex: pendant la génération du plan) */
  disabled?: boolean
}

// ─── Composant ────────────────────────────────────────────────────────────────

/**
 * Zone de gestion du pool de médias de l'AgentComposer.
 * Supporte la sélection via clic et le glisser-déposer de fichiers.
 * L'attribution par plateforme est faite par l'agent Claude, pas ici.
 */
export function MediaPool({
  mediaPool,
  uploadingFiles,
  onUpload,
  onRemove,
  disabled = false,
}: MediaPoolProps): React.JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null)

  // État visuel de survol drag & drop
  const [isDragging, setIsDragging] = useState(false)

  // Compteur d'entrées drag pour éviter le flickering sur les éléments enfants.
  // Chaque dragenter incrémente, chaque dragleave décrémente.
  // setIsDragging(false) seulement quand le compteur repasse à 0.
  const dragCounterRef = useRef(0)

  const totalFiles = mediaPool.length + uploadingFiles.length
  const canAddMore = totalFiles < MAX_POOL_SIZE && !disabled

  // ── Traitement des fichiers (partagé entre clic et drop) ──────────────────

  /**
   * Valide et lance l'upload d'une liste de fichiers.
   * Filtre par type MIME (images/vidéos) et taille (max 500 Mo).
   * Respecte la limite du pool.
   *
   * @param files - Fichiers à traiter (sélection ou drop)
   */
  const processFiles = async (files: File[]): Promise<void> => {
    if (!canAddMore) return

    // Limiter au nombre de slots restants dans le pool
    const allowedFiles = files.slice(0, MAX_POOL_SIZE - totalFiles)

    for (const file of allowedFiles) {
      // Ignorer les types non supportés (documents, archives, etc.)
      if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) continue
      // Ignorer les fichiers dépassant la limite (500 Mo)
      if (file.size > MAX_SIZE_BYTES) continue
      await onUpload(file)
    }
  }

  // ── Handlers sélection via clic ───────────────────────────────────────────

  /** Ouvre le sélecteur de fichiers natif. */
  const handleTriggerClick = (): void => {
    if (!canAddMore) return
    inputRef.current?.click()
  }

  /** Traite les fichiers sélectionnés via le sélecteur natif. */
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const files = Array.from(e.target.files ?? [])
    // Réinitialiser l'input pour permettre la re-sélection du même fichier
    e.target.value = ''
    await processFiles(files)
  }

  // ── Handlers Drag & Drop ──────────────────────────────────────────────────

  /**
   * Incrémente le compteur et active l'état de survol.
   * Ignoré si le drag ne contient pas de fichiers (ex: drag de texte sélectionné).
   */
  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>): void => {
    e.preventDefault()
    // Ignorer les drags qui ne sont pas des fichiers
    if (!e.dataTransfer.types.includes('Files')) return
    dragCounterRef.current++
    if (!disabled) setIsDragging(true)
  }

  /**
   * Décrémente le compteur. Désactive le survol seulement quand le curseur
   * quitte réellement la zone entière (compteur = 0).
   */
  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>): void => {
    e.preventDefault()
    dragCounterRef.current--
    if (dragCounterRef.current === 0) setIsDragging(false)
  }

  /**
   * Autorise le dépôt et affiche l'icône "copier" sur le curseur.
   * Doit appeler preventDefault() pour annuler le comportement par défaut du navigateur.
   */
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>): void => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }

  /**
   * Réceptionne les fichiers déposés et les traite.
   * Remet le compteur à 0 proprement avant de traiter.
   */
  const handleDrop = async (e: React.DragEvent<HTMLDivElement>): Promise<void> => {
    e.preventDefault()
    dragCounterRef.current = 0
    setIsDragging(false)
    if (disabled) return
    const files = Array.from(e.dataTransfer.files)
    await processFiles(files)
  }

  return (
    // Toute la zone est droppable — pas seulement le bouton
    <div
      className="space-y-3"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* En-tête de la section */}
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-foreground">
          Médias
        </label>
        {totalFiles > 0 && (
          <span className="text-xs text-muted-foreground">
            {totalFiles} fichier{totalFiles > 1 ? 's' : ''} dans le pool
          </span>
        )}
      </div>

      {/* Zone principale de dépôt — change d'apparence pendant le survol */}
      <div
        className={[
          'rounded-lg border-2 border-dashed transition-all duration-150',
          isDragging && canAddMore
            ? 'border-primary bg-primary/5 shadow-sm'
            : 'border-border/50',
        ].join(' ')}
      >
        {/* Grille des médias uploadés + en cours */}
        {(mediaPool.length > 0 || uploadingFiles.length > 0) && (
          <div className="flex flex-wrap gap-2 p-3">
            {/* Médias déjà uploadés */}
            {mediaPool.map((media) => (
              <PoolMediaPreview
                key={media.url}
                media={media}
                onRemove={() => onRemove(media.url)}
                disabled={disabled}
              />
            ))}

            {/* Fichiers en cours d'upload */}
            {uploadingFiles.map((file) => (
              <UploadProgressPreview
                key={file.id}
                name={file.file.name}
                progress={file.progress}
                error={file.error}
              />
            ))}
          </div>
        )}

        {/* Bouton d'ajout / zone de drop vide */}
        {canAddMore ? (
          <button
            type="button"
            onClick={handleTriggerClick}
            className={[
              'flex w-full items-center justify-center gap-2 py-6 text-sm transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
              // Quand des fichiers sont déjà présents, le bouton est plus compact
              mediaPool.length > 0 || uploadingFiles.length > 0 ? 'py-3' : 'py-6',
              isDragging
                ? 'text-primary'
                : 'text-muted-foreground hover:text-primary',
            ].join(' ')}
            aria-label="Ajouter des médias au pool"
          >
            {/* Icône change selon l'état de survol */}
            {isDragging ? (
              <UploadCloud className="size-5 animate-bounce" />
            ) : (
              <ImagePlus className="size-5" />
            )}
            <span>
              {isDragging
                ? 'Déposez vos fichiers ici'
                : totalFiles === 0
                  ? 'Ajouter des photos ou vidéos'
                  : 'Ajouter d\'autres médias'}
            </span>
          </button>
        ) : (
          // Pool plein ou désactivé
          totalFiles === 0 ? (
            <p className="py-6 text-center text-xs text-muted-foreground">
              Limite du pool atteinte ({MAX_POOL_SIZE} fichiers)
            </p>
          ) : null
        )}
      </div>

      {/* Note informative sur le rôle du pool */}
      {totalFiles > 0 && (
        <p className="text-xs text-muted-foreground">
          L&apos;agent choisira quels médias envoyer sur chaque plateforme.
        </p>
      )}

      {/* Indication glisser-déposer sous la zone (visible uniquement quand le pool est vide) */}
      {totalFiles === 0 && canAddMore && (
        <p className="text-center text-xs text-muted-foreground/60">
          ou glissez-déposez vos fichiers directement
        </p>
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
    </div>
  )
}

// ─── Sous-composants ──────────────────────────────────────────────────────────

/**
 * Aperçu d'un média dans le pool avec badge de type et bouton de suppression.
 */
function PoolMediaPreview({
  media,
  onRemove,
  disabled,
}: {
  media: PoolMedia
  onRemove: () => void
  disabled: boolean
}): React.JSX.Element {
  return (
    <div className="group relative size-20 overflow-hidden rounded-lg border border-border">
      {media.type === 'video' ? (
        <video src={media.url} className="size-full object-cover" muted />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={media.url} alt={media.filename} className="size-full object-cover" />
      )}

      {/* Badge type (photo/vidéo) */}
      <span className="absolute left-1 top-1 rounded bg-black/60 px-1 py-0.5 text-[9px] font-medium text-white">
        {media.type === 'video' ? '▶' : '📷'}
      </span>

      {/* Bouton de suppression au survol */}
      <button
        type="button"
        onClick={onRemove}
        disabled={disabled}
        className={[
          'absolute inset-0 flex items-center justify-center',
          'bg-black/50 opacity-0 transition-opacity group-hover:opacity-100',
          'disabled:cursor-not-allowed',
        ].join(' ')}
        aria-label={`Retirer ${media.filename} du pool`}
      >
        <X className="size-4 text-white" />
      </button>
    </div>
  )
}

/**
 * Aperçu d'un fichier en cours d'upload dans le pool.
 */
function UploadProgressPreview({
  name,
  progress,
  error,
}: {
  name: string
  progress: number
  error?: string
}): React.JSX.Element {
  return (
    <div
      className={[
        'flex size-20 flex-col items-center justify-center gap-1.5 rounded-lg border',
        error ? 'border-destructive/50 bg-destructive/10' : 'border-border bg-muted/30',
      ].join(' ')}
      title={error ?? name}
    >
      {error ? (
        <>
          <X className="size-5 text-destructive" />
          <span className="max-w-[70px] truncate text-[9px] text-destructive">{error}</span>
        </>
      ) : (
        <>
          <Loader2 className="size-5 animate-spin text-primary" />
          <span className="text-[10px] tabular-nums text-muted-foreground">{progress}%</span>
        </>
      )}
    </div>
  )
}
