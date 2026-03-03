/**
 * @file modules/posts/components/PostComposeList/BulkActionBar.tsx
 * @module posts
 * @description Barre d'actions flottante visible quand au moins un post est sélectionné.
 *
 *   Positionnée en bas de l'écran (fixed), elle slide-up en animation quand
 *   selectedPosts.length > 0 et disparaît (slide-down) quand la liste est vide.
 *
 *   Actions disponibles :
 *   - "N sélectionné(s)" (chip cliquable) → ouvre SelectionRecap (Popover)
 *   - "+ Ajouter les N visibles" — masqué si tous les posts visibles sont déjà sélectionnés
 *   - "✦ Modifier avec l'IA" — ouvre AgentModal en mode bulk-edit
 *   - "🗑 Supprimer" — ouvre AlertDialog de confirmation puis appelle onBulkDelete
 *   - "✕" — désélectionne tous les posts
 *
 *   L'AlertDialog de suppression est intégré directement pour éviter les conflits de z-index
 *   avec le Dialog de l'AgentModal.
 *
 * @example
 *   <BulkActionBar
 *     selectedPosts={selectedPosts}
 *     unselectedVisibleCount={unselected.length}
 *     onDeselect={deselect}
 *     onSelectAll={selectAll}
 *     onClearSelection={clearSelection}
 *     onBulkEdit={() => setIsBulkEditOpen(true)}
 *     onBulkDelete={handleBulkDelete}
 *     isDeleting={isBulkDeleting}
 *   />
 */

'use client'

import { Loader2, Sparkles, Trash2, X } from 'lucide-react'
import { useState } from 'react'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import type { Post } from '@/modules/posts/types'

import { SelectionRecap } from './SelectionRecap'

// ─── Props ────────────────────────────────────────────────────────────────────

interface BulkActionBarProps {
  /**
   * Liste complète des posts sélectionnés (tous filtres confondus).
   * Passée à SelectionRecap pour le récapitulatif cliquable.
   */
  selectedPosts: Post[]
  /**
   * Nombre de posts visibles dans la vue courante NON encore sélectionnés.
   * Utilisé pour le bouton "+ Ajouter les N visibles" (0 = bouton masqué).
   */
  unselectedVisibleCount: number
  /**
   * Retire un post individuel de la sélection par son ID.
   * Transmis à SelectionRecap pour le bouton × de chaque ligne.
   */
  onDeselect: (postId: string) => void
  /** Ajoute tous les posts visibles à la sélection existante */
  onSelectAll: () => void
  /** Désélectionne tous les posts */
  onClearSelection: () => void
  /** Ouvre l'AgentModal en mode bulk-edit */
  onBulkEdit: () => void
  /** Supprime les posts sélectionnés (après confirmation AlertDialog) */
  onBulkDelete: () => void
  /** true pendant l'opération de suppression — désactive les actions */
  isDeleting: boolean
}

// ─── Composant ────────────────────────────────────────────────────────────────

/**
 * Barre d'actions flottante en bas de l'écran pour les opérations en masse.
 * Visible uniquement si selectedPosts.length > 0.
 */
export function BulkActionBar({
  selectedPosts,
  unselectedVisibleCount,
  onDeselect,
  onSelectAll,
  onClearSelection,
  onBulkEdit,
  onBulkDelete,
  isDeleting,
}: BulkActionBarProps): React.JSX.Element | null {
  /** Contrôle l'ouverture de l'AlertDialog de confirmation de suppression */
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  // Dériver le compteur depuis la liste des posts (source de vérité)
  const selectedCount = selectedPosts.length

  // Pas visible si aucune sélection.
  // Note : on garde le composant monté (return null) plutôt que conditional render
  // pour que l'animation slide-down s'affiche correctement à la désélection.
  const isVisible = selectedCount > 0

  return (
    /*
     * fixed bottom-0 left-0 right-0 z-50 : barre fixe en bas du viewport, passe devant tout
     * transition-transform duration-200   : animation slide-up / slide-down fluide
     * translate-y-full                    : hors du viewport (bas) quand invisible
     * translate-y-0                       : position normale quand visible
     */
    <div
      className={[
        'fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background/95 backdrop-blur-sm',
        'transition-transform duration-200 ease-out',
        isVisible ? 'translate-y-0' : 'translate-y-full',
      ].join(' ')}
      role="toolbar"
      aria-label="Actions sur la sélection"
    >
      {/* Contenu intérieur : max-w pour centrer sur les grands écrans */}
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-2 px-4 py-3">

        {/* ── Côté gauche : récapitulatif cliquable + Ajouter les visibles ── */}
        <div className="flex items-center gap-3">
          {/*
           * Chip "N sélectionné(s)" → ouvre SelectionRecap (Popover).
           * Remplace l'ancien <span> statique pour permettre la consultation
           * et la désélection individuelle des posts cross-filtres.
           */}
          <SelectionRecap
            selectedPosts={selectedPosts}
            onDeselect={onDeselect}
            onClearAll={onClearSelection}
          />

          {/* "+ Ajouter les N visibles" — masqué si tous les posts visibles sont déjà sélectionnés */}
          {unselectedVisibleCount > 0 && (
            <button
              type="button"
              onClick={onSelectAll}
              disabled={isDeleting}
              className="text-xs text-primary underline-offset-2 hover:underline disabled:cursor-not-allowed disabled:opacity-50"
            >
              + Ajouter les {unselectedVisibleCount} visibles
            </button>
          )}
        </div>

        {/* ── Côté droit : actions + fermer ── */}
        <div className="flex items-center gap-2">

          {/* Bouton Modifier avec l'IA */}
          <Button
            variant="outline"
            size="sm"
            onClick={onBulkEdit}
            disabled={isDeleting || selectedCount === 0}
            className="gap-1.5 text-xs"
          >
            <Sparkles className="size-3.5" />
            <span className="hidden sm:inline">Modifier avec l&apos;IA</span>
            <span className="sm:hidden">IA</span>
          </Button>

          {/* Bouton Supprimer + AlertDialog de confirmation */}
          <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                disabled={isDeleting || selectedCount === 0}
                className="gap-1.5 text-xs text-destructive hover:text-destructive hover:bg-destructive/10 hover:border-destructive/50"
              >
                {isDeleting ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Trash2 className="size-3.5" />
                )}
                <span className="hidden sm:inline">
                  {isDeleting ? 'Suppression…' : 'Supprimer'}
                </span>
              </Button>
            </AlertDialogTrigger>

            {/* Contenu du dialog de confirmation */}
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Supprimer {selectedCount} post{selectedCount !== 1 ? 's' : ''} ?</AlertDialogTitle>
                <AlertDialogDescription>
                  {selectedCount === 1
                    ? 'Ce post sera supprimé définitivement. Les posts déjà publiés ne peuvent pas être supprimés.'
                    : `Ces ${selectedCount} posts seront supprimés définitivement. Les posts déjà publiés seront ignorés.`}
                  {' '}Cette action est irréversible.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annuler</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    setDeleteDialogOpen(false)
                    onBulkDelete()
                  }}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Supprimer
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* Bouton "✕" — désélectionner tout */}
          <button
            type="button"
            onClick={onClearSelection}
            disabled={isDeleting}
            aria-label="Désélectionner tous les posts"
            title="Annuler la sélection"
            className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:cursor-not-allowed disabled:opacity-50"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
