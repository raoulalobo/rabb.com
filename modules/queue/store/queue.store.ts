/**
 * @file modules/queue/store/queue.store.ts
 * @module queue
 * @description Store Zustand + Immer pour l'état UI de la file d'attente.
 *   Gère le jour sélectionné, le créneau en cours d'édition, et le filtre par plateforme.
 *   Pas de logique de fetch (déléguée à TanStack Query via useQueueSlots).
 *
 * @example
 *   const { selectedDay, filterPlatform, setFilterPlatform } = useQueueStore()
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

  /** Contrôle l'ouverture du dialog d'ajout/modification de créneau. */
  isEditorOpen: boolean

  /**
   * Filtre par plateforme pour l'affichage de la grille.
   * null = afficher tous les créneaux de toutes les plateformes.
   * string = afficher uniquement les créneaux de cette plateforme.
   */
  filterPlatform: string | null

  // ── Actions ─────────────────────────────────────────────────────────────────

  /** Sélectionne un jour de la semaine dans la grille. */
  setSelectedDay: (day: number | null) => void

  /** Ouvre le dialog en mode création pour un jour donné. */
  openCreateEditor: (dayOfWeek: number) => void

  /** Ouvre le dialog en mode édition pour un créneau existant. */
  openEditEditor: (slot: QueueSlot) => void

  /** Ferme le dialog d'édition et réinitialise editingSlot. */
  closeEditor: () => void

  /** Change le filtre par plateforme (null = toutes). */
  setFilterPlatform: (platform: string | null) => void
}

// ─── Store ───────────────────────────────────────────────────────────────────

/**
 * Store Zustand de la file d'attente.
 * Utilise Immer pour des mutations directes lisibles.
 * Pas de persistance (état transitoire — ne survit pas au rafraîchissement).
 */
export const useQueueStore = create<QueueStore>()(
  immer((set) => ({
    selectedDay: null,
    editingSlot: null,
    isEditorOpen: false,
    filterPlatform: null,

    setSelectedDay: (day) =>
      set((state) => {
        state.selectedDay = day
      }),

    // Ouvre le dialog en mode création avec un dayOfWeek pré-rempli
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

    // Change le filtre par plateforme
    setFilterPlatform: (platform) =>
      set((state) => {
        state.filterPlatform = platform
      }),
  })),
)
