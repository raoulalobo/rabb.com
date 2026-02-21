/**
 * @file modules/posts/components/PostComposeList/index.tsx
 * @module posts
 * @description Liste interactive des posts sur la page /compose.
 *   Propose deux vues toggleables :
 *
 *   **Vue Liste** (défaut) :
 *   - Infinite scroll via useInfiniteQuery + IntersectionObserver
 *   - Filtres serveur : plateforme + intervalle de date (reset à la page 1)
 *   - Filtre client-side : statut (sur les posts déjà chargés)
 *   - Updates optimistes (create/update/delete) via queryClient.setQueryData
 *   - Bouton "Nouveau post" → AgentModal (création / édition)
 *
 *   **Vue Calendrier** (lecture seule) :
 *   - Charge le mois complet via useCalendarPosts (inside CalendarGrid)
 *   - Filtre client-side : statut (base DRAFT+SCHEDULED) + plateforme
 *   - Chips cliquables → Popover d'aperçu (plateforme, statut, texte, date, médias)
 *   - DateRangeFilter masqué (navigation mensuelle prend le relais)
 *   - Bouton "Nouveau post" masqué — toutes les mutations depuis la vue liste
 *
 *   Architecture :
 *   Client Component ('use client') — reçoit les posts initiaux du Server Component
 *   parent, hydrate le cache TanStack Query avec ces données pour éviter un
 *   double chargement au démarrage.
 *
 * @example
 *   // Dans compose/page.tsx (Server Component)
 *   const { posts, nextCursor } = await fetchInitialPosts(userId)
 *   <PostComposeList initialPosts={posts} initialNextCursor={nextCursor} />
 */

'use client'

import type { InfiniteData } from '@tanstack/react-query'
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarDays, FileText, LayoutList, Loader2, Plus } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { DateRange } from 'react-day-picker'

import { Button } from '@/components/ui/button'
import { AgentModal } from '@/modules/posts/components/AgentModal'
import { CalendarGrid } from '@/modules/posts/components/CalendarGrid/CalendarGrid'
import type { ComposeFilters, ComposePage } from '@/modules/posts/queries/posts.queries'
import { composeQueryKey, fetchComposePage } from '@/modules/posts/queries/posts.queries'
import type { Post } from '@/modules/posts/types'

import { DateRangeFilter } from './DateRangeFilter'
import { PlatformFilter } from './PlatformFilter'
import { PostComposeCard } from './PostComposeCard'
import { StatusFilter } from './StatusFilter'

// ─── Types internes ────────────────────────────────────────────────────────────

/** Type helper pour le cache infini TanStack Query */
type ComposeData = InfiniteData<ComposePage>

/** Vue active de la page /compose */
type ComposeView = 'list' | 'calendar'

// ─── Props ────────────────────────────────────────────────────────────────────

interface PostComposeListProps {
  /** 25 premiers posts DRAFT+SCHEDULED chargés côté serveur */
  initialPosts: Post[]
  /** Curseur pour la page suivante (null = tous les posts tiennent sur une page) */
  initialNextCursor: string | null
}

// ─── Composant ────────────────────────────────────────────────────────────────

/**
 * Liste des posts DRAFT+SCHEDULED avec infinite scroll, filtres et toggle calendrier.
 *
 * @param initialPosts        - Posts SSR à hydrater dans le cache TanStack Query
 * @param initialNextCursor   - Curseur SSR pour déclencher l'infinite scroll si besoin
 */
export function PostComposeList({
  initialPosts,
  initialNextCursor,
}: PostComposeListProps): React.JSX.Element {
  const queryClient = useQueryClient()

  // ── Vue active : liste ou calendrier ──────────────────────────────────────
  const [view, setView] = useState<ComposeView>('list')

  /**
   * Mois/année affiché par le CalendarGrid.
   * Initialisé au mois courant ; mis à jour lors du switch vers la vue calendrier
   * si un DateRangeFilter est actif (pour ouvrir au mois du début de la plage).
   */
  const [calendarInit, setCalendarInit] = useState<{ year: number; month: number }>(() => {
    const now = new Date()
    return { year: now.getFullYear(), month: now.getMonth() + 1 }
  })

  // ── Filtres serveur ───────────────────────────────────────────────────────
  // Chaque changement de ces filtres réinitialise la query à la page 1
  // car ils font partie de la queryKey (voir composeQueryKey).

  /** Plateformes sélectionnées (vide = tout afficher) */
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([])

  /** Intervalle de date sur scheduledFor (undefined = tout afficher) */
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined)

  // ── Filtre client-side ────────────────────────────────────────────────────
  // Appliqué sur les posts déjà chargés — instantané, sans requête supplémentaire.

  /** Statuts sélectionnés (vide = tout afficher) */
  const [selectedStatuses, setSelectedStatuses] = useState<Post['status'][]>([])

  // ── Filtre courant (mémorisé pour stabilité des références) ───────────────
  const filters: ComposeFilters = useMemo(
    () => ({ platforms: selectedPlatforms, dateRange }),
    [selectedPlatforms, dateRange],
  )

  // ── useInfiniteQuery ──────────────────────────────────────────────────────
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery<ComposePage>({
    queryKey: composeQueryKey(filters),
    queryFn: ({ pageParam }) =>
      fetchComposePage(filters, pageParam as string | undefined),
    // nextCursor = undefined signifie "pas de page suivante"
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    initialPageParam: undefined,
    // ── Données SSR comme initialData quand aucun filtre serveur n'est actif ──
    // Évite un round-trip réseau au premier rendu si les données SSR sont fraîches.
    // Dès qu'un filtre est activé, TanStack Query fetche depuis la page 1 normalement.
    initialData:
      selectedPlatforms.length === 0 && !dateRange
        ? ({
            pages: [{ posts: initialPosts, nextCursor: initialNextCursor }],
            pageParams: [undefined],
          } satisfies InfiniteData<ComposePage>)
        : undefined,
    // 30s de fraîcheur — évite les re-fetch répétés lors des navigations
    staleTime: 30_000,
  })

  // ── Liste plate de tous les posts chargés ─────────────────────────────────
  // Fusion de toutes les pages en un seul tableau ordonné.
  const allPosts = useMemo(
    () => data?.pages.flatMap((page) => page.posts) ?? [],
    [data],
  )

  // ── Filtre statut — client-side (vue liste) ───────────────────────────────
  // Appliqué sur allPosts (DRAFT+SCHEDULED uniquement, cardinalité faible).
  const filteredPosts = useMemo(
    () =>
      selectedStatuses.length === 0
        ? allPosts
        : allPosts.filter((p) => selectedStatuses.includes(p.status)),
    [allPosts, selectedStatuses],
  )

  // ── Plateformes disponibles (pour le PlatformFilter) ─────────────────────
  // On accumule les plateformes vues dans un Set qui ne diminue JAMAIS.
  // Si on les calculait depuis allPosts courante, sélectionner "instagram"
  // ferait disparaître le filtre : la query ne renvoie plus que des posts
  // instagram → allPosts.length = 1 → condition "≥ 2" fausse → filtre caché.
  //
  // Avec le ref accumulateur, une fois qu'une plateforme a été vue elle reste
  // dans la liste, quel que soit le filtre actif.
  const seenPlatformsRef = useRef<Set<string>>(
    new Set(initialPosts.map((p) => p.platform)),
  )
  const [availablePlatforms, setAvailablePlatforms] = useState<string[]>(
    () => [...seenPlatformsRef.current].sort(),
  )

  // Mise à jour : ajouter les nouvelles plateformes découvertes, jamais supprimer
  useEffect(() => {
    const before = seenPlatformsRef.current.size
    allPosts.forEach((p) => seenPlatformsRef.current.add(p.platform))
    if (seenPlatformsRef.current.size > before) {
      setAvailablePlatforms([...seenPlatformsRef.current].sort())
    }
  }, [allPosts])

  // ── Filtre client-side pour la vue calendrier ─────────────────────────────
  /**
   * Filtre appliqué à chaque cellule du CalendarGrid.
   * Base : DRAFT+SCHEDULED (sauf si StatusFilter restreint davantage).
   * En plus : plateforme si selectedPlatforms non vide.
   *
   * Stable via useCallback — évite les re-renders du CalendarGrid.
   */
  const calendarFilter = useCallback(
    (posts: Post[]): Post[] => {
      // Statuts actifs : ceux du filtre s'il est actif, sinon DRAFT+SCHEDULED par défaut
      const activeStatuses: Post['status'][] =
        selectedStatuses.length > 0 ? selectedStatuses : ['DRAFT', 'SCHEDULED']

      return posts.filter(
        (p) =>
          activeStatuses.includes(p.status) &&
          (selectedPlatforms.length === 0 || selectedPlatforms.includes(p.platform)),
      )
    },
    [selectedPlatforms, selectedStatuses],
  )

  // ── Infinite scroll — IntersectionObserver ────────────────────────────────
  // Le sentinel (div invisible en bas de liste) déclenche fetchNextPage
  // quand il entre dans le viewport (avec une marge de 200px).
  // Non rendu en vue calendrier.
  const sentinelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = sentinelRef.current
    // Ne pas observer si pas de page suivante ou déjà en cours de chargement
    if (!el || !hasNextPage) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) void fetchNextPage()
      },
      // Déclencher 200px avant que le sentinel soit visible
      { rootMargin: '200px' },
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [hasNextPage, fetchNextPage])

  // ── Clé de query courante ─────────────────────────────────────────────────
  // Calcul stable pour les updates optimistes (même référence que la query active).
  const getKey = () => composeQueryKey(filters)

  // ── Optimistic updates via queryClient.setQueryData ───────────────────────

  /**
   * Ajoute les nouveaux posts en tête de la première page.
   * Appelé par AgentModal en mode "create" après la génération.
   *
   * @param newPosts - Posts créés par l'agent (un par plateforme ciblée)
   */
  const handlePostsCreated = (newPosts: Post[]): void => {
    queryClient.setQueryData<ComposeData>(getKey(), (old) => {
      if (!old) return old
      const [first, ...rest] = old.pages
      return {
        ...old,
        // Prepend dans la première page — les nouveaux posts apparaissent en haut
        pages: [{ ...first, posts: [...newPosts, ...first.posts] }, ...rest],
      }
    })
  }

  /**
   * Met à jour un post édité dans toutes les pages du cache.
   * Appelé par AgentModal en mode "edit" après la mise à jour.
   *
   * @param updatedPost - Post mis à jour retourné par l'API
   */
  const handlePostUpdated = (updatedPost: Post): void => {
    queryClient.setQueryData<ComposeData>(getKey(), (old) => {
      if (!old) return old
      return {
        ...old,
        pages: old.pages.map((page) => ({
          ...page,
          posts: page.posts.map((p) => (p.id === updatedPost.id ? updatedPost : p)),
        })),
      }
    })
  }

  /**
   * Supprime un post de toutes les pages du cache (optimiste — sans rechargement).
   * Appelé par PostComposeCard après la suppression réussie.
   *
   * @param postId - ID du post supprimé
   */
  const handlePostDeleted = (postId: string): void => {
    queryClient.setQueryData<ComposeData>(getKey(), (old) => {
      if (!old) return old
      return {
        ...old,
        pages: old.pages.map((page) => ({
          ...page,
          posts: page.posts.filter((p) => p.id !== postId),
        })),
      }
    })
  }

  // ── État de la modale ─────────────────────────────────────────────────────
  type ModalMode = 'create' | 'edit'
  const [modalOpen, setModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState<ModalMode>('create')
  /** Post sélectionné pour l'édition (null en mode création) */
  const [selectedPost, setSelectedPost] = useState<Post | null>(null)

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

  /** Ouvre la modale en mode création. */
  const handleOpenCreate = (): void => {
    setSelectedPost(null)
    setModalMode('create')
    setModalOpen(true)
  }

  // ── Switch vers la vue calendrier ─────────────────────────────────────────
  /**
   * Bascule vers la vue calendrier.
   * Si un DateRangeFilter est actif, initialise le calendrier au mois du début
   * de la plage sélectionnée pour un alignement visuel cohérent.
   */
  const handleSwitchToCalendar = (): void => {
    if (dateRange?.from) {
      setCalendarInit({
        year: dateRange.from.getFullYear(),
        month: dateRange.from.getMonth() + 1,
      })
    }
    setView('calendar')
  }

  // ── Réinitialisation de tous les filtres ──────────────────────────────────
  const handleClearFilters = (): void => {
    setSelectedPlatforms([])
    setSelectedStatuses([])
    setDateRange(undefined)
  }

  // ── Indicateur de filtre actif ────────────────────────────────────────────
  const hasActiveFilter =
    selectedPlatforms.length > 0 || selectedStatuses.length > 0 || !!dateRange?.from

  // ── Rendu ─────────────────────────────────────────────────────────────────

  return (
    <>
      {/* ── Barre d'outils ──────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3">

        {/* Bouton "Nouveau post" — masqué en vue calendrier (lecture seule) */}
        {view === 'list' && (
          <Button onClick={handleOpenCreate} className="gap-2">
            <Plus className="size-4" />
            Nouveau post
          </Button>
        )}

        {/* Spacer pour aligner les filtres à droite quand le bouton est masqué */}
        {view === 'calendar' && <div />}

        <div className="flex items-center gap-2">
          {/* Filtre plateforme — visible si ≥ 2 plateformes distinctes chargées */}
          {availablePlatforms.length >= 2 && (
            <PlatformFilter
              selectedPlatforms={selectedPlatforms}
              availablePlatforms={availablePlatforms}
              onChange={setSelectedPlatforms}
            />
          )}

          {/* Filtre statut — toujours visible (DRAFT / SCHEDULED) */}
          <StatusFilter
            selectedStatuses={selectedStatuses}
            onChange={setSelectedStatuses}
          />

          {/* Filtre date — masqué en vue calendrier (navigation mensuelle prend le relais) */}
          {view === 'list' && (
            <DateRangeFilter
              dateRange={dateRange}
              onChange={setDateRange}
            />
          )}

          {/* ── Toggle vue liste / calendrier ──────────────────────────────── */}
          <div className="flex items-center gap-0.5 rounded-md border border-border p-0.5">
            <Button
              variant={view === 'list' ? 'secondary' : 'ghost'}
              size="icon"
              className="size-7"
              onClick={() => setView('list')}
              aria-label="Vue liste"
              aria-pressed={view === 'list'}
            >
              <LayoutList className="size-3.5" />
            </Button>
            <Button
              variant={view === 'calendar' ? 'secondary' : 'ghost'}
              size="icon"
              className="size-7"
              onClick={handleSwitchToCalendar}
              aria-label="Vue calendrier"
              aria-pressed={view === 'calendar'}
            >
              <CalendarDays className="size-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* ── Vue Calendrier ──────────────────────────────────────────────────── */}
      {view === 'calendar' && (
        <>
          {/* Information : vue lecture seule */}
          <p className="text-xs text-muted-foreground">
            Vue calendrier — cliquez sur un post pour voir ses détails.
            Les modifications se font depuis la vue liste.
          </p>

          {/*
           * Grille calendrier avec filtre client-side et chips interactifs.
           * Technique "breakout" : w-[90vw] + left-1/2 + -translate-x-1/2 permet
           * de sortir du container max-w-3xl de la page /compose et d'occuper
           * 90% de la largeur du viewport, comme la page /calendar (max-w-5xl).
           */}
          <div className="relative left-1/2 w-[90vw] -translate-x-1/2">
            <CalendarGrid
              initialYear={calendarInit.year}
              initialMonth={calendarInit.month}
              interactive
              filterPosts={calendarFilter}
              // onMonthChange non nécessaire — pas d'invalidation cache depuis le calendrier
            />
          </div>
        </>
      )}

      {/* ── Vue Liste ───────────────────────────────────────────────────────── */}
      {view === 'list' && (
        <>
          {/* Barre de statut — compteur + indicateur de filtre actif */}
          {allPosts.length > 0 && (availablePlatforms.length >= 2 || selectedStatuses.length > 0 || dateRange?.from) && (
            <p className="text-sm text-muted-foreground">
              {filteredPosts.length} post{filteredPosts.length !== 1 ? 's' : ''}
              {hasActiveFilter && (
                <span className="ml-1 text-muted-foreground/70">· filtré</span>
              )}
            </p>
          )}

          {/* Liste des posts ou état vide */}
          {allPosts.length === 0 ? (
            /* État vide global — aucun brouillon ni planifié */
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
            /* État vide filtré — le filtre actif ne correspond à aucun post chargé */
            <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-10 text-center">
              <div className="flex size-10 items-center justify-center rounded-full bg-muted">
                <FileText className="size-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Aucun post pour ce filtre</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Essayez d&apos;autres critères ou effacez les filtres.
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-foreground"
                onClick={handleClearFilters}
              >
                Effacer les filtres
              </Button>
            </div>
          ) : (
            /* Liste des posts (filtrés ou non) */
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

          {/* ── Infinite scroll ──────────────────────────────────────────────── */}

          {/* Sentinel invisible — déclenche fetchNextPage à 200px du viewport */}
          {hasNextPage && (
            <div
              ref={sentinelRef}
              className="h-1"
              aria-hidden="true"
            />
          )}

          {/* Spinner de chargement de la page suivante */}
          {isFetchingNextPage && (
            <div className="flex justify-center py-4">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          )}
        </>
      )}

      {/* ── AgentModal — mode création ──────────────────────────────────────── */}
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
