/**
 * @file modules/posts/components/PostComposeList/index.tsx
 * @module posts
 * @description Liste interactive des posts DRAFT sur la page /compose.
 *
 *   Gère :
 *   - L'affichage des posts initiaux (passés depuis le Server Component parent)
 *   - L'ajout optimiste des nouveaux posts créés via AgentModal (mode create)
 *   - La mise à jour optimiste des posts édités via AgentModal (mode edit)
 *   - La suppression optimiste des posts supprimés via PostComposeCard
 *   - L'ouverture de l'AgentModal en mode création ou édition
 *
 *   Architecture :
 *   Ce composant est un Client Component ('use client') car il gère l'état local
 *   (liste des posts + modal ouverte). Il reçoit les posts initiaux depuis le
 *   Server Component parent via la prop `initialPosts`.
 *
 * @example
 *   // Dans compose/page.tsx (Server Component)
 *   const posts = await fetchDraftPosts()
 *   <PostComposeList initialPosts={posts} />
 */

'use client'

import { FileText, Plus } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { AgentModal } from '@/modules/posts/components/AgentModal'
import type { Post } from '@/modules/posts/types'

import { PostComposeCard } from './PostComposeCard'

// ─── Props ────────────────────────────────────────────────────────────────────

interface PostComposeListProps {
  /** Posts DRAFT initiaux chargés côté serveur */
  initialPosts: Post[]
}

// ─── Composant ────────────────────────────────────────────────────────────────

/**
 * Liste des posts DRAFT avec gestion de l'AgentModal.
 * Permet la création de nouveaux posts et l'édition des posts existants.
 */
export function PostComposeList({ initialPosts }: PostComposeListProps): React.JSX.Element {
  // ── État de la liste des posts ────────────────────────────────────────────
  // Initialisé avec les posts du Server Component, mis à jour optimistiquement
  const [posts, setPosts] = useState<Post[]>(initialPosts)

  // ── État de la modale ─────────────────────────────────────────────────────
  /** Mode de la modale ouverte */
  type ModalMode = 'create' | 'edit'
  const [modalOpen, setModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState<ModalMode>('create')
  /** Post sélectionné pour l'édition (null en mode création) */
  const [selectedPost, setSelectedPost] = useState<Post | null>(null)

  // ── Callbacks ─────────────────────────────────────────────────────────────

  /**
   * Ajoute les nouveaux posts créés par l'agent au début de la liste.
   * Appelé par AgentModal en mode "create" après la génération.
   *
   * @param newPosts - Posts créés par l'agent (un par plateforme ciblée)
   */
  const handlePostsCreated = (newPosts: Post[]): void => {
    // Ajouter en tête de liste pour que les plus récents soient visibles en premier
    setPosts((prev) => [...newPosts, ...prev])
  }

  /**
   * Met à jour un post édité dans la liste.
   * Appelé par AgentModal en mode "edit" après la mise à jour.
   *
   * @param updatedPost - Post mis à jour retourné par l'API
   */
  const handlePostUpdated = (updatedPost: Post): void => {
    setPosts((prev) =>
      prev.map((p) => (p.id === updatedPost.id ? updatedPost : p)),
    )
  }

  /**
   * Supprime un post de la liste (optimiste — sans rechargement).
   * Appelé par PostComposeCard après la suppression réussie.
   *
   * @param postId - ID du post supprimé
   */
  const handlePostDeleted = (postId: string): void => {
    setPosts((prev) => prev.filter((p) => p.id !== postId))
  }

  /**
   * Ouvre la modale en mode édition avec le post sélectionné.
   *
   * @param post - Post à modifier
   */
  const handleOpenEdit = (post: Post): void => {
    setSelectedPost(post)
    setModalMode('edit')
    setModalOpen(true)
  }

  /**
   * Ouvre la modale en mode création.
   */
  const handleOpenCreate = (): void => {
    setSelectedPost(null)
    setModalMode('create')
    setModalOpen(true)
  }

  // ── Rendu ─────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Bouton "Ajouter" — visible même si la liste est vide */}
      <div className="flex justify-end">
        <Button onClick={handleOpenCreate} className="gap-2">
          <Plus className="size-4" />
          Nouveau post
        </Button>
      </div>

      {/* Liste des posts ou état vide */}
      {posts.length === 0 ? (
        /* État vide — aucun brouillon */
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-12 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-muted">
            <FileText className="size-5 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">Aucun brouillon</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Créez votre premier post avec l&apos;agent IA.
            </p>
          </div>
          <Button onClick={handleOpenCreate} variant="outline" size="sm" className="gap-2">
            <Plus className="size-3.5" />
            Créer un post
          </Button>
        </div>
      ) : (
        /* Liste des posts DRAFT */
        <div className="space-y-3">
          {posts.map((post) => (
            <PostComposeCard
              key={post.id}
              post={post}
              onEdit={handleOpenEdit}
              onDelete={handlePostDeleted}
            />
          ))}
        </div>
      )}

      {/* AgentModal — mode création */}
      {modalMode === 'create' && (
        <AgentModal
          mode="create"
          open={modalOpen}
          onOpenChange={setModalOpen}
          onPostsCreated={handlePostsCreated}
        />
      )}

      {/* AgentModal — mode édition (uniquement si un post est sélectionné) */}
      {modalMode === 'edit' && selectedPost && (
        <AgentModal
          mode="edit"
          post={selectedPost}
          open={modalOpen}
          onOpenChange={setModalOpen}
          onPostUpdated={handlePostUpdated}
        />
      )}
    </>
  )
}
