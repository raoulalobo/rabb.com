/**
 * @file modules/posts/components/PostComposer/index.tsx
 * @module posts
 * @description Composant racine du PostComposer — éditeur de post multi-plateformes.
 *   Suit le Compound Component Pattern : chaque sous-composant est attaché en tant
 *   que propriété statique (PostComposer.Editor, PostComposer.Footer, etc.) et
 *   accède à l'état partagé via le contexte PostComposer.
 *
 *   Responsabilités du composant racine :
 *   - Lit le brouillon depuis useDraftStore (Zustand)
 *   - Gère l'onglet actif par plateforme (activePlatformTab)
 *   - Calcule le contenu actif (base ou override selon l'onglet)
 *   - Fournit le contexte à tous les sous-composants
 *   - Gère la logique d'upload (état local uploadingFiles)
 *   - Orchestre les soumissions (saveDraft, schedulePost)
 *
 *   Structure attendue :
 *   ```tsx
 *   <PostComposer>
 *     <PostComposer.PlatformTabs />
 *     <PostComposer.Editor />
 *     <PostComposer.Platforms />
 *     <PostComposer.MediaUpload />
 *     <PostComposer.Schedule />
 *     <PostComposer.Footer />
 *   </PostComposer>
 *   ```
 *
 * @example
 *   // Usage standard dans app/(dashboard)/compose/page.tsx
 *   <PostComposer>
 *     <PostComposer.PlatformTabs />
 *     <PostComposer.Editor placeholder="Quoi de neuf ?" />
 *     <Separator />
 *     <PostComposer.Platforms />
 *     <PostComposer.MediaUpload />
 *     <PostComposer.Schedule />
 *     <PostComposer.Footer />
 *   </PostComposer>
 */

'use client'

import { useCallback, useState, useTransition } from 'react'
import { toast } from 'sonner'

import type { Platform } from '@/modules/platforms/types'
import { savePost } from '@/modules/posts/actions/save-post.action'
import { schedulePost } from '@/modules/posts/actions/schedule-post.action'
import { useDraftStore } from '@/modules/posts/store/draft.store'
import type { UploadingFile, UploadUrlResult } from '@/modules/posts/types'

import { PostComposerContext } from './context'
import { Editor } from './Editor'
import { Footer } from './Footer'
import { MediaUpload } from './MediaUpload'
import { PlatformTabs } from './PlatformTabs'
import { Platforms } from './Platforms'
import { PostComposerSkeleton } from './PostComposerSkeleton'
import { Schedule } from './Schedule'

// ─── Types ────────────────────────────────────────────────────────────────────

interface PostComposerProps {
  /** Sous-composants du PostComposer (Editor, Platforms, etc.) */
  children: React.ReactNode
  /** Classe CSS optionnelle pour le conteneur racine */
  className?: string
}

// ─── Composant racine ────────────────────────────────────────────────────────

/**
 * Composant racine du PostComposer.
 * Instancie le Provider de contexte et orchestre l'état global du compositeur.
 *
 * @param children - Sous-composants du PostComposer
 * @param className - Classe CSS optionnelle
 */
function PostComposerRoot({ children, className }: PostComposerProps): React.JSX.Element {
  // ─── État brouillon depuis Zustand ──────────────────────────────────────────
  const {
    text,
    platforms,
    mediaUrls,
    scheduledFor,
    platformOverrides,
    setText,
    setPlatforms,
    togglePlatform,
    addMediaUrl,
    removeMediaUrl,
    setScheduledFor,
    setPostId,
    postId,
    reset,
    setPlatformOverride,
    removePlatformOverride,
    setPlatformOverrideText,
    addPlatformOverrideMediaUrl,
    removePlatformOverrideMediaUrl,
  } = useDraftStore()

  // ─── Onglet actif (null = onglet "Tous") ────────────────────────────────────
  const [activePlatformTab, setActivePlatformTab] = useState<Platform | null>(null)

  // ─── Contenu actif (base ou override selon l'onglet) ────────────────────────

  /**
   * Texte de l'onglet actif :
   * - Onglet "Tous" (activePlatformTab === null) → text (base)
   * - Onglet plateforme avec override → override.text
   * - Onglet plateforme sans override → text (base, affiché en lecture seule avant personnalisation)
   */
  const activeText =
    activePlatformTab === null
      ? text
      : (platformOverrides[activePlatformTab]?.text ?? text)

  /**
   * Médias de l'onglet actif (même logique que activeText)
   */
  const activeMediaUrls =
    activePlatformTab === null
      ? mediaUrls
      : (platformOverrides[activePlatformTab]?.mediaUrls ?? mediaUrls)

  // ─── Mise à jour du texte selon l'onglet ────────────────────────────────────

  /**
   * Met à jour le texte de l'onglet actif.
   * - Onglet "Tous" → setText (modifie le texte de base)
   * - Onglet plateforme avec override → setPlatformOverrideText
   * - Onglet plateforme sans override → setText (pas encore personnalisé, modifie la base)
   *   Note : l'utilisateur doit cliquer "Personnaliser" pour créer un override.
   */
  const setActiveText = useCallback(
    (value: string): void => {
      if (activePlatformTab === null) {
        // Onglet "Tous" : modifier le texte de base
        setText(value)
      } else if (platformOverrides[activePlatformTab]) {
        // Onglet plateforme avec override existant : modifier l'override
        setPlatformOverrideText(activePlatformTab, value)
      } else {
        // Onglet plateforme sans override : modifier la base (pas encore personnalisé)
        setText(value)
      }
    },
    [activePlatformTab, platformOverrides, setText, setPlatformOverrideText],
  )

  // ─── Ajout/suppression de médias selon l'onglet ─────────────────────────────

  /**
   * Ajoute une URL de média à l'onglet actif.
   * Délègue à la bonne action selon que l'onglet est "Tous" ou une plateforme.
   */
  const addActiveMediaUrl = useCallback(
    (url: string): void => {
      if (activePlatformTab === null) {
        addMediaUrl(url)
      } else if (platformOverrides[activePlatformTab]) {
        addPlatformOverrideMediaUrl(activePlatformTab, url)
      } else {
        // Pas d'override → on modifie la base
        addMediaUrl(url)
      }
    },
    [activePlatformTab, platformOverrides, addMediaUrl, addPlatformOverrideMediaUrl],
  )

  /**
   * Retire une URL de média de l'onglet actif.
   */
  const removeActiveMediaUrl = useCallback(
    (url: string): void => {
      if (activePlatformTab === null) {
        removeMediaUrl(url)
      } else if (platformOverrides[activePlatformTab]) {
        removePlatformOverrideMediaUrl(activePlatformTab, url)
      } else {
        removeMediaUrl(url)
      }
    },
    [activePlatformTab, platformOverrides, removeMediaUrl, removePlatformOverrideMediaUrl],
  )

  // ─── Gestion des overrides ───────────────────────────────────────────────────

  /**
   * Active la personnalisation d'une plateforme.
   * Copie le contenu de base vers un nouvel override pour cette plateforme.
   * Si elle est déjà personnalisée, ne fait rien (l'override existe déjà).
   *
   * @param platform - Plateforme à personnaliser
   */
  const customizePlatform = useCallback(
    (platform: Platform): void => {
      // Ne créer l'override que s'il n'existe pas encore
      if (!platformOverrides[platform]) {
        setPlatformOverride(platform, {
          text,    // Copie le texte de base
          mediaUrls: [...mediaUrls],   // Copie les médias de base (shallow copy)
        })
      }
      // Basculer sur l'onglet de la plateforme
      setActivePlatformTab(platform)
    },
    [platformOverrides, setPlatformOverride, text, mediaUrls],
  )

  /**
   * Supprime la personnalisation d'une plateforme.
   * La plateforme retourne au contenu de base.
   *
   * @param platform - Plateforme dont réinitialiser le contenu
   */
  const resetPlatform = useCallback(
    (platform: Platform): void => {
      removePlatformOverride(platform)
      // Rester sur l'onglet de la plateforme (maintenant en lecture de la base)
    },
    [removePlatformOverride],
  )

  /**
   * Vérifie si une plateforme a un contenu personnalisé.
   *
   * @param platform - Plateforme à vérifier
   */
  const isPlatformCustomized = useCallback(
    (platform: Platform): boolean => {
      return platform in platformOverrides
    },
    [platformOverrides],
  )

  // ─── État local : fichiers en cours d'upload ────────────────────────────────
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([])

  // ─── État de soumission (Server Action) ─────────────────────────────────────
  const [isSubmitting, startTransition] = useTransition()

  // ─── Upload de fichier vers Supabase Storage ────────────────────────────────

  /**
   * Upload un fichier vers Supabase Storage via le presigned URL.
   * 1. Génère un ID temporaire pour suivre la progression
   * 2. Demande un presigned URL via POST /api/posts/upload-url
   * 3. Uploade le fichier via PUT sur le presigned URL
   * 4. Ajoute l'URL publique au brouillon (base ou override selon l'onglet actif)
   *
   * @param file - Fichier à uploader
   * @param targetPlatform - Onglet cible pour l'ajout de l'URL (null = onglet actif courant)
   */
  const uploadFile = useCallback(
    async (file: File, targetPlatform?: Platform | null): Promise<void> => {
      const fileId = `upload-${Date.now()}-${Math.random().toString(36).slice(2)}`

      // L'onglet cible est l'onglet actif au moment de l'appel (sauf si explicitement fourni)
      const platform = targetPlatform !== undefined ? targetPlatform : activePlatformTab

      // Ajouter le fichier à la liste des uploads en cours
      setUploadingFiles((prev) => [
        ...prev,
        { id: fileId, file, progress: 0 },
      ])

      try {
        // Étape 1 : obtenir le presigned URL
        const urlRes = await fetch('/api/posts/upload-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filename: file.name,
            mimeType: file.type,
            size: file.size,
          }),
        })

        if (!urlRes.ok) {
          throw new Error('Impossible d\'obtenir le lien d\'upload')
        }

        const { signedUrl, publicUrl, mimeType } = (await urlRes.json()) as UploadUrlResult & {
          mimeType: string
        }

        // Étape 2 : uploader le fichier directement vers Supabase Storage
        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest()

          // Suivi de la progression de l'upload
          xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) {
              const progress = Math.round((event.loaded / event.total) * 100)
              setUploadingFiles((prev) =>
                prev.map((f) => (f.id === fileId ? { ...f, progress } : f)),
              )
            }
          }

          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve()
            } else {
              reject(new Error(`Upload échoué : ${xhr.status}`))
            }
          }

          xhr.onerror = () => reject(new Error('Erreur réseau lors de l\'upload'))

          xhr.open('PUT', signedUrl)
          xhr.setRequestHeader('Content-Type', mimeType)
          xhr.send(file)
        })

        // Étape 3 : ajouter l'URL publique au bon emplacement selon l'onglet
        if (platform === null || platform === undefined) {
          // Onglet "Tous" : ajouter à la liste de base
          addMediaUrl(publicUrl)
        } else if (platformOverrides[platform]) {
          // Onglet plateforme avec override : ajouter à l'override
          addPlatformOverrideMediaUrl(platform, publicUrl)
        } else {
          // Onglet plateforme sans override : ajouter à la base
          addMediaUrl(publicUrl)
        }

        // Retirer le fichier de la liste des uploads en cours
        setUploadingFiles((prev) => prev.filter((f) => f.id !== fileId))
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Erreur d\'upload'

        // Marquer le fichier en erreur
        setUploadingFiles((prev) =>
          prev.map((f) => (f.id === fileId ? { ...f, error: message } : f)),
        )

        toast.error(`Upload échoué : ${message}`)

        // Nettoyer après 3 secondes
        setTimeout(() => {
          setUploadingFiles((prev) => prev.filter((f) => f.id !== fileId))
        }, 3000)
      }
    },
    [activePlatformTab, platformOverrides, addMediaUrl, addPlatformOverrideMediaUrl],
  )

  /**
   * Supprime un fichier uploadé de la liste et du brouillon (base ou override actif).
   *
   * @param fileId - ID temporaire du fichier en cours d'upload
   * @param publicUrl - URL publique du fichier à supprimer
   */
  const removeUploadedFile = useCallback(
    (fileId: string, publicUrl?: string): void => {
      if (fileId) {
        setUploadingFiles((prev) => prev.filter((f) => f.id !== fileId))
      }
      if (publicUrl) {
        removeActiveMediaUrl(publicUrl)
      }
    },
    [removeActiveMediaUrl],
  )

  // ─── Soumissions ────────────────────────────────────────────────────────────

  /**
   * Sauvegarde le brouillon en DB avec status DRAFT.
   * Transmet les overrides de plateformes à la Server Action.
   */
  const saveDraft = useCallback((): void => {
    startTransition(async () => {
      const result = await savePost({
        ...(postId ? { id: postId } : {}),
        text,
        platforms,
        mediaUrls,
        status: 'DRAFT',
        // Transmission des overrides pour upsert en DB
        platformOverrides: Object.fromEntries(
          Object.entries(platformOverrides).map(([platform, override]) => [
            platform,
            { text: override!.text, mediaUrls: override!.mediaUrls },
          ]),
        ),
      })

      if (result.success && result.post) {
        setPostId(result.post.id)
        toast.success('Brouillon sauvegardé')
      } else {
        toast.error(result.error ?? 'Erreur lors de la sauvegarde')
      }
    })
  }, [text, platforms, mediaUrls, platformOverrides, postId, setPostId])

  /**
   * Planifie le post avec la date définie dans scheduledFor.
   * Transmet les overrides de plateformes à la Server Action.
   */
  const handleSchedulePost = useCallback((): void => {
    if (!scheduledFor) return

    startTransition(async () => {
      const result = await schedulePost(
        {
          text,
          platforms,
          mediaUrls,
          scheduledFor,
          // Transmission des overrides pour upsert en DB
          platformOverrides: Object.fromEntries(
            Object.entries(platformOverrides).map(([platform, override]) => [
              platform,
              { text: override!.text, mediaUrls: override!.mediaUrls },
            ]),
          ),
        },
        postId ?? undefined,
      )

      if (result.success && result.post) {
        toast.success(
          `Post planifié pour le ${scheduledFor.toLocaleDateString('fr-FR', {
            day: 'numeric',
            month: 'long',
            hour: '2-digit',
            minute: '2-digit',
          })}`,
        )
        reset()
      } else {
        toast.error(result.error ?? 'Erreur lors de la planification')
      }
    })
  }, [text, platforms, mediaUrls, platformOverrides, scheduledFor, postId, reset])

  // ─── Rendu ──────────────────────────────────────────────────────────────────

  return (
    <PostComposerContext.Provider
      value={{
        // État brouillon de base
        text,
        platforms,
        mediaUrls,
        scheduledFor,
        // Actions brouillon de base
        setText,
        setPlatforms,
        togglePlatform,
        addMediaUrl,
        removeMediaUrl,
        setScheduledFor,
        // Onglets par plateforme
        activePlatformTab,
        setActivePlatformTab,
        activeText,
        activeMediaUrls,
        setActiveText,
        addActiveMediaUrl,
        removeActiveMediaUrl,
        // Gestion des overrides
        customizePlatform,
        resetPlatform,
        isPlatformCustomized,
        // Upload
        uploadingFiles,
        uploadFile,
        removeUploadedFile,
        // Soumission
        isSubmitting,
        saveDraft,
        schedulePost: handleSchedulePost,
      }}
    >
      <div className={className}>
        {children}
      </div>
    </PostComposerContext.Provider>
  )
}

// ─── Export avec sous-composants attachés ────────────────────────────────────

/**
 * PostComposer : éditeur de post multi-plateformes avec Compound Component Pattern.
 *
 * Sous-composants disponibles :
 * - PostComposer.PlatformTabs — onglets par plateforme (base + overrides)
 * - PostComposer.Editor     — zone de texte avec compteur de caractères
 * - PostComposer.Platforms  — sélection des plateformes connectées
 * - PostComposer.MediaUpload — upload d'images et vidéos
 * - PostComposer.Schedule   — sélection de la date de planification
 * - PostComposer.Footer     — boutons Brouillon / Planifier
 * - PostComposer.Skeleton   — skeleton de chargement
 */
export const PostComposer = Object.assign(PostComposerRoot, {
  PlatformTabs,
  Editor,
  Platforms,
  MediaUpload,
  Schedule,
  Footer,
  Skeleton: PostComposerSkeleton,
})
