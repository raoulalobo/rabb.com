/**
 * @file modules/queue/store/queue.store.ts
 * @module queue
 * @description Store Zustand + Immer pour l'état UI de la file d'attente.
 *   Gère le jour sélectionné dans la grille et le créneau en cours d'édition.
 *   Pas de logique de fetch (déléguée à TanStack Query via useQueueSlots).
 *
 * @example
 *   const { selectedDay, setSelectedDay, editingSlot } = useQueueStore()
 *   setSelectedDay(1) // Sélectionner lundi
 */

import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'

import type { QueueSlot } from '@/modules/queue/types'

// ─── Interface du store ──────────────────────────────────────────────────────

interface QueueStore {
  /**
   * Jour de la semaine actuellement sélectionné dans la grille (0-6).
   * null = aucun jour sélectionné (vue d'ensemble).
   */
  selectedDay: number | null

  /**
   * Créneau en cours d'édition dans le dialog QueueSlotEditor.
   * null = mode création (nouveau créneau).
   * QueueSlot = mode édition d'un créneau existant.
   */
  editingSlot: QueueSlot | null

  /**
   * Contrôle l'ouverture du dialog d'ajout/modification de créneau.
   */
  isEditorOpen: boolean

  // ── Actions ─────────────────────────────────────────────────────────────────

  /**
   * Sélectionne un jour de la semaine dans la grille.
   *
   * @param day - Index du jour (0-6) ou null pour désélectionner
   *
   * @example
   *   setSelectedDay(1) // Sélectionner lundi
   *   setSelectedDay(null) // Désélectionner
   */
  setSelectedDay: (day: number | null) => void

  /**
   * Ouvre le dialog en mode création pour un jour donné.
   * Pré-remplit le jour dans le formulaire.
   *
   * @param dayOfWeek - Jour pour lequel créer un créneau
   *
   * @example
   *   openCreateEditor(3) // Ouvrir le dialog pour mercredi
   */
  openCreateEditor: (dayOfWeek: number) => void

  /**
   * Ouvre le dialog en mode édition pour un créneau existant.
   *
   * @param slot - Créneau à modifier
   *
   * @example
   *   openEditEditor(existingSlot) // Modifier un créneau
   */
  openEditEditor: (slot: QueueSlot) => void

  /**
   * Ferme le dialog d'édition et réinitialise editingSlot.
   */
  closeEditor: () => void
}

// ─── Store ───────────────────────────────────────────────────────────────────

/**
 * Store Zustand de la file d'attente.
 * Utilise Immer pour des mutations directes lisibles.
 * Pas de persistance (état transitoire — ne survit pas au rafraîchissement).
 *
 * @example
 *   // Sélection atomique dans un composant
 *   const selectedDay = useQueueStore((s) => s.selectedDay)
 *   const openCreateEditor = useQueueStore((s) => s.openCreateEditor)
 */
export const useQueueStore = create<QueueStore>()(
  immer((set) => ({
    selectedDay: null,
    editingSlot: null,
    isEditorOpen: false,

    // Sélectionne un jour dans la grille (ou null pour désélectionner)
    setSelectedDay: (day) =>
      set((state) => {
        state.selectedDay = day
      }),

    // Ouvre le dialog en mode création avec un dayOfWeek pré-rempli
    // editingSlot reste null → le formulaire sait qu'il s'agit d'une création
    openCreateEditor: (dayOfWeek) =>
      set((state) => {
        state.selectedDay = dayOfWeek
        state.editingSlot = null
        state.isEditorOpen = true
      }),

    // Ouvre le dialog en mode édition avec les données du créneau existant
    openEditEditor: (slot) =>
      set((state) => {
        state.selectedDay = slot.dayOfWeek
        state.editingSlot = slot
        state.isEditorOpen = true
      }),

    // Ferme le dialog et nettoie l'état d'édition
    closeEditor: () =>
      set((state) => {
        state.editingSlot = null
        state.isEditorOpen = false
      }),
  })),
)
