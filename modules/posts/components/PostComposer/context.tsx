/**
 * @file modules/posts/components/PostComposer/context.tsx
 * @module posts
 * @description Contexte React partagé entre les sous-composants du PostComposer.
 *   Expose l'état du brouillon (via draftStore) et les callbacks d'action.
 *   Suit le pattern "state-context-interface" : le Provider est le seul endroit
 *   qui sait comment l'état est géré (Zustand), les sous-composants ne voient
 *   qu'une interface générique.
 *
 *   Depuis la Phase 4 (onglets par plateforme) :
 *   - `activePlatformTab` : onglet actif (null = onglet "Tous")
 *   - `activeText` / `activeMediaUrls` : contenu de l'onglet actif (base ou override)
 *   - `customizePlatform` / `resetPlatform` : gestion des overrides
 *
 * @example
 *   // Dans un sous-composant :
 *   const { activeText, setActiveText, isSubmitting } = usePostComposerContext()
 *
 *   // Pour savoir si une plateforme est personnalisée :
 *   const { isPlatformCustomized } = usePostComposerContext()
 *   isPlatformCustomized('twitter') // true si override présent
 */

'use client'

import { createContext, useContext } from 'react'

import type { Platform } from '@/modules/platforms/types'
import type { UploadingFile } from '@/modules/posts/types'

// ─── Interface du contexte ────────────────────────────────────────────────────

export interface PostComposerContextValue {
  // ── État brouillon de base (lu depuis draftStore) ──────────────────────────
  /** Texte de base (onglet "Tous") */
  text: string
  /** Plateformes sélectionnées */
  platforms: Platform[]
  /** URLs de médias de base (onglet "Tous") */
  mediaUrls: string[]
  /** Date de planification */
  scheduledFor: Date | null

  // ── Actions brouillon de base ──────────────────────────────────────────────
  /** Met à jour le texte de base */
  setText: (text: string) => void
  togglePlatform: (platform: Platform) => void
  setPlatforms: (platforms: Platform[]) => void
  addMediaUrl: (url: string) => void
  removeMediaUrl: (url: string) => void
  setScheduledFor: (date: Date | null) => void

  // ── Onglets par plateforme ─────────────────────────────────────────────────
  /**
   * Onglet actif dans le PostComposer.
   * null = onglet "Tous" (contenu de base)
   * Platform = onglet d'une plateforme spécifique
   */
  activePlatformTab: Platform | null

  /** Bascule vers un onglet (null = onglet "Tous") */
  setActivePlatformTab: (platform: Platform | null) => void

  /**
   * Texte affiché dans l'onglet actif.
   * - Si activePlatformTab === null → text (base)
   * - Si override présent → override.text
   * - Sinon → text (base, en lecture seule)
   */
  activeText: string

  /**
   * Médias affichés dans l'onglet actif.
   * - Si activePlatformTab === null → mediaUrls (base)
   * - Si override présent → override.mediaUrls
   * - Sinon → mediaUrls (base, en lecture seule)
   */
  activeMediaUrls: string[]

  /**
   * Met à jour le contenu de l'onglet actif.
   * - Si activePlatformTab === null → setText (base)
   * - Si override présent → setPlatformOverrideText
   * (Ne crée pas d'override si pas encore personnalisé — utiliser customizePlatform d'abord)
   */
  setActiveText: (text: string) => void

  /** Ajoute une URL de média à l'onglet actif (base ou override selon l'onglet) */
  addActiveMediaUrl: (url: string) => void

  /** Retire une URL de média de l'onglet actif */
  removeActiveMediaUrl: (url: string) => void

  // ── Gestion des overrides ──────────────────────────────────────────────────
  /**
   * Active la personnalisation d'une plateforme.
   * Copie le contenu de base vers un nouvel override et bascule sur l'onglet.
   * Si la plateforme est déjà personnalisée, bascule simplement sur son onglet.
   *
   * @param platform - Plateforme à personnaliser
   */
  customizePlatform: (platform: Platform) => void

  /**
   * Supprime la personnalisation d'une plateforme.
   * La plateforme retourne au contenu de base.
   *
   * @param platform - Plateforme dont réinitialiser le contenu
   */
  resetPlatform: (platform: Platform) => void

  /**
   * Vérifie si une plateforme a un contenu personnalisé (override).
   *
   * @param platform - Plateforme à vérifier
   * @returns true si un override existe pour cette plateforme
   */
  isPlatformCustomized: (platform: Platform) => boolean

  // ── État de l'upload de médias ─────────────────────────────────────────────
  /** Fichiers en cours d'upload avec leur progression */
  uploadingFiles: UploadingFile[]
  /** Déclenche l'upload d'un fichier vers Supabase Storage */
  uploadFile: (file: File, targetPlatform?: Platform | null) => Promise<void>
  /** Retire un fichier uploadé (supprime aussi l'URL du brouillon) */
  removeUploadedFile: (fileId: string, publicUrl?: string) => void

  // ── État de soumission ─────────────────────────────────────────────────────
  /** Vrai pendant la sauvegarde (Server Action en cours) */
  isSubmitting: boolean
  /** Sauvegarde le post comme brouillon (async interne via useTransition) */
  saveDraft: () => void
  /** Sauvegarde le post avec planification (async interne via useTransition) */
  schedulePost: () => void
}

// ─── Création du contexte ─────────────────────────────────────────────────────

const PostComposerContext = createContext<PostComposerContextValue | null>(null)

// ─── Hook d'accès ─────────────────────────────────────────────────────────────

/**
 * Hook pour accéder au contexte du PostComposer depuis un sous-composant.
 * Lance une erreur si utilisé en dehors d'un <PostComposer>.
 *
 * @returns Valeur du contexte PostComposer
 * @throws Error si utilisé hors contexte
 *
 * @example
 *   const { activeText, setActiveText } = usePostComposerContext()
 */
export function usePostComposerContext(): PostComposerContextValue {
  const context = useContext(PostComposerContext)
  if (!context) {
    throw new Error('usePostComposerContext doit être utilisé à l\'intérieur de <PostComposer>')
  }
  return context
}

export { PostComposerContext }
