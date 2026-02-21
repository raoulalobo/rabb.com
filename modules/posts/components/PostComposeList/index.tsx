/**
 * @file modules/posts/components/PostComposeList/index.tsx
 * @module posts
 * @description Liste interactive des posts sur la page /compose.
 *
 *   Gère :
 *   - L'affichage des posts initiaux (passés depuis le Server Component parent)
 *   - L'ajout optimiste des nouveaux posts créés via AgentModal (mode create)
 *   - La mise à jour optimiste des posts édités via AgentModal (mode edit)
 *   - La suppression optimiste des posts supprimés via PostComposeCard
 *   - L'ouverture de l'AgentModal en mode création ou édition
 *   - Le filtrage côté client par plateforme via PlatformFilter (multi-select, OR inclusif)
 *   - Le filtrage côté client par statut via StatusFilter (multi-select, OR inclusif)
 *   - Le filtrage côté client par intervalle de date via DateRangeFilter (sur scheduledFor)
 *   - Les trois filtres s'appliquent en AND : un post doit satisfaire les trois filtres
 *
 *   Architecture :
 *   Ce composant est un Client Component ('use client') car il gère l'état local
 *   (liste des posts + modal ouverte + filtres actifs). Il reçoit les posts initiaux
 *   depuis le Server Component parent via la prop `initialPosts`.
 *
 * @example
 *   // Dans compose/page.tsx (Server Component)
 *   const posts = await fetchDraftPosts()
 *   <PostComposeList initialPosts={posts} />
 */

'use client'

import { FileText, Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { DateRange } from 'react-day-picker'
import { endOfDay, startOfDay } from 'date-fns'

import { Button } from '@/components/ui/button'
import { AgentModal } from '@/modules/posts/components/AgentModal'
import type { Post } from '@/modules/posts/types'

import { DateRangeFilter } from './DateRangeFilter'
import { PlatformFilter } from './PlatformFilter'
import { PostComposeCard } from './PostComposeCard'
import { StatusFilter } from './StatusFilter'

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

  // ── État du filtre par plateforme ─────────────────────────────────────────
  // Tableau vide = aucun filtre actif (tout afficher)
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([])

  // ── État du filtre par statut ──────────────────────────────────────────────
  // Tableau vide = aucun filtre actif (tout afficher)
  const [selectedStatuses, setSelectedStatuses] = useState<Post['status'][]>([])

  // ── État du filtre par intervalle de date ─────────────────────────────────
  // undefined = aucun filtre actif (tout afficher).
  // Les posts sans scheduledFor (null) sont exclus si ce filtre est actif.
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined)

  // Plateformes uniques présentes dans la liste courante (mise à jour dynamique)
  // Triées alphabétiquement pour un ordre stable dans le Popover
  const availablePlatforms = useMemo(
    () => [...new Set(posts.map((p) => p.platform))].sort(),
    [posts],
  )

  // Posts filtrés côté client — aucun appel API supplémentaire.
  // Les trois filtres s'appliquent en AND : un post doit satisfaire les trois simultanément.
  // Au sein de chaque filtre plateforme/statut, la logique est OR inclusif (vide = tout passer).
  const filteredPosts = useMemo(() => {
    return posts.filter((post) => {
      // Filtre plateforme — OR inclusif (vide = tout passer)
      const platformMatch =
        selectedPlatforms.length === 0 || selectedPlatforms.includes(post.platform)

      // Filtre statut — OR inclusif (vide = tout passer)
      const statusMatch =
        selectedStatuses.length === 0 || selectedStatuses.includes(post.status)

      // Filtre date — sur scheduledFor
      // Pas de filtre = tout passer ; post sans scheduledFor = exclu si filtre actif
      const dateMatch = (() => {
        if (!dateRange?.from) return true       // Pas de filtre actif → passer
        if (!post.scheduledFor) return false    // Sans date planifiée → exclu si filtre actif
        const from = startOfDay(dateRange.from)
        // Si `to` absent (sélection d'un seul jour) → utiliser `from` comme borne de fin
        const to = endOfDay(dateRange.to ?? dateRange.from)
        return post.scheduledFor >= from && post.scheduledFor <= to
      })()

      // AND entre les trois filtres
      return platformMatch && statusMatch && dateMatch
    })
  }, [posts, selectedPlatforms, selectedStatuses, dateRange])

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
      {/* Barre d'outils : bouton "Nouveau post" + filtres (plateforme + statut) */}
      <div className="flex items-center justify-between gap-3">
        <Button onClick={handleOpenCreate} className="gap-2">
          <Plus className="size-4" />
          Nouveau post
        </Button>

        <div className="flex items-center gap-2">
          {/* Filtre plateforme — visible uniquement si ≥ 2 plateformes distinctes */}
          {availablePlatforms.length >= 2 && (
            <PlatformFilter
              selectedPlatforms={selectedPlatforms}
              availablePlatforms={availablePlatforms}
              onChange={setSelectedPlatforms}
            />
          )}
          {/* Filtre statut — toujours visible (statuts fixes, utile même avec 1 plateforme) */}
          <StatusFilter
            selectedStatuses={selectedStatuses}
            onChange={setSelectedStatuses}
          />
          {/* Filtre date — toujours visible, filtre sur scheduledFor */}
          <DateRangeFilter
            dateRange={dateRange}
            onChange={setDateRange}
          />
        </div>
      </div>

      {/* Barre de statut — compteur + indicateur de filtre actif */}
      {/* Visible si la liste n'est pas vide ET qu'au moins un type de filtre est disponible ou actif */}
      {posts.length > 0 && (availablePlatforms.length >= 2 || selectedStatuses.length > 0 || dateRange?.from) && (
        <p className="text-sm text-muted-foreground">
          {filteredPosts.length} post{filteredPosts.length !== 1 ? 's' : ''}
          {/* Indicateur "· filtré" si au moins un filtre est actif */}
          {(selectedPlatforms.length > 0 || selectedStatuses.length > 0 || dateRange?.from) && (
            <span className="ml-1 text-muted-foreground/70">· filtré</span>
          )}
        </p>
      )}

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
      ) : filteredPosts.length === 0 ? (
        /* Aucun résultat pour le filtre actif */
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-10 text-center">
          <div className="flex size-10 items-center justify-center rounded-full bg-muted">
            <FileText className="size-4 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">Aucun post pour ce filtre</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Essayez d&apos;autres plateformes ou effacez les filtres.
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-foreground"
            onClick={() => {
              // Réinitialiser les trois filtres simultanément
              setSelectedPlatforms([])
              setSelectedStatuses([])
              setDateRange(undefined)
            }}
          >
            Effacer les filtres
          </Button>
        </div>
      ) : (
        /* Liste des posts DRAFT (filtrés ou non) */
        <div className="space-y-3">
          {filteredPosts.map((post) => (
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
