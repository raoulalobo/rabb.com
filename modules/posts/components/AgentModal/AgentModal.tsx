/**
 * @file modules/posts/components/AgentModal/AgentModal.tsx
 * @module posts
 * @description Dialog wrapper pour l'AgentModal — gère les modes création et édition.
 *
 *   - Mode "create" : Dialog avec AgentModalCreate
 *   - Mode "edit" : Dialog avec AgentModalEdit (nécessite la prop post)
 *
 *   Utilise le composant Dialog de shadcn/ui pour l'accessibilité (focus trap, Esc, backdrop).
 *
 * @example
 *   // Mode création
 *   <AgentModal
 *     mode="create"
 *     open={isOpen}
 *     onOpenChange={setIsOpen}
 *     onPostsCreated={handlePostsCreated}
 *   />
 *
 *   // Mode édition
 *   <AgentModal
 *     mode="edit"
 *     post={selectedPost}
 *     open={isOpen}
 *     onOpenChange={setIsOpen}
 *     onPostUpdated={handlePostUpdated}
 *   />
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

// ─── Props ────────────────────────────────────────────────────────────────────

/** Props pour le mode création (N posts générés) */
interface AgentModalCreateProps {
  mode: 'create'
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Callback appelé avec les posts créés — met à jour la liste /compose */
  onPostsCreated: (posts: Post[]) => void
  onPostUpdated?: never
  post?: never
}

/** Props pour le mode édition (1 post modifié) */
interface AgentModalEditProps {
  mode: 'edit'
  /** Post à modifier (requis en mode edit) */
  post: Post
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Callback appelé avec le post mis à jour — met à jour la liste /compose */
  onPostUpdated: (post: Post) => void
  onPostsCreated?: never
}

/** Union discriminée sur le mode */
type AgentModalProps = AgentModalCreateProps | AgentModalEditProps

// ─── Composant ────────────────────────────────────────────────────────────────

/**
 * Modale IA pour créer ou éditer des posts.
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
          {mode === 'create' ? (
            <>
              <DialogTitle>Nouveau post avec l&apos;IA</DialogTitle>
              <DialogDescription>
                Décrivez ce que vous voulez publier — l&apos;agent créera un post adapté pour chaque plateforme.
              </DialogDescription>
            </>
          ) : (
            <>
              <DialogTitle>Modifier le post</DialogTitle>
              <DialogDescription>
                Donnez une instruction pour modifier ce post — l&apos;agent l&apos;adaptera selon vos besoins.
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
          {mode === 'create' ? (
            <AgentModalCreate
              onPostsCreated={(posts) => {
                props.onPostsCreated(posts)
              }}
              onClose={handleClose}
            />
          ) : (
            <AgentModalEdit
              post={props.post}
              onPostUpdated={(updatedPost) => {
                props.onPostUpdated(updatedPost)
                // La modale reste ouverte pour afficher le succès — AgentModalEdit gère son propre état
              }}
              onClose={handleClose}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
