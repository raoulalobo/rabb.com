/**
 * @file modules/biolink/store/biolink.store.ts
 * @module biolink
 * @description Store Zustand pour l'état de l'éditeur Bio Link.
 *   Gère l'état local de l'éditeur (thème en preview, slug, modifications non sauvegardées).
 *   Ne contient PAS de logique de fetch (déléguée aux Server Actions).
 *
 *   Utilise Immer pour les mutations immuables lisibles.
 *
 * @example
 *   const { previewTheme, setPreviewTheme } = useBioLinkStore()
 *   setPreviewTheme('neon')  // Preview immédiat dans le LivePreview
 */

import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'

import type { BioThemeName } from '@/modules/biolink/schemas/biolink.schema'

// ─── Types ────────────────────────────────────────────────────────────────────

interface BioLinkStoreState {
  /** Thème en cours de preview (peut différer du thème sauvegardé) */
  previewTheme: BioThemeName
  /** Couleur d'accent en cours de preview */
  previewAccentColor: string
  /** Indique si des modifications non sauvegardées existent */
  hasUnsavedChanges: boolean
  /** ID du lien en cours d'édition dans le dialog (null = aucun) */
  editingLinkId: string | null
  /** Dialog d'ajout/édition de lien ouvert */
  isLinkDialogOpen: boolean
}

interface BioLinkStoreActions {
  /** Change le thème de preview */
  setPreviewTheme: (theme: BioThemeName) => void
  /** Change la couleur d'accent de preview */
  setPreviewAccentColor: (color: string) => void
  /** Marque l'état comme modifié ou sauvegardé */
  setHasUnsavedChanges: (dirty: boolean) => void
  /** Ouvre le dialog d'édition de lien (id = null pour création) */
  openLinkDialog: (linkId?: string | null) => void
  /** Ferme le dialog d'édition de lien */
  closeLinkDialog: () => void
  /** Réinitialise tout l'état du store */
  reset: () => void
}

type BioLinkStore = BioLinkStoreState & BioLinkStoreActions

// ─── État initial ─────────────────────────────────────────────────────────────

const INITIAL_STATE: BioLinkStoreState = {
  previewTheme: 'default',
  previewAccentColor: '#6366f1',
  hasUnsavedChanges: false,
  editingLinkId: null,
  isLinkDialogOpen: false,
}

// ─── Store ────────────────────────────────────────────────────────────────────

/**
 * Store Zustand de l'éditeur Bio Link.
 * Gère le preview temps réel du thème et l'état des dialogs.
 *
 * @example
 *   // Dans ThemePicker : preview immédiat sans sauvegarde
 *   const { setPreviewTheme } = useBioLinkStore()
 *   setPreviewTheme('dark')
 *
 *   // Dans AddLinkDialog : ouvrir le dialog de création
 *   const { openLinkDialog } = useBioLinkStore()
 *   openLinkDialog()  // création
 *   openLinkDialog('lnk_1')  // édition du lien lnk_1
 */
export const useBioLinkStore = create<BioLinkStore>()(
  immer((set) => ({
    ...INITIAL_STATE,

    setPreviewTheme: (theme) =>
      set((state) => {
        state.previewTheme = theme
        state.hasUnsavedChanges = true
      }),

    setPreviewAccentColor: (color) =>
      set((state) => {
        state.previewAccentColor = color
        state.hasUnsavedChanges = true
      }),

    setHasUnsavedChanges: (dirty) =>
      set((state) => {
        state.hasUnsavedChanges = dirty
      }),

    openLinkDialog: (linkId = null) =>
      set((state) => {
        state.editingLinkId = linkId ?? null
        state.isLinkDialogOpen = true
      }),

    closeLinkDialog: () =>
      set((state) => {
        state.editingLinkId = null
        state.isLinkDialogOpen = false
      }),

    reset: () => set(() => ({ ...INITIAL_STATE })),
  }))
)
