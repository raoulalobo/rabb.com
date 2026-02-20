/**
 * @file modules/posts/store/draft.store.ts
 * @module posts
 * @description Store Zustand + Immer pour le brouillon de post en cours de rédaction.
 *   Mis à jour en temps réel lors de la saisie dans PostComposer.
 *   Persiste dans sessionStorage : le brouillon survit à un rafraîchissement de page.
 *
 *   Ce store est le seul point de vérité pour l'état du compositeur.
 *   Les Server Actions lisent ce store via les composants Footer.
 *
 *   Depuis la Phase 4, le store gère également les `platformOverrides` :
 *   un dictionnaire optionnel {platform → {text, mediaUrls}} permettant de
 *   personnaliser le contenu par plateforme indépendamment du contenu de base.
 *
 * @example
 *   const { text, setText, platforms, togglePlatform } = useDraftStore()
 *   setText('Mon nouveau post Instagram !')
 *   togglePlatform('instagram')
 *
 *   // Personnaliser le contenu d'une plateforme spécifique :
 *   const { setPlatformOverride, removePlatformOverride } = useDraftStore()
 *   setPlatformOverride('twitter', { text: 'Version courte pour Twitter', mediaUrls: [] })
 *   removePlatformOverride('twitter') // Revenir au contenu de base
 */

import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'

import type { Platform } from '@/modules/platforms/types'

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Contenu spécifique à une plateforme (override du contenu de base).
 * Si présent pour une plateforme, ce contenu est utilisé à la place du contenu
 * de base lors de l'affichage dans l'onglet plateforme et lors de la sauvegarde.
 */
export interface PlatformOverride {
  /** Texte spécifique à cette plateforme */
  text: string
  /** URLs de médias spécifiques à cette plateforme */
  mediaUrls: string[]
}

// ─── Interface du store ───────────────────────────────────────────────────────

interface DraftStore {
  // ── État du brouillon de base ────────────────────────────────────────────────

  /** Texte de base du post (utilisé par toutes les plateformes sans override) */
  text: string

  /** Plateformes sélectionnées pour la publication */
  platforms: Platform[]

  /** URLs publiques des médias de base (Supabase Storage) */
  mediaUrls: string[]

  /**
   * Date/heure de planification.
   * null = publier immédiatement ou enregistrer comme DRAFT.
   */
  scheduledFor: Date | null

  /**
   * ID du post en DB si édition d'un post existant.
   * null = nouveau post (pas encore sauvegardé).
   */
  postId: string | null

  // ── Overrides par plateforme ──────────────────────────────────────────────────

  /**
   * Contenus personnalisés par plateforme (opt-in).
   * Structure : { 'instagram': { text: '...', mediaUrls: [] }, ... }
   *
   * Une plateforme absente de ce dictionnaire utilise le contenu de base.
   * Une plateforme présente affiche son contenu spécifique dans son onglet.
   */
  platformOverrides: Partial<Record<Platform, PlatformOverride>>

  // ── Actions de base ──────────────────────────────────────────────────────────

  /** Met à jour le texte de base du brouillon */
  setText: (text: string) => void

  /** Remplace entièrement la liste des plateformes sélectionnées */
  setPlatforms: (platforms: Platform[]) => void

  /**
   * Ajoute ou retire une plateforme de la sélection.
   * Si absente → ajout. Si présente → retrait + suppression de son override.
   */
  togglePlatform: (platform: Platform) => void

  /** Ajoute une URL de média à la liste de base */
  addMediaUrl: (url: string) => void

  /** Retire une URL de média de la liste de base */
  removeMediaUrl: (url: string) => void

  /** Définit la date de planification (null pour annuler) */
  setScheduledFor: (date: Date | null) => void

  /** Lie le brouillon à un post DB existant */
  setPostId: (id: string | null) => void

  /** Remet le store à l'état initial (après publication ou abandon) */
  reset: () => void

  // ── Actions sur les overrides ─────────────────────────────────────────────────

  /**
   * Définit ou met à jour le contenu spécifique d'une plateforme.
   * Si la plateforme n'avait pas d'override, en crée un.
   *
   * @param platform - Plateforme à personnaliser
   * @param content - Contenu spécifique {text, mediaUrls}
   *
   * @example
   *   setPlatformOverride('twitter', { text: 'Tweet court', mediaUrls: [] })
   */
  setPlatformOverride: (platform: Platform, content: PlatformOverride) => void

  /**
   * Supprime le contenu spécifique d'une plateforme.
   * Après suppression, la plateforme utilise à nouveau le contenu de base.
   *
   * @param platform - Plateforme dont supprimer l'override
   *
   * @example
   *   removePlatformOverride('twitter') // Twitter utilisera à nouveau le texte de base
   */
  removePlatformOverride: (platform: Platform) => void

  /**
   * Supprime tous les overrides de toutes les plateformes.
   * Utile lors d'un reset complet ou d'un changement de sélection majeur.
   */
  clearAllPlatformOverrides: () => void

  /**
   * Met à jour le texte d'un override existant sans modifier ses médias.
   * Si l'override n'existe pas, ne fait rien (utiliser setPlatformOverride pour créer).
   *
   * @param platform - Plateforme à modifier
   * @param text - Nouveau texte
   */
  setPlatformOverrideText: (platform: Platform, text: string) => void

  /**
   * Ajoute une URL de média à l'override d'une plateforme.
   * Si l'override n'existe pas, ne fait rien.
   *
   * @param platform - Plateforme cible
   * @param url - URL du média à ajouter
   */
  addPlatformOverrideMediaUrl: (platform: Platform, url: string) => void

  /**
   * Retire une URL de média de l'override d'une plateforme.
   * Si l'override n'existe pas, ne fait rien.
   *
   * @param platform - Plateforme cible
   * @param url - URL du média à retirer
   */
  removePlatformOverrideMediaUrl: (platform: Platform, url: string) => void
}

// ─── État initial ─────────────────────────────────────────────────────────────

const initialState = {
  text: '',
  platforms: [] as Platform[],
  mediaUrls: [] as string[],
  scheduledFor: null,
  postId: null,
  platformOverrides: {} as Partial<Record<Platform, PlatformOverride>>,
} satisfies Pick<
  DraftStore,
  'text' | 'platforms' | 'mediaUrls' | 'scheduledFor' | 'postId' | 'platformOverrides'
>

// ─── Store ────────────────────────────────────────────────────────────────────

/**
 * Store Zustand du brouillon de post.
 * Utilise Immer pour des mutations directes lisibles (pas de spread nécessaire).
 * Persiste dans sessionStorage sous la clé 'rabb-draft'.
 *
 * @example
 *   // Dans PostComposer.Editor
 *   const text = useDraftStore((s) => s.text)
 *   const setText = useDraftStore((s) => s.setText)
 *
 *   // Sélection atomique pour éviter les re-renders inutiles
 *   const platforms = useDraftStore((s) => s.platforms)
 *
 *   // Lire un override (undefined si pas de personnalisation)
 *   const override = useDraftStore((s) => s.platformOverrides['instagram'])
 */
export const useDraftStore = create<DraftStore>()(
  persist(
    immer((set) => ({
      ...initialState,

      // Met à jour le texte de base — déclenché à chaque frappe dans l'onglet "Tous"
      setText: (text) =>
        set((state) => {
          state.text = text
        }),

      // Remplace la liste complète des plateformes
      setPlatforms: (platforms) =>
        set((state) => {
          state.platforms = platforms
        }),

      // Toggle : ajoute si absent, retire si présent
      // Si on retire une plateforme, on supprime aussi son override pour ne pas garder
      // de données orphelines dans le store
      togglePlatform: (platform) =>
        set((state) => {
          const idx = state.platforms.indexOf(platform)
          if (idx === -1) {
            state.platforms.push(platform)
          } else {
            state.platforms.splice(idx, 1)
            // Nettoyer l'override de la plateforme retirée
            delete state.platformOverrides[platform]
          }
        }),

      // Ajoute une URL de média à la liste de base (après upload Supabase réussi)
      addMediaUrl: (url) =>
        set((state) => {
          state.mediaUrls.push(url)
        }),

      // Retire une URL de média de la liste de base
      removeMediaUrl: (url) =>
        set((state) => {
          state.mediaUrls = state.mediaUrls.filter((u) => u !== url)
        }),

      // Définit la date de planification
      setScheduledFor: (date) =>
        set((state) => {
          state.scheduledFor = date
        }),

      // Lie le brouillon à un post DB existant
      setPostId: (id) =>
        set((state) => {
          state.postId = id
        }),

      // Réinitialise complètement le store (après publication ou nouveau post)
      // Vide aussi tous les overrides de plateformes
      reset: () =>
        set(() => initialState),

      // ── Actions overrides ────────────────────────────────────────────────────

      // Définit ou met à jour le contenu spécifique d'une plateforme
      setPlatformOverride: (platform, content) =>
        set((state) => {
          state.platformOverrides[platform] = content
        }),

      // Supprime l'override d'une plateforme (retour au contenu de base)
      removePlatformOverride: (platform) =>
        set((state) => {
          delete state.platformOverrides[platform]
        }),

      // Supprime tous les overrides
      clearAllPlatformOverrides: () =>
        set((state) => {
          state.platformOverrides = {}
        }),

      // Met à jour uniquement le texte d'un override existant
      setPlatformOverrideText: (platform, text) =>
        set((state) => {
          const override = state.platformOverrides[platform]
          if (override) {
            override.text = text
          }
        }),

      // Ajoute une URL de média à l'override d'une plateforme
      addPlatformOverrideMediaUrl: (platform, url) =>
        set((state) => {
          const override = state.platformOverrides[platform]
          if (override) {
            override.mediaUrls.push(url)
          }
        }),

      // Retire une URL de média de l'override d'une plateforme
      removePlatformOverrideMediaUrl: (platform, url) =>
        set((state) => {
          const override = state.platformOverrides[platform]
          if (override) {
            override.mediaUrls = override.mediaUrls.filter((u) => u !== url)
          }
        }),
    })),
    {
      name: 'rabb-draft',
      // sessionStorage : le brouillon est perdu à la fermeture du navigateur
      // (intentionnel — évite des brouillons "fantômes" entre sessions)
      //
      // Reviver : JSON.stringify sérialise les Date en string ISO (ex: "2024-03-15T10:00:00.000Z").
      // Sans reviver, la réhydratation renverrait une string → `.toLocaleDateString()` crasherait.
      // Le reviver reconvertit scheduledFor en vrai objet Date lors de la lecture du sessionStorage.
      storage: createJSONStorage(() => sessionStorage, {
        reviver: (key, value) => {
          // scheduledFor est le seul champ Date du store
          if (key === 'scheduledFor' && typeof value === 'string' && value !== '') {
            return new Date(value)
          }
          return value
        },
      }),
      // Persister toutes les données du brouillon, y compris les overrides
      partialize: (state) => ({
        text: state.text,
        platforms: state.platforms,
        mediaUrls: state.mediaUrls,
        scheduledFor: state.scheduledFor,
        postId: state.postId,
        platformOverrides: state.platformOverrides,
      }),
    },
  ),
)
