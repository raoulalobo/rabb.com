/**
 * @file modules/posts/components/AgentModal/AgentModal.tsx
 * @module posts
 * @description Dialog wrapper pour l'AgentModal — gère les modes création, édition et bulk-edit.
 *
 *   - Mode "create"    : Dialog avec AgentModalCreate (N posts générés)
 *   - Mode "edit"      : Dialog avec AgentModalEdit (1 post modifié)
 *   - Mode "bulk-edit" : Dialog avec AgentModalBulkEdit (N posts modifiés en masse)
 *
 *   Utilise le composant Dialog de shadcn/ui pour l'accessibilité (focus trap, Esc, backdrop).
 *
 * @example
 *   // Mode création
 *   <AgentModal mode="create" open={isOpen} onOpenChange={setIsOpen} onPostsCreated={fn} />
 *
 *   // Mode édition
 *   <AgentModal mode="edit" post={selectedPost} open={isOpen} onOpenChange={setIsOpen} onPostUpdated={fn} />
 *
 *   // Mode bulk-edit
 *   <AgentModal mode="bulk-edit" posts={selectedPosts} open={isOpen} onOpenChange={setIsOpen} onPostsUpdated={fn} />
 */

'use client'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { Post } from '@/modules/posts/types'

import { AgentModalCreate } from './AgentModalCreate'
import { AgentModalEdit } from './AgentModalEdit'
import { AgentModalBulkEdit } from './AgentModalBulkEdit'

// ─── Props ────────────────────────────────────────────────────────────────────

/** Props pour le mode création (N posts générés par l'IA) */
interface AgentModalCreateProps {
  mode: 'create'
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Callback appelé avec les posts créés — met à jour la liste /compose */
  onPostsCreated: (posts: Post[]) => void
  onPostUpdated?: never
  onPostsUpdated?: never
  post?: never
  posts?: never
}

/** Props pour le mode édition (1 post modifié par l'IA) */
interface AgentModalEditProps {
  mode: 'edit'
  /** Post à modifier (requis en mode edit) */
  post: Post
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Callback appelé avec le post mis à jour — met à jour la liste /compose */
  onPostUpdated: (post: Post) => void
  onPostsCreated?: never
  onPostsUpdated?: never
  posts?: never
}

/** Props pour le mode édition en masse (N posts modifiés par l'IA) */
interface AgentModalBulkEditProps {
  mode: 'bulk-edit'
  /** Posts sélectionnés à modifier (requis en mode bulk-edit) */
  posts: Post[]
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Callback appelé avec les posts mis à jour — met à jour la liste /compose */
  onPostsUpdated: (posts: Post[]) => void
  onPostsCreated?: never
  onPostUpdated?: never
  post?: never
}

/** Union discriminée sur le mode */
type AgentModalProps = AgentModalCreateProps | AgentModalEditProps | AgentModalBulkEditProps

// ─── Composant ────────────────────────────────────────────────────────────────

/**
 * Modale IA pour créer, éditer ou éditer en masse des posts.
 * Discrimine le mode via la prop `mode` et rend le sous-composant approprié.
 */
export function AgentModal(props: AgentModalProps): React.JSX.Element {
  const { mode, open, onOpenChange } = props

  /** Ferme la modale via le prop onOpenChange */
  const handleClose = (): void => onOpenChange(false)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/*
       * max-h-[90dvh] : limite la hauteur à 90% du viewport dynamique.
       * flex flex-col  : permet au header de garder sa taille naturelle et
       *                  au contenu de remplir le reste via flex-1.
       */}
      <DialogContent className="max-w-xl flex flex-col max-h-[90dvh]">
        <DialogHeader>
          {/* Titre et description selon le mode */}
          {mode === 'create' && (
            <>
              <DialogTitle>Nouveau post avec l&apos;IA</DialogTitle>
              <DialogDescription>
                Décrivez ce que vous voulez publier — l&apos;agent créera un post adapté pour chaque plateforme.
              </DialogDescription>
            </>
          )}
          {mode === 'edit' && (
            <>
              <DialogTitle>Modifier le post</DialogTitle>
              <DialogDescription>
                Donnez une instruction pour modifier ce post — l&apos;agent l&apos;adaptera selon vos besoins.
              </DialogDescription>
            </>
          )}
          {mode === 'bulk-edit' && (
            <>
              <DialogTitle>Modifier avec l&apos;IA ({props.posts.length} posts)</DialogTitle>
              <DialogDescription>
                Donnez une instruction — l&apos;agent générera des modifications pour chaque post sélectionné.
              </DialogDescription>
            </>
          )}
        </DialogHeader>

        {/*
         * flex-1       : prend tout l'espace vertical restant après le header.
         * min-h-0      : indispensable en flex-col — sans lui, un flex item
         *               ne peut pas descendre sous sa taille de contenu minimale
         *               (min-height: auto par défaut).
         * overflow-hidden : transmet la contrainte de hauteur aux enfants
         *                   qui gèrent eux-mêmes leur scroll interne.
         */}
        <div className="flex-1 min-h-0 overflow-hidden">
          {/* Contenu selon le mode */}
          {mode === 'create' && (
            <AgentModalCreate
              onPostsCreated={props.onPostsCreated}
              onClose={handleClose}
            />
          )}
          {mode === 'edit' && (
            <AgentModalEdit
              post={props.post}
              onPostUpdated={(updatedPost) => {
                props.onPostUpdated(updatedPost)
                // La modale reste ouverte pour afficher le succès — AgentModalEdit gère son propre état
              }}
              onClose={handleClose}
            />
          )}
          {mode === 'bulk-edit' && (
            <AgentModalBulkEdit
              posts={props.posts}
              onPostsUpdated={(updatedPosts) => {
                props.onPostsUpdated(updatedPosts)
              }}
              onClose={handleClose}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
