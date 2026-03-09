/**
 * @file modules/posts/hooks/useBulkSelection.ts
 * @module posts
 * @description Hook de sélection multiple de posts.
 *   Pattern identique à MediaLibraryContent (modules/media) :
 *   isSelectMode + Set<string> pour les IDs sélectionnés.
 *
 *   Règle critique React : toujours créer un nouveau Set pour chaque mise à jour
 *   (jamais prev.add(id) qui mute le Set existant sans déclencher de re-render).
 *
 * @example
 *   const {
 *     isSelectMode, selectedIds, selectedCount,
 *     toggleSelectMode, togglePost, exitSelectMode, clearSelection
 *   } = useBulkSelection()
 *
 *   // Activer le mode sélection
 *   toggleSelectMode()
 *
 *   // Sélectionner / désélectionner un post
 *   togglePost('post-id-123')
 *
 *   // Sortir du mode sélection (vide la sélection)
 *   exitSelectMode()
 */

import { useCallback, useState } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Valeurs et handlers retournés par useBulkSelection.
 */
export interface UseBulkSelectionReturn {
  /** true si le mode sélection multiple est actif */
  isSelectMode: boolean
  /** Set des IDs de posts sélectionnés */
  selectedIds: Set<string>
  /** Nombre de posts actuellement sélectionnés */
  selectedCount: number
  /**
   * Active ou désactive le mode sélection.
   * Désactivation → vide automatiquement la sélection.
   */
  toggleSelectMode: () => void
  /**
   * Sélectionne ou désélectionne un post par son ID.
   * N'a d'effet que si isSelectMode === true.
   *
   * @param postId - ID du post à basculer
   */
  togglePost: (postId: string) => void
  /**
   * Quitte le mode sélection et vide la sélection en une seule opération.
   * Équivalent à toggleSelectMode() quand isSelectMode === true.
   */
  exitSelectMode: () => void
  /**
   * Vide la sélection sans quitter le mode sélection.
   * Utile après une action groupée réussie.
   */
  clearSelection: () => void
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Gère l'état de sélection multiple pour la grille calendrier.
 *
 * @returns Objet avec l'état et les handlers de sélection
 *
 * @example
 *   const { isSelectMode, selectedIds, togglePost } = useBulkSelection()
 *   // En mode sélection, cliquer sur un chip → togglePost(chip.id)
 */
export function useBulkSelection(): UseBulkSelectionReturn {
  const [isSelectMode, setIsSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  /**
   * Bascule le mode sélection.
   * Si on sort du mode → on vide aussi la sélection.
   */
  const toggleSelectMode = useCallback(() => {
    setIsSelectMode((prev) => {
      if (prev) {
        // On sort du mode → vider la sélection
        setSelectedIds(new Set())
      }
      return !prev
    })
  }, [])

  /**
   * Bascule la sélection d'un post.
   * Crée TOUJOURS un nouveau Set (jamais de mutation directe → React détecte le changement).
   *
   * @param postId - ID du post à sélectionner ou désélectionner
   */
  const togglePost = useCallback((postId: string) => {
    setSelectedIds((prev) => {
      // Créer un nouveau Set à partir de l'existant (pas de mutation)
      const next = new Set(prev)
      if (next.has(postId)) {
        next.delete(postId)
      } else {
        next.add(postId)
      }
      return next
    })
  }, [])

  /**
   * Quitte le mode sélection et vide la sélection.
   */
  const exitSelectMode = useCallback(() => {
    setIsSelectMode(false)
    setSelectedIds(new Set())
  }, [])

  /**
   * Vide la sélection sans quitter le mode sélection.
   */
  const clearSelection = useCallback(() => {
    setSelectedIds(new Set())
  }, [])

  return {
    isSelectMode,
    selectedIds,
    selectedCount: selectedIds.size,
    toggleSelectMode,
    togglePost,
    exitSelectMode,
    clearSelection,
  }
}
