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

import { cn } from '@/lib/utils'
import { toast } from 'sonner'

import { getPlatformViolations } from '@/modules/platforms/config/platform-rules'
import { PLATFORM_CONFIG } from '@/modules/platforms/constants'
import type { Platform } from '@/modules/platforms/types'
import { savePost } from '@/modules/posts/actions/save-post.action'
import { schedulePost } from '@/modules/posts/actions/schedule-post.action'
import { useDraftStore } from '@/modules/posts/store/draft.store'
import type { UploadingFile, UploadUrlResult } from '@/modules/posts/types'

import { AIAssistPanel } from './AIAssistPanel'
import { CarouselEditor } from './CarouselEditor'
import { ContentTypePicker } from './ContentTypePicker'
import { PostComposerContext } from './context'
import { Editor } from './Editor'
import { Footer } from './Footer'
import { MediaUpload } from './MediaUpload'
import { PlatformContentEditor } from './PlatformContentEditor'
import { Platforms } from './Platforms'
import { PlatformTabs } from './PlatformTabs'
import { PostComposerSkeleton } from './PostComposerSkeleton'
import { Schedule } from './Schedule'
import { ThreadEditor } from './ThreadEditor'

// ─── Types ────────────────────────────────────────────────────────────────────

interface PostComposerProps {
  /** Sous-composants du PostComposer (Editor, Platforms, etc.) */
  children: React.ReactNode
  /** Classe CSS optionnelle pour le conteneur racine */
  className?: string
  /**
   * Callback appelé après une soumission réussie (brouillon sauvegardé ou post planifié).
   * Utilisé par CalendarContent pour fermer le Dialog après planification.
   *
   * @example
   *   <PostComposer onSuccess={() => setDialogOpen(false)}>...</PostComposer>
   */
  onSuccess?: () => void
  /**
   * Si true : tous les champs sont affichés en lecture seule (non-interactifs).
   * Utilisé pour consulter un post PUBLISHED dans le calendrier sans pouvoir le modifier.
   *
   * @example
   *   <PostComposer readOnly>...</PostComposer>
   */
  readOnly?: boolean
  /**
   * Callback appelé quand l'état du panneau IA change (ouvert/fermé).
   * Utilisé par CalendarContent pour adapter la largeur du Dialog en temps réel.
   *
   * @param open - true = panneau ouvert, false = panneau fermé
   *
   * @example
   *   <PostComposer onAIPanelChange={setIsAIPanelOpen}>...</PostComposer>
   */
  onAIPanelChange?: (open: boolean) => void
}

// ─── Composant racine ────────────────────────────────────────────────────────

/**
 * Composant racine du PostComposer.
 * Instancie le Provider de contexte et orchestre l'état global du compositeur.
 *
 * @param children   - Sous-composants du PostComposer
 * @param className  - Classe CSS optionnelle
 * @param readOnly   - Mode lecture seule (post PUBLISHED non modifiable)
 */
function PostComposerRoot({ children, className, onSuccess, readOnly = false, onAIPanelChange }: PostComposerProps): React.JSX.Element {
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
    contentType,
    setContentType,
    threadItems,
    updateThreadItem,
    addThreadItem,
    removeThreadItem,
  } = useDraftStore()

  // ─── Panneau IA : ouvert/fermé ───────────────────────────────────────────────
  // Géré ici (dans le Provider) pour être partagé entre Editor (bouton d'ouverture)
  // et CalendarContent (qui observe l'état pour adapter la largeur du Dialog).
  const [isAIPanelOpen, setIsAIPanelOpenRaw] = useState(false)

  /**
   * Ouvre ou ferme le panneau IA.
   * Notifie également le parent via onAIPanelChange si fourni
   * (utilisé par CalendarContent pour adapter la largeur du Dialog).
   *
   * @param open - true pour ouvrir, false pour fermer
   */
  const setAIPanelOpen = useCallback(
    (open: boolean): void => {
      setIsAIPanelOpenRaw(open)
      onAIPanelChange?.(open)
    },
    [onAIPanelChange],
  )

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

  // ─── Insertion de signature dans le texte actif ─────────────────────────────

  /**
   * Appende une signature au texte de l'onglet actif.
   * Ajoute deux sauts de ligne devant la signature si le texte n'est pas vide.
   * Utilise `setActiveText` pour respecter la logique base vs override.
   *
   * @param sigText - Texte de la signature à insérer
   *
   * @example
   *   appendSignature('#photo #lifestyle')
   *   // Si activeText = "Mon post", devient "Mon post\n\n#photo #lifestyle"
   *   // Si activeText = "", devient "#photo #lifestyle" (pas de double saut vide)
   */
  const appendSignature = useCallback(
    (sigText: string): void => {
      // Préfixer d'un double saut de ligne uniquement si le texte n'est pas vide
      const prefix = activeText.length > 0 ? '\n\n' : ''
      setActiveText(activeText + prefix + sigText)
    },
    [activeText, setActiveText],
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

          // Vérifier si cet ajout crée des violations mixed_not_allowed
          // sur les plateformes sélectionnées (le store n'est pas encore mis à jour —
          // on simule le tableau final en ajoutant publicUrl manuellement)
          const nextMediaUrls = [...mediaUrls, publicUrl]
          for (const selectedPlatform of platforms) {
            const violations = getPlatformViolations(selectedPlatform, text, nextMediaUrls)
            const mixedViolation = violations.find((v) => v.type === 'mixed_not_allowed')
            if (mixedViolation) {
              const label = PLATFORM_CONFIG[selectedPlatform as keyof typeof PLATFORM_CONFIG]?.label ?? selectedPlatform
              const isNewVideo = /\.(mp4|mov|avi|webm|mkv|m4v)$/i.test(publicUrl)
              const mediaType = isNewVideo ? 'vidéo' : 'photo'
              toast.warning(
                `La ${mediaType} a été ajoutée, mais attention : ${label} ne permet pas de mixer vidéo et photos dans un même post. Il faudra choisir l'un ou l'autre à la publication.`,
                { duration: 8000 },
              )
            }
          }
        } else if (platformOverrides[platform]) {
          // Onglet plateforme avec override : ajouter à l'override
          addPlatformOverrideMediaUrl(platform, publicUrl)

          // Vérifier les violations sur cet override (même logique, simulation avant mise à jour du store)
          const currentMediaUrls = platformOverrides[platform]!.mediaUrls
          const nextMediaUrls = [...currentMediaUrls, publicUrl]
          const platformText = platformOverrides[platform]!.text
          const violations = getPlatformViolations(platform, platformText, nextMediaUrls)
          const mixedViolation = violations.find((v) => v.type === 'mixed_not_allowed')
          if (mixedViolation) {
            const label = PLATFORM_CONFIG[platform as keyof typeof PLATFORM_CONFIG]?.label ?? platform
            const isNewVideo = /\.(mp4|mov|avi|webm|mkv|m4v)$/i.test(publicUrl)
            const mediaType = isNewVideo ? 'vidéo' : 'photo'
            toast.warning(
              `La ${mediaType} a été ajoutée au post ${label}, mais attention : ${label} ne permet pas de mixer vidéo et photos dans un même post. Il faudra choisir entre publier en format vidéo OU en format carrousel photo au moment de la mise en ligne.`,
              { duration: 8000 },
            )
          }
        } else {
          // Onglet plateforme sans override : ajouter à la base
          addMediaUrl(publicUrl)

          // Vérifier les violations sur la base pour cette plateforme
          const nextMediaUrls = [...mediaUrls, publicUrl]
          const violations = getPlatformViolations(platform, text, nextMediaUrls)
          const mixedViolation = violations.find((v) => v.type === 'mixed_not_allowed')
          if (mixedViolation) {
            const label = PLATFORM_CONFIG[platform as keyof typeof PLATFORM_CONFIG]?.label ?? platform
            const isNewVideo = /\.(mp4|mov|avi|webm|mkv|m4v)$/i.test(publicUrl)
            const mediaType = isNewVideo ? 'vidéo' : 'photo'
            toast.warning(
              `La ${mediaType} a été ajoutée au post ${label}, mais attention : ${label} ne permet pas de mixer vidéo et photos dans un même post. Il faudra choisir entre publier en format vidéo OU en format carrousel photo au moment de la mise en ligne.`,
              { duration: 8000 },
            )
          }
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
    [activePlatformTab, platformOverrides, addMediaUrl, addPlatformOverrideMediaUrl, text, mediaUrls, platforms],
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
   * Crée UN post par plateforme sélectionnée (modèle : 1 post = 1 plateforme).
   * Pour chaque plateforme, utilise le contenu de l'override s'il existe,
   * sinon le texte et médias de base.
   *
   * Cas particulier :
   * - 0 plateforme → toast d'erreur, aucun appel réseau
   * - 1 plateforme + postId → mise à jour du post existant (PATCH)
   * - N plateformes → N créations indépendantes (POST), postId ignoré
   */
  const saveDraft = useCallback((): void => {
    // Validation locale : au moins une plateforme requise
    if (platforms.length === 0) {
      toast.error('Sélectionne au moins une plateforme avant de sauvegarder')
      return
    }

    startTransition(async () => {
      // Créer un post par plateforme en parallèle
      const results = await Promise.all(
        platforms.map((platform) => {
          // L'override de la plateforme prend le dessus sur le contenu de base
          const platformText = platformOverrides[platform]?.text ?? text
          const platformMediaUrls = platformOverrides[platform]?.mediaUrls ?? mediaUrls

          return savePost({
            // Mise à jour uniquement si 1 seule plateforme ET post déjà en DB
            ...(platforms.length === 1 && postId ? { id: postId } : {}),
            platform,         // champ singulier attendu par PostCreateSchema
            text: platformText,
            mediaUrls: platformMediaUrls,
            status: 'DRAFT',
            // Transmettre les overrides pour persistance en DB
            // (la server action nettoie les overrides identiques au contenu de base)
            platformOverrides: Object.keys(platformOverrides).length > 0 ? platformOverrides : null,
            // Type de contenu (feed, story, reel, thread, carousel)
            contentType,
            // Éléments du thread (null si pas un thread)
            threadItems: contentType === 'thread' ? threadItems : null,
          })
        }),
      )

      const firstError = results.find((r) => !r.success)
      if (firstError) {
        toast.error(firstError.error ?? 'Erreur lors de la sauvegarde')
        return
      }

      // Mémoriser le postId uniquement pour une sélection mono-plateforme
      if (platforms.length === 1 && results[0]?.post) {
        setPostId(results[0].post.id)
      }

      toast.success('Brouillon sauvegardé')
      // Notifier le parent du succès (ex: fermeture du Dialog dans CalendarContent)
      onSuccess?.()
    })
  }, [text, platforms, mediaUrls, platformOverrides, postId, setPostId, onSuccess])

  /**
   * Planifie le post avec la date définie dans scheduledFor.
   * Crée UN post planifié par plateforme sélectionnée (modèle : 1 post = 1 plateforme).
   * Pour chaque plateforme, utilise le contenu de l'override s'il existe,
   * sinon le texte et médias de base.
   *
   * Cas particulier :
   * - scheduledFor null → retour immédiat (bouton "Planifier" désactivé si aucune date)
   * - 0 plateforme → toast d'erreur, aucun appel réseau
   * - 1 plateforme + postId → mise à jour du post existant
   * - N plateformes → N planifications indépendantes, postId ignoré
   */
  const handleSchedulePost = useCallback((): void => {
    if (!scheduledFor) return

    // Validation locale : au moins une plateforme requise
    if (platforms.length === 0) {
      toast.error('Sélectionne au moins une plateforme avant de planifier')
      return
    }

    startTransition(async () => {
      // Planifier un post par plateforme en parallèle
      const results = await Promise.all(
        platforms.map((platform) => {
          // L'override de la plateforme prend le dessus sur le contenu de base
          const platformText = platformOverrides[platform]?.text ?? text
          const platformMediaUrls = platformOverrides[platform]?.mediaUrls ?? mediaUrls

          return schedulePost(
            {
              platform,           // champ singulier attendu par PostCreateSchema
              text: platformText,
              mediaUrls: platformMediaUrls,
              scheduledFor,
              // Transmettre les overrides pour persistance en DB
              platformOverrides: Object.keys(platformOverrides).length > 0 ? platformOverrides : null,
              // Type de contenu (feed, story, reel, thread, carousel)
              contentType,
              // Éléments du thread (null si pas un thread)
              threadItems: contentType === 'thread' ? threadItems : null,
            },
            // Mise à jour uniquement si 1 seule plateforme ET post déjà en DB
            platforms.length === 1 ? (postId ?? undefined) : undefined,
          )
        }),
      )

      const firstError = results.find((r) => !r.success)
      if (firstError) {
        toast.error(firstError.error ?? 'Erreur lors de la planification')
        return
      }

      toast.success(
        `Post${platforms.length > 1 ? 's' : ''} planifié${platforms.length > 1 ? 's' : ''} pour le ${scheduledFor.toLocaleDateString('fr-FR', {
          day: 'numeric',
          month: 'long',
          hour: '2-digit',
          minute: '2-digit',
        })}`,
      )
      reset()
      // Notifier le parent du succès (ex: fermeture du Dialog dans CalendarContent)
      onSuccess?.()
    })
  }, [text, platforms, mediaUrls, platformOverrides, scheduledFor, postId, reset, onSuccess])

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
        // Type de contenu
        contentType,
        setContentType,
        threadItems,
        updateThreadItem,
        addThreadItem,
        removeThreadItem,
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
        // Insertion de signature
        appendSignature,
        // Panneau IA
        isAIPanelOpen,
        setAIPanelOpen,
        // Lecture seule (post PUBLISHED — aucun champ modifiable)
        readOnly,
        // Soumission
        isSubmitting,
        saveDraft,
        schedulePost: handleSchedulePost,
      }}
    >
      {/*
       * Conteneur racine : reçoit className du parent (ex: flex-1 depuis CalendarContent).
       * Div intérieur : layout flex horizontal pour positionner le panneau IA à droite.
       * Le panneau IA doit rester à l'intérieur du Provider pour accéder au contexte.
       * La largeur du Dialog parent s'adapte via onAIPanelChange → CalendarContent.
       */}
      {/* min-h-0 : nécessaire pour qu'un enfant "1fr" dans un grid puisse scroller
          sans que ce composant ne déborde (min-height: auto par défaut bloque le scroll) */}
      <div className={cn('min-h-0', className)}>
        {/* h-full min-h-0 : propage la hauteur du grid row vers AIAssistPanel
            qui peut alors utiliser h-full + overflow-y-auto pour scroller en interne */}
        {/* relative : ancre de positionnement pour l'overlay mobile du panneau IA */}
        <div className="relative flex h-full min-h-0 gap-4">
          {/* Zone principale du compositeur (toujours visible) */}
          {/* overflow-y-auto : permet le scroll interne quand le contenu
              (éditeur + médias + schedule) dépasse la hauteur du dialog mobile */}
          <div className="min-w-0 flex-1 overflow-y-auto">
            {children}
          </div>

          {/* Panneau IA :
              - Mobile (< sm) : overlay absolu couvrant tout le conteneur (z-10)
              - Desktop (≥ sm) : enfant flex statique à droite (comportement actuel) */}
          {isAIPanelOpen && !readOnly && (
            <div className="absolute inset-0 z-10 sm:static sm:inset-auto sm:z-auto">
              <AIAssistPanel onClose={() => setAIPanelOpen(false)} />
            </div>
          )}
        </div>
      </div>
    </PostComposerContext.Provider>
  )
}

// ─── Export avec sous-composants attachés ────────────────────────────────────

/**
 * PostComposer : éditeur de post multi-plateformes avec Compound Component Pattern.
 *
 * Sous-composants disponibles :
 * - PostComposer.PlatformTabs          — onglets par plateforme (base + overrides)
 * - PostComposer.PlatformContentEditor — panneau d'info et actions pour la personnalisation
 * - PostComposer.Editor                — zone de texte avec compteur de caractères
 * - PostComposer.Platforms             — sélection des plateformes connectées
 * - PostComposer.MediaUpload           — upload d'images et vidéos
 * - PostComposer.Schedule              — sélection de la date de planification
 * - PostComposer.Footer                — boutons Brouillon / Planifier
 * - PostComposer.Skeleton              — skeleton de chargement
 * - PostComposer.AIAssist              — panneau latéral de rédaction IA (ouvrable via bouton ✨)
 */
export const PostComposer = Object.assign(PostComposerRoot, {
  PlatformTabs,
  PlatformContentEditor,
  ContentTypePicker,
  ThreadEditor,
  CarouselEditor,
  Editor,
  Platforms,
  MediaUpload,
  Schedule,
  Footer,
  Skeleton: PostComposerSkeleton,
  AIAssist: AIAssistPanel,
})
