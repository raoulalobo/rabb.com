/**
 * @file modules/posts/components/PostComposer/MediaUpload.tsx
 * @module posts
 * @description Zone d'upload de médias (images/vidéos) pour le PostComposer.
 *   Depuis la Phase 4 (onglets par plateforme) :
 *   - Affiche `activeMediaUrls` (base ou override selon l'onglet actif)
 *   - `maxFiles` est calculé automatiquement selon l'onglet et les plateformes
 *   - L'upload ajoute le média à la bonne cible (base ou override de l'onglet actif)
 *
 *   Workflow :
 *   1. L'utilisateur sélectionne ou glisse un fichier
 *   2. Validation locale (type MIME, taille max 500 Mo)
 *   3. Appel à POST /api/posts/upload-url → presigned URL Supabase
 *   4. Upload direct du fichier vers Supabase Storage (PUT)
 *   5. URL publique ajoutée au brouillon (base ou override selon l'onglet actif)
 *
 *   Interaction avec le contexte :
 *   - Lit : activeMediaUrls, activePlatformTab, platforms, uploadingFiles, isSubmitting
 *   - Écrit : uploadFile, removeUploadedFile
 *
 * @example
 *   <PostComposer>
 *     <PostComposer.MediaUpload />
 *   </PostComposer>
 */

'use client'

import { ImagePlus, Loader2, X } from 'lucide-react'
import { useRef } from 'react'

import { getMaxMediaForPlatforms, PLATFORM_RULES } from '@/modules/platforms/config/platform-rules'
import type { Platform } from '@/modules/platforms/types'

import { usePostComposerContext } from './context'

// ─── Constantes ───────────────────────────────────────────────────────────────

/** Types MIME acceptés pour l'upload (liste de base, filtrée par plateforme) */
const DEFAULT_ACCEPTED_TYPES = 'image/*,video/*'

/** Taille maximale autorisée (500 Mo en octets) */
const MAX_SIZE_BYTES = 500 * 1024 * 1024

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Calcule le nombre maximum de médias selon l'onglet actif.
 * - Onglet "Tous" → minimum parmi toutes les plateformes sélectionnées
 * - Onglet plateforme → max de PLATFORM_RULES[platform].maxPhotos et maxVideos
 *
 * @param activePlatformTab - Onglet actif (null = "Tous")
 * @param platforms - Plateformes sélectionnées
 * @returns Nombre max de fichiers autorisés
 *
 * @example
 *   computeMaxFiles(null, ['instagram', 'twitter']) // 4 (min des deux)
 *   computeMaxFiles('instagram', ['instagram', 'twitter']) // 10
 *   computeMaxFiles('youtube', ['youtube']) // 1 (vidéo uniquement)
 */
function computeMaxFiles(activePlatformTab: Platform | null, platforms: Platform[]): number {
  if (activePlatformTab === null) {
    // Onglet "Tous" : prendre la contrainte la plus restrictive
    return Math.max(1, getMaxMediaForPlatforms(platforms))
  }
  // Onglet plateforme : utiliser ses règles spécifiques
  const rules = PLATFORM_RULES[activePlatformTab]
  return Math.max(rules.maxPhotos, rules.maxVideos)
}

/**
 * Calcule le type d'accept HTML pour l'input file selon la plateforme active.
 * - YouTube : uniquement video/*
 * - Google Business : uniquement image/*
 * - Autres : image/* et video/*
 *
 * @param activePlatformTab - Onglet actif
 * @returns Valeur pour l'attribut `accept` de l'input file
 */
function computeAcceptedTypes(activePlatformTab: Platform | null): string {
  if (activePlatformTab === null) return DEFAULT_ACCEPTED_TYPES
  const rules = PLATFORM_RULES[activePlatformTab]
  return rules.allowedMimeTypes.join(',')
}

// ─── Composant ────────────────────────────────────────────────────────────────

/**
 * Zone d'upload de médias avec aperçu.
 * Affiche les fichiers en cours d'upload avec leur barre de progression,
 * et les médias déjà uploadés avec un bouton de suppression.
 * La limite de fichiers et les types acceptés dépendent de l'onglet actif.
 */
export function MediaUpload(): React.JSX.Element {
  const {
    activeMediaUrls,
    activePlatformTab,
    platforms,
    uploadingFiles,
    uploadFile,
    removeUploadedFile,
    isSubmitting,
  } = usePostComposerContext()

  const inputRef = useRef<HTMLInputElement>(null)

  // Calculer les limites et types selon l'onglet actif
  const maxFiles = computeMaxFiles(activePlatformTab, platforms)
  const acceptedTypes = computeAcceptedTypes(activePlatformTab)

  // Total de fichiers (uploadés + en cours)
  const totalFiles = activeMediaUrls.length + uploadingFiles.length
  const canAddMore = totalFiles < maxFiles

  /**
   * Déclenche la sélection de fichier via l'input caché.
   */
  const handleTriggerClick = (): void => {
    if (!canAddMore || isSubmitting) return
    inputRef.current?.click()
  }

  /**
   * Traite les fichiers sélectionnés par l'input.
   * Valide chaque fichier avant de lancer l'upload.
   * L'onglet actif est capturé au moment de la sélection pour cibler le bon store.
   */
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const files = Array.from(e.target.files ?? [])
    if (files.length === 0) return

    // Réinitialiser l'input pour permettre re-sélection du même fichier
    e.target.value = ''

    // Limiter au nombre restant autorisé
    const allowedFiles = files.slice(0, maxFiles - totalFiles)

    for (const file of allowedFiles) {
      // Validation locale type MIME
      if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
        continue // Ignorer les types non supportés
      }

      // Validation locale taille
      if (file.size > MAX_SIZE_BYTES) {
        continue // Ignorer les fichiers trop lourds
      }

      // Passer l'onglet actif au moment de l'upload (pas celui d'un re-render futur)
      await uploadFile(file, activePlatformTab)
    }
  }

  return (
    <div className="space-y-3">
      {/* Aperçus des médias (uploadés + en cours) */}
      {(activeMediaUrls.length > 0 || uploadingFiles.length > 0) && (
        <div className="flex flex-wrap gap-2">
          {/* Médias déjà uploadés dans l'onglet actif */}
          {activeMediaUrls.map((url) => (
            <UploadedMediaPreview
              key={url}
              url={url}
              onRemove={() => removeUploadedFile('', url)}
              disabled={isSubmitting}
            />
          ))}

          {/* Fichiers en cours d'upload */}
          {uploadingFiles.map((file) => (
            <UploadingMediaPreview
              key={file.id}
              name={file.file.name}
              progress={file.progress}
              error={file.error}
            />
          ))}
        </div>
      )}

      {/* Bouton d'ajout de médias */}
      {canAddMore && (
        <button
          type="button"
          onClick={handleTriggerClick}
          disabled={isSubmitting}
          className={[
            'flex items-center gap-2 rounded-lg border border-dashed border-border/60 px-3 py-2',
            'text-xs text-muted-foreground transition-colors',
            'hover:border-primary/40 hover:text-primary',
            'disabled:cursor-not-allowed disabled:opacity-50',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          ].join(' ')}
          aria-label={`Ajouter des médias (${totalFiles}/${maxFiles})`}
        >
          <ImagePlus className="size-4" />
          <span>
            Ajouter des médias
            <span className="ml-1 opacity-60">
              ({totalFiles}/{maxFiles})
            </span>
          </span>
        </button>
      )}

      {/* Input file caché — types acceptés selon la plateforme active */}
      <input
        ref={inputRef}
        type="file"
        accept={acceptedTypes}
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
 * Aperçu d'un média déjà uploadé avec bouton de suppression.
 *
 * @param url - URL publique du média Supabase
 * @param onRemove - Callback de suppression
 * @param disabled - Désactivation du bouton
 */
function UploadedMediaPreview({
  url,
  onRemove,
  disabled,
}: {
  url: string
  onRemove: () => void
  disabled: boolean
}): React.JSX.Element {
  const isVideo = url.includes('.mp4') || url.includes('.mov') || url.includes('.webm')

  return (
    <div className="group relative size-16 overflow-hidden rounded-lg border border-border">
      {isVideo ? (
        <video src={url} className="size-full object-cover" muted />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="Média uploadé" className="size-full object-cover" />
      )}

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
        aria-label="Supprimer ce média"
      >
        <X className="size-4 text-white" />
      </button>
    </div>
  )
}

/**
 * Aperçu d'un fichier en cours d'upload avec barre de progression.
 *
 * @param name - Nom du fichier
 * @param progress - Progression (0-100)
 * @param error - Message d'erreur si l'upload a échoué
 */
function UploadingMediaPreview({
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
        'flex size-16 flex-col items-center justify-center gap-1 rounded-lg border',
        error ? 'border-destructive/50 bg-destructive/10' : 'border-border bg-muted/30',
      ].join(' ')}
      title={error ?? name}
    >
      {error ? (
        <X className="size-4 text-destructive" />
      ) : (
        <>
          <Loader2 className="size-4 animate-spin text-primary" />
          <span className="text-[10px] tabular-nums text-muted-foreground">{progress}%</span>
        </>
      )}
    </div>
  )
}
