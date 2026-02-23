/**
 * @file modules/posts/components/PostComposeList/index.tsx
 * @module posts
 * @description Liste interactive des posts sur la page /compose.
 *   Propose deux vues toggleables :
 *
 *   **Vue Liste** (défaut) :
 *   - Infinite scroll via useInfiniteQuery + IntersectionObserver
 *   - Filtres serveur : plateforme + statut + intervalle de date
 *     → extraits en langage naturel via AIFilterModal (Sonnet)
 *     → reset à la page 1 à chaque changement de filtre
 *   - Updates optimistes (create/update/delete) via queryClient.setQueryData
 *   - Bouton "Nouveau post" → AgentModal (création / édition)
 *
 *   **Vue Calendrier** (lecture seule) :
 *   - Charge le mois complet via useCalendarPosts (inside CalendarGrid)
 *   - Filtre client-side : statut + plateforme (issus du filtre IA)
 *   - Chips cliquables → Popover d'aperçu
 *   - Bouton "Nouveau post" masqué
 *
 *   Architecture :
 *   Client Component ('use client') — reçoit les posts initiaux du Server Component
 *   parent, hydrate le cache TanStack Query pour éviter un double chargement.
 *
 * @example
 *   // Dans compose/page.tsx (Server Component)
 *   const { posts, nextCursor } = await fetchInitialPosts(userId)
 *   <PostComposeList initialPosts={posts} initialNextCursor={nextCursor} />
 */

'use client'

import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarDays, FileText, LayoutList, Loader2, Plus, Search, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { AgentModal } from '@/modules/posts/components/AgentModal'
import { CalendarGrid } from '@/modules/posts/components/CalendarGrid/CalendarGrid'
import { composeQueryKey, fetchComposePage } from '@/modules/posts/queries/posts.queries'
import type { ComposeFilters, ComposePage } from '@/modules/posts/queries/posts.queries'
import type { Post } from '@/modules/posts/types'

import { AIFilterModal } from './AIFilterModal'
import { PostComposeCard } from './PostComposeCard'
import { PostDetailModal } from './PostDetailModal'

import type { ExtractedFilters } from './AIFilterModal'
import type { InfiniteData } from '@tanstack/react-query'
import type { DateRange } from 'react-day-picker'

// ─── Types internes ────────────────────────────────────────────────────────────

/** Type helper pour le cache infini TanStack Query */
type ComposeData = InfiniteData<ComposePage>

/** Vue active de la page /compose */
type ComposeView = 'list' | 'calendar'

// ─── Helpers de tri ───────────────────────────────────────────────────────────

/**
 * Trie un tableau de posts selon l'ordre serveur de la page /compose :
 *   1. scheduledFor DESC NULLS LAST (posts planifiés d'abord, brouillons après)
 *   2. createdAt DESC (plus récent en premier, à égalité de date planifiée)
 *
 * Miroir exact du `orderBy` Prisma de /api/posts route.ts.
 * Utilisé après un update optimiste pour maintenir l'ordre de la liste
 * sans recharger les données depuis le serveur.
 *
 * @param posts - Posts à trier (non muté — crée une copie interne)
 * @returns Nouveau tableau trié
 *
 * @example
 *   // Post A : scheduledFor = demain
 *   // Post B : scheduledFor = null (brouillon)
 *   // Post C : scheduledFor = après-demain
 *   sortComposePosts([A, B, C]) // → [C, A, B]
 */
function sortComposePosts(posts: Post[]): Post[] {
  return [...posts].sort((a, b) => {
    const aMs = a.scheduledFor ? new Date(a.scheduledFor).getTime() : null
    const bMs = b.scheduledFor ? new Date(b.scheduledFor).getTime() : null

    if (aMs !== null && bMs !== null) {
      // Les deux ont une date → DESC (date plus grande = plus loin dans le futur = en premier)
      if (bMs !== aMs) return bMs - aMs
    } else if (aMs !== null) {
      // Seul a a une date → a passe devant (NULLS LAST : les null vont en dernier)
      return -1
    } else if (bMs !== null) {
      // Seul b a une date → b passe devant (NULLS LAST)
      return 1
    }

    // Même scheduledFor (ou les deux null) → tri secondaire par createdAt DESC
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  })
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface PostComposeListProps {
  /** 25 premiers posts DRAFT+SCHEDULED chargés côté serveur */
  initialPosts: Post[]
  /** Curseur pour la page suivante (null = tous les posts tiennent sur une page) */
  initialNextCursor: string | null
}

// ─── Composant ────────────────────────────────────────────────────────────────

/**
 * Liste des posts DRAFT+SCHEDULED avec infinite scroll, filtre IA et toggle calendrier.
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
   * Initialisé au mois courant ; synchronisé avec le filtre date actif
   * lors du switch vers la vue calendrier.
   */
  const [calendarInit, setCalendarInit] = useState<{ year: number; month: number }>(() => {
    const now = new Date()
    return { year: now.getFullYear(), month: now.getMonth() + 1 }
  })

  // ── Filtres serveur ───────────────────────────────────────────────────────
  // Alimentés par le filtre IA (AIFilterModal → Sonnet → ExtractedFilters).
  // Chaque changement réinitialise TanStack Query à la page 1 (queryKey change).

  /** Plateformes sélectionnées (vide = tout afficher) */
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([])

  /** Intervalle de date sur scheduledFor (undefined = tout afficher) */
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined)

  /** Statuts sélectionnés (vide = DRAFT+SCHEDULED par défaut côté serveur) */
  const [selectedStatuses, setSelectedStatuses] = useState<Post['status'][]>([])

  // ── Requête texte active (affichée dans le bouton Rechercher) ─────────────
  /** Libellé court de la recherche active — vide si aucun filtre IA actif */
  const [activeQueryText, setActiveQueryText] = useState<string>('')

  // ── Mot-clé de recherche textuelle extrait par l'IA ───────────────────────
  /** Transmis à l'API via ?search=<mot> → filtre Prisma ILIKE '%mot%'. Vide = pas de filtre */
  const [activeSearchQuery, setActiveSearchQuery] = useState<string>('')

  // ── Filtre courant (mémorisé pour stabilité des références) ───────────────
  const filters: ComposeFilters = useMemo(
    () => ({
      platforms: selectedPlatforms,
      dateRange,
      statuses: selectedStatuses,
      // queryText déclenche un refetch serveur quand il change (inclus dans queryKey)
      queryText: activeSearchQuery,
    }),
    [selectedPlatforms, dateRange, selectedStatuses, activeSearchQuery],
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
    // ── Données SSR comme initialData uniquement si aucun filtre actif ────────
    // Évite un round-trip réseau au premier rendu.
    // Dès qu'un filtre est activé, TanStack Query fetche depuis la page 1.
    initialData:
      selectedPlatforms.length === 0 && !dateRange && selectedStatuses.length === 0 && !activeSearchQuery
        ? ({
            pages: [{ posts: initialPosts, nextCursor: initialNextCursor }],
            pageParams: [undefined],
          } satisfies InfiniteData<ComposePage>)
        : undefined,
    // 30s de fraîcheur — évite les re-fetch répétés lors des navigations
    staleTime: 30_000,
  })

  // ── Liste plate de tous les posts chargés ─────────────────────────────────
  // Les filtres (plateforme, statut, date) sont appliqués côté serveur.
  // Pas de filtrage client-side — seuls les posts correspondants sont retournés.
  const allPosts = useMemo(
    () => data?.pages.flatMap((page) => page.posts) ?? [],
    [data],
  )

  // ── Plateformes disponibles (pour un éventuel retour des filtres manuels) ──
  // Accumulateur : une fois vues, les plateformes restent dans la liste même
  // si le filtre actif les masque (évite la disparition du filtre après sélection).
  const seenPlatformsRef = useRef<Set<string>>(
    new Set(initialPosts.map((p) => p.platform)),
  )
  const [availablePlatforms, setAvailablePlatforms] = useState<string[]>(
    // Initialisation depuis initialPosts (même source que seenPlatformsRef)
    // — évite d'accéder au ref pendant le rendu (règle react-hooks/refs)
    () => [...new Set(initialPosts.map((p) => p.platform))].sort(),
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
   * Filtre appliqué aux posts de chaque cellule du CalendarGrid.
   * Bénéficie automatiquement des filtres IA actifs (selectedStatuses / selectedPlatforms).
   * Stable via useCallback pour éviter les re-renders du CalendarGrid.
   */
  const calendarFilter = useCallback(
    (posts: Post[]): Post[] => {
      // Statuts actifs : ceux du filtre IA s'il est actif, sinon tous les statuts par défaut
      // (cohérent avec le SSR page.tsx et l'API /api/posts qui renvoient aussi les 4 statuts)
      const activeStatuses: Post['status'][] =
        selectedStatuses.length > 0
          ? selectedStatuses
          : ['DRAFT', 'SCHEDULED', 'PUBLISHED', 'FAILED']

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
  const getKey = (): readonly unknown[] => composeQueryKey(filters)

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
   * Met à jour un post édité dans toutes les pages du cache, puis re-trie
   * la liste pour refléter l'ordre serveur (scheduledFor DESC NULLS LAST, createdAt DESC).
   *
   * Algorithme :
   *   1. Aplatir toutes les pages chargées en un tableau unique
   *   2. Remplacer le post modifié par sa nouvelle version
   *   3. Re-trier via sortComposePosts (miroir du ORDER BY serveur)
   *   4. Redistribuer dans les pages en conservant leur taille d'origine
   *
   * @param updatedPost - Post mis à jour retourné par l'API
   */
  const handlePostUpdated = (updatedPost: Post): void => {
    queryClient.setQueryData<ComposeData>(getKey(), (old) => {
      if (!old) return old

      // 1. Aplatir tous les posts chargés (toutes les pages)
      const allLoaded = old.pages.flatMap((page) => page.posts)

      // 2. Remplacer le post modifié par sa version mise à jour
      const replaced = allLoaded.map((p) => (p.id === updatedPost.id ? updatedPost : p))

      // 3. Re-trier selon l'ordre serveur (scheduledFor DESC NULLS LAST, createdAt DESC)
      const sorted = sortComposePosts(replaced)

      // 4. Redistribuer dans les pages en conservant leur taille d'origine.
      //    Conserver la taille de chaque page est crucial pour ne pas corrompre
      //    les curseurs de pagination (nextCursor) de TanStack Query.
      let offset = 0
      const newPages = old.pages.map((page) => {
        const size = page.posts.length
        const newPosts = sorted.slice(offset, offset + size)
        offset += size
        return { ...page, posts: newPosts }
      })

      return { ...old, pages: newPages }
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

  // ── État du modal PostDetailModal ─────────────────────────────────────────
  /** Post dont on affiche le détail (null = modal fermé) */
  const [detailPost, setDetailPost] = useState<Post | null>(null)
  /** Contrôle l'ouverture du PostDetailModal (Radix Dialog controlled) */
  const [detailOpen, setDetailOpen] = useState(false)

  /**
   * Ouvre le modal de détail pour le post sélectionné.
   *
   * @param post - Post dont on souhaite afficher les détails
   */
  const handleOpenDetail = (post: Post): void => {
    setDetailPost(post)
    setDetailOpen(true)
  }

  // ── État de la modale AgentModal ──────────────────────────────────────────
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

  // ── État de la modale AIFilterModal ───────────────────────────────────────
  const [aiModalOpen, setAiModalOpen] = useState(false)

  /**
   * Applique les filtres extraits par Sonnet.
   * Met à jour les 3 états de filtre → queryKey change → TanStack Query reset page 1.
   *
   * @param filters - Filtres structurés retournés par /api/posts/filter-ai
   */
  const handleFiltersApplied = (filters: ExtractedFilters): void => {
    setSelectedPlatforms(filters.platforms)
    // statuses vide = "tous les posts" (Sonnet n'a pas détecté de statut précis)
    // → mapper vers les 4 statuts pour forcer le changement de queryKey + refetch.
    // Sans ce mapping : queryKey identique → TanStack Query ne refetch pas
    // → initialData SSR (DRAFT+SCHEDULED) reste affiché indéfiniment.
    setSelectedStatuses(
      filters.statuses.length > 0
        ? (filters.statuses as Post['status'][])
        : ['DRAFT', 'SCHEDULED', 'PUBLISHED', 'FAILED'],
    )
    // Convertir les dates string ISO en Date pour react-day-picker DateRange
    setDateRange(
      filters.dateRange
        ? { from: new Date(filters.dateRange.from), to: new Date(filters.dateRange.to) }
        : undefined,
    )
    // Stocker le texte de la requête pour affichage dans le bouton
    setActiveQueryText(filters.queryText)
    // Mot-clé de contenu extrait par Claude → transmis à l'API via ?search=
    setActiveSearchQuery(filters.search ?? '')
  }

  // ── Switch vers la vue calendrier ─────────────────────────────────────────
  /**
   * Bascule vers la vue calendrier.
   * Si un filtre date est actif, initialise le calendrier au mois du début
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
    setActiveQueryText('')
    // Réinitialiser le mot-clé de recherche textuelle
    setActiveSearchQuery('')
  }

  // ── Indicateur de filtre actif ────────────────────────────────────────────
  // Inclure activeSearchQuery : un mot-clé seul doit activer le bouton X et changer l'apparence
  const hasActiveFilter =
    selectedPlatforms.length > 0 ||
    selectedStatuses.length > 0 ||
    !!dateRange?.from ||
    !!activeSearchQuery

  // ── Rendu ─────────────────────────────────────────────────────────────────

  // Supprimer avertissement ESLint pour la variable non utilisée (prête pour réactivation)
  void availablePlatforms

  // IMPORTANT : wrapper <div> (non fragment) pour corriger le gap sticky.
  //
  // Problème résolu : compose/page.tsx utilise `space-y-6` sur son wrapper.
  // `space-y-6` applique `margin-top: 24px` sur chaque enfant direct.
  // Avec un fragment `<>`, la toolbar sticky était un enfant direct du wrapper
  // → elle recevait margin-top: 24px → ce gap 24px est transparent (la marge
  // est hors du fond bg-background) → les cartes glissaient dans ce gap lors
  // du scroll et restaient visibles derrière la toolbar.
  //
  // Solution : cette <div> est l'unique enfant de compose/page.tsx issu de
  // PostComposeList → space-y-6 s'applique sur cette <div>, pas sur la toolbar.
  // La toolbar à l'intérieur démarre directement à top: 0, sans gap transparent.
  return (
    <div>
      {/* ── Barre d'outils ──────────────────────────────────────────────────── */}
      {/*
       * sticky : reste visible en haut du scroll container (<main overflow-y-auto>)
       * bg-background : fond opaque pour masquer les cartes qui défilent dessous
       * z-10 : passe devant les cartes (z-index supérieur)
       * py-3 : padding visuel interne
       * border-b : séparateur visuel
       *
       * -top-4 md:-top-6 : compense le padding de <main> (p-4=16px mobile, p-6=24px desktop).
       *   `sticky top:0` colle au bord de la content-box du scroll container (APRÈS le padding).
       *   Avec top: -padding_main, on colle au bord de la padding-box (bord HAUT du viewport),
       *   ce qui garantit aucun gap transparent entre y=0 et le fond de la toolbar.
       *
       *   Formule : top = -(padding-top de <main>)
       *     Mobile  → p-4  = 1rem  = 16px → -top-4
       *     Desktop → p-6  = 1.5rem = 24px → md:-top-6
       *
       * -mt-4 md:-mt-6 + pt-7 md:pt-9 : décale visuellement la toolbar vers le haut
       *   sans modifier l'espace occupé dans le flux normal.
       *   pt = py-3 (12px) + |top offset| pour que les boutons restent à la bonne hauteur.
       */}
      <div className="sticky -top-4 md:-top-6 z-10 flex items-center justify-between gap-3 bg-background py-3 border-b border-border">

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

          {/* TODO: filtres manuels — désactivés au profit du filtre IA — décommenter pour réactiver */}
          {/* Filtre plateforme — visible si ≥ 2 plateformes distinctes chargées */}
          {/* {availablePlatforms.length >= 2 && (
            <PlatformFilter
              selectedPlatforms={selectedPlatforms}
              availablePlatforms={availablePlatforms}
              onChange={setSelectedPlatforms}
            />
          )} */}

          {/* Filtre statut — toujours visible (DRAFT / SCHEDULED) */}
          {/* <StatusFilter
            selectedStatuses={selectedStatuses}
            onChange={setSelectedStatuses}
          /> */}

          {/* Filtre date — masqué en vue calendrier */}
          {/* {view === 'list' && (
            <DateRangeFilter
              dateRange={dateRange}
              onChange={setDateRange}
            />
          )} */}

          {/* ── Bouton Rechercher (filtre IA en langage naturel) ────────────── */}
          <Button
            variant={hasActiveFilter ? 'secondary' : 'outline'}
            size="sm"
            onClick={() => setAiModalOpen(true)}
            className="gap-2"
          >
            <Search className="size-3.5" />
            {hasActiveFilter && activeQueryText
              ? /* Afficher le début de la requête active (max 20 chars) */
                activeQueryText.length > 20
                  ? `${activeQueryText.slice(0, 20)}…`
                  : activeQueryText
              : 'Rechercher'
            }
          </Button>

          {/* Bouton effacer le filtre — visible uniquement si un filtre est actif */}
          {hasActiveFilter && (
            <Button
              variant="ghost"
              size="icon"
              className="size-8 text-muted-foreground hover:text-foreground"
              onClick={handleClearFilters}
              aria-label="Effacer tous les filtres"
              title="Effacer les filtres"
            >
              <X className="size-3.5" />
            </Button>
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
      {/* mt-4 : 16px d'espacement entre la toolbar et le contenu (espace-y-6 du parent
          ne s'applique plus à ces éléments depuis le passage au wrapper <div>) */}
      {view === 'calendar' && (
        <div className="mt-4">
          {/* Information : vue lecture seule */}
          <p className="text-xs text-muted-foreground">
            Vue calendrier — cliquez sur un post pour voir ses détails.
            Les modifications se font depuis la vue liste.
          </p>

          {/*
           * Grille calendrier avec filtre client-side et chips interactifs.
           * Technique "breakout" : left-1/2 + -translate-x-1/2 permet de sortir
           * du container max-w-3xl de la page /compose.
           *
           * Largeur responsive (main padding + sidebar) :
           *   Mobile (< md) : calc(100vw - 2rem)
           *     - 0rem  = pas de sidebar (cachée sur mobile)
           *     - 2rem  = padding du <main> p-4 (1rem de chaque côté)
           *   Desktop (md+) : calc(100vw - 15rem - 3rem)
           *     - 15rem = sidebar fixe (w-60)
           *     - 3rem  = padding du <main> p-6 (1.5rem de chaque côté)
           * → Le calendrier occupe exactement la largeur utile du <main>,
           *   sans débordement ni scrollbar horizontale.
           */}
          <div className="relative left-1/2 w-[calc(100vw-2rem)] -translate-x-1/2 md:w-[calc(100vw-15rem-3rem)]">
            <CalendarGrid
              initialYear={calendarInit.year}
              initialMonth={calendarInit.month}
              interactive
              filterPosts={calendarFilter}
              // onMonthChange non nécessaire — pas d'invalidation cache depuis le calendrier
            />
          </div>
        </div>
      )}

      {/* ── Vue Liste ───────────────────────────────────────────────────────── */}
      {/* mt-4 : 16px d'espacement entre la toolbar et le contenu (espace-y-6 du parent
          ne s'applique plus à ces éléments depuis le passage au wrapper <div>) */}
      {view === 'list' && (
        <div className="mt-4">
          {/* Barre de statut — compteur + indicateur de filtre actif */}
          {allPosts.length > 0 && hasActiveFilter && (
            <p className="text-sm text-muted-foreground">
              {allPosts.length} post{allPosts.length !== 1 ? 's' : ''}
              <span className="ml-1 text-muted-foreground/70">· filtré</span>
            </p>
          )}

          {/* Liste des posts ou état vide */}
          {allPosts.length === 0 && !hasActiveFilter ? (
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
          ) : allPosts.length === 0 && hasActiveFilter ? (
            /* État vide filtré — la recherche IA ne correspond à aucun post */
            <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-10 text-center">
              <div className="flex size-10 items-center justify-center rounded-full bg-muted">
                <Search className="size-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Aucun résultat</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {activeQueryText
                    ? `Aucun post pour « ${activeQueryText} ».`
                    : 'Aucun post pour ce filtre.'}
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
            /* Liste des posts (filtrés côté serveur) */
            <div className="space-y-3">
              {allPosts.map((post) => (
                <PostComposeCard
                  key={post.id}
                  post={post}
                  onEdit={handleOpenEdit}
                  onDelete={handlePostDeleted}
                  onDetail={handleOpenDetail}
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
        </div>
      )}

      {/* ── PostDetailModal — affichage complet d'un post ───────────────────── */}
      {/*
       * Rendu en dehors des vues liste/calendrier pour éviter les conflits de z-index
       * avec les cards et le calendrier.
       * detailPost conserve sa valeur même après la fermeture (lastPostRef dans PostDetailModal)
       * pour que l'animation de fermeture affiche encore le contenu.
       */}
      <PostDetailModal
        post={detailPost}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onEdit={(post) => {
          // Ferme le détail, ouvre l'AgentModal en mode édition
          setSelectedPost(post)
          setModalMode('edit')
          setModalOpen(true)
        }}
        onDelete={handlePostDeleted}
      />

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

      {/* ── AIFilterModal — recherche en langage naturel ─────────────────────── */}
      <AIFilterModal
        open={aiModalOpen}
        onOpenChange={setAiModalOpen}
        currentQuery={activeQueryText}
        onFiltersApplied={handleFiltersApplied}
      />
    </div>
  )
}
