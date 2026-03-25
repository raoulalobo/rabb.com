/**
 * @file modules/posts/components/CalendarView/CalendarContent.tsx
 * @module posts
 * @description Orchestrateur de la page /calendar.
 *   Client Component combinant :
 *   - CalendarFilters   : toolbar de filtres plateforme + statut
 *   - CalendarGrid      : grille mensuelle des posts planifiés
 *   - Dialog shadcn/ui  : fenêtre modale ouverte au clic sur un jour ou un chip
 *   - PostComposer      : éditeur pré-rempli avec la date du jour cliqué (création)
 *                         ou le contenu du post cliqué (édition)
 *
 *   Flux création (clic sur cellule vide) :
 *   1. handleDayClick() — réinitialise le store, pré-remplit scheduledFor, ouvre le Dialog
 *   2. handleSuccess()  — ferme le Dialog, invalide le cache TanStack Query
 *   3. handleOpenChange(false) — ferme le Dialog sans sauvegarder
 *
 *   Flux édition (clic sur un chip de post existant) :
 *   1. handlePostClick(post) — charge le post dans le draft store via loadPost(),
 *      passe en mode 'edit', ouvre le Dialog
 *   2. handleSuccess()  — ferme le Dialog, invalide le cache TanStack Query
 *   3. handleOpenChange(false) — ferme le Dialog, remet en mode 'create'
 *
 *   Filtres (state local, pas de persistance) :
 *   - selectedPlatforms : liste de plateformes actives (vide = tout afficher)
 *   - selectedStatuses  : liste de statuts actifs (vide = tout afficher)
 *   - filterPosts       : callback mémoïsé passé à CalendarGrid
 *
 * @example
 *   // Utilisé dans app/(dashboard)/calendar/page.tsx
 *   <CalendarContent />
 */

'use client'

import { useCallback, useMemo, useState } from 'react'

import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { cn } from '@/lib/utils'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { CalendarGrid } from '@/modules/posts/components/CalendarGrid/CalendarGrid'
import { FailureAlert } from '@/modules/posts/components/FailureAlert'
import { PostComposer } from '@/modules/posts/components/PostComposer'
import { createPost } from '@/modules/posts/actions/create-post.action'
import { deletePost } from '@/modules/posts/actions/delete-post.action'
import { retryPost } from '@/modules/posts/actions/retry-post.action'
import { postQueryKeys } from '@/modules/posts/queries/posts.queries'
import { useDraftStore } from '@/modules/posts/store/draft.store'
import type { Post, PostStatus } from '@/modules/posts/types'

import { CalendarFilters } from './CalendarFilters'

// ─── Composant ────────────────────────────────────────────────────────────────

// ─── Props ─────────────────────────────────────────────────────────────────────

interface CalendarContentProps {
  /** Statuts pré-sélectionnés depuis l'URL (ex: /calendar?status=FAILED) */
  initialStatuses?: PostStatus[]
}

/**
 * Orchestrateur de la page Calendrier.
 * Gère le Dialog PostComposer ouvert depuis la grille calendrier.
 *
 * @param initialStatuses - Statuts pré-sélectionnés (passés depuis le Server Component page.tsx)
 */
export function CalendarContent({ initialStatuses = [] }: CalendarContentProps): React.JSX.Element {
  // ── Accès au store brouillon pour reset + pré-remplissage ────────────────────
  const { reset, setScheduledFor, loadPost } = useDraftStore()

  // ── Client TanStack Query pour invalider le cache après succès ───────────────
  const queryClient = useQueryClient()

  // ── État local des filtres (initialisé depuis URL si présent, sinon vide) ────

  /** Plateformes actives dans le filtre (vide = tout afficher) */
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([])

  /**
   * Statuts actifs dans le filtre.
   * Initialisé depuis ?status=XXX si présent dans l'URL, sinon vide (tout afficher).
   * Exemple : /calendar?status=FAILED → seuls les posts FAILED sont affichés au montage.
   */
  const [selectedStatuses, setSelectedStatuses] = useState<PostStatus[]>(initialStatuses)

  /**
   * Filtre les posts d'une cellule selon les plateformes et statuts sélectionnés.
   * Applique une intersection (AND) entre les deux filtres.
   * Mémoïsé pour éviter les re-renders inutiles dans CalendarGrid.
   *
   * @param posts - Posts bruts de la cellule
   * @returns Posts filtrés selon les critères actifs
   *
   * @example
   *   // Avec selectedPlatforms=['instagram'] et selectedStatuses=['SCHEDULED']
   *   // → retourne uniquement les posts instagram planifiés
   *   filterPosts([{ platform: 'instagram', status: 'SCHEDULED' }, { platform: 'tiktok', ... }])
   *   // → [{ platform: 'instagram', status: 'SCHEDULED' }]
   */
  const filterPosts = useCallback(
    (posts: Post[]): Post[] => {
      let result = posts

      // Filtre par plateforme (OR inclusif entre les plateformes sélectionnées)
      if (selectedPlatforms.length > 0) {
        result = result.filter((p) => selectedPlatforms.includes(p.platform))
      }

      // Filtre par statut (OR inclusif entre les statuts sélectionnés)
      if (selectedStatuses.length > 0) {
        result = result.filter((p) => selectedStatuses.includes(p.status))
      }

      return result
    },
    [selectedPlatforms, selectedStatuses],
  )

  // ── État local du Dialog ─────────────────────────────────────────────────────
  const [dialogOpen, setDialogOpen] = useState(false)

  /**
   * Miroir local de l'état du panneau IA.
   * Mis à jour via onAIPanelChange passé à PostComposer.
   * Utilisé uniquement pour adapter la largeur du Dialog (max-w-3xl → max-w-5xl).
   * L'état réel est géré dans PostComposerRoot (index.tsx) via isAIPanelOpen.
   */
  const [isAIPanelOpen, setIsAIPanelOpen] = useState(false)


  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  /**
   * 'create' = clic sur cellule vide (nouveau post)
   * 'edit'   = clic sur chip DRAFT / SCHEDULED / FAILED (modification possible)
   * 'view'   = clic sur chip PUBLISHED (lecture seule — non replanifiable)
   */
  const [dialogMode, setDialogMode] = useState<'create' | 'edit' | 'view'>('create')
  /** Post en cours d'édition ou de consultation (modes 'edit' et 'view') */
  const [editingPost, setEditingPost] = useState<Post | null>(null)

  // ─── Handlers ────────────────────────────────────────────────────────────────

  /**
   * Déclenché au clic sur une cellule de la grille.
   * 1. Réinitialise le brouillon Zustand
   * 2. Calcule scheduledFor (aujourd'hui → +5min, autre jour → 12h00)
   * 3. Ouvre le Dialog
   *
   * @param date - Date du jour cliqué dans la grille
   */
  const handleDayClick = useCallback(
    (date: Date): void => {
      // Vider le brouillon précédent avant de pré-remplir la nouvelle date
      reset()

      const now = new Date()
      const isToday =
        date.getFullYear() === now.getFullYear() &&
        date.getMonth() === now.getMonth() &&
        date.getDate() === now.getDate()

      let scheduledFor: Date

      if (isToday) {
        // Aujourd'hui → planifier dans 5 minutes (délai minimum raisonnable)
        scheduledFor = new Date(now.getTime() + 5 * 60 * 1000)
      } else {
        // Autre jour → midi (heure pratique par défaut)
        scheduledFor = new Date(
          date.getFullYear(),
          date.getMonth(),
          date.getDate(),
          12, // heures
          0,  // minutes
          0,  // secondes
        )
      }

      setScheduledFor(scheduledFor)
      setSelectedDate(date)
      setDialogOpen(true)
    },
    [reset, setScheduledFor],
  )

  /**
   * Appelé par PostComposer après une soumission réussie.
   * Ferme le Dialog et invalide le cache calendrier pour recharger les posts.
   */
  const handleSuccess = useCallback((): void => {
    setDialogOpen(false)
    // Invalider tous les mois du calendrier → CalendarGrid recharge automatiquement
    void queryClient.invalidateQueries({ queryKey: postQueryKeys.calendars() })
  }, [queryClient])

  /**
   * Déclenché au clic sur un chip de post existant dans la grille.
   * - En mode sélection → bascule la sélection du post (pas d'ouverture du Dialog)
   * - PUBLISHED → mode 'view' : contenu visible, footer masqué (lecture seule)
   * - Autres    → mode 'edit' : modification possible
   *
   * @param post - Post DB cliqué dans la grille calendrier
   */
  const handlePostClick = useCallback(
    (post: Post): void => {
      // Charger le post dans le store pour afficher son contenu dans le dialog
      loadPost(post)
      setEditingPost(post)

      if (post.status === 'PUBLISHED') {
        // Post déjà publié → vue lecture seule (pas de footer d'action)
        setDialogMode('view')
      } else {
        // Draft / Scheduled / Failed → édition normale
        setDialogMode('edit')
      }

      setDialogOpen(true)
    },
    [loadPost],
  )

  /**
   * Appelé par le Dialog lors d'une fermeture (×, Escape, clic hors Dialog).
   * Réinitialise la date sélectionnée et remet le mode à 'create'.
   *
   * @param open - Nouvel état du Dialog (false = fermeture)
   */
  const handleOpenChange = useCallback((open: boolean): void => {
    setDialogOpen(open)
    if (!open) {
      // Nettoyer l'état à la fermeture du Dialog (création ou édition)
      setSelectedDate(null)
      setEditingPost(null)
      setDialogMode('create')
      // Fermer également le panneau IA pour éviter qu'il reste ouvert à la prochaine ouverture
      setIsAIPanelOpen(false)
    }
  }, [])

  /**
   * Relance un post FAILED via l'API Zernio (retry des plateformes échouées).
   * Ferme le Dialog et invalide le cache calendrier après succès.
   */
  const handleRetry = useCallback(async (): Promise<void> => {
    if (!editingPost) return

    const result = await retryPost(editingPost.id)

    if (result.success) {
      toast.success('Post relancé avec succès')
      setDialogOpen(false)
      setEditingPost(null)
      setDialogMode('create')
      void queryClient.invalidateQueries({ queryKey: postQueryKeys.calendars() })
    } else {
      toast.error(result.error ?? 'Erreur lors de la relance')
    }
  }, [editingPost, queryClient])

  // ─── Formatage des dates pour le titre du Dialog ──────────────────────────────

  /**
   * Formate la date sélectionnée (mode création) en libellé français.
   * Exemple : "lundi 15 mars 2026"
   */
  const formattedDate = selectedDate
    ? selectedDate.toLocaleDateString('fr-FR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : ''

  /**
   * Formate la date du post en cours d'édition (mode édition) en libellé français.
   * Priorité : scheduledFor → publishedAt → chaîne vide.
   * Exemple : "lundi 15 mars 2026"
   */
  const formattedEditDate = editingPost
    ? (() => {
        const date = editingPost.scheduledFor ?? editingPost.publishedAt
        if (!date) return ''
        return new Date(date).toLocaleDateString('fr-FR', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })
      })()
    : ''

  // ─── Rendu ───────────────────────────────────────────────────────────────────

  return (
    <>
      {/* ── Toolbar de filtres plateforme + statut + bouton sélection ──────── */}
      {/*
       * Les filtres sont en state local (pas de store Zustand) :
       * ils se réinitialisent à chaque navigation — comportement MVP souhaité.
       * isSelectMode + onToggleSelectMode : bouton "Sélectionner" en fin de toolbar.
       */}
      <div className="mb-4 flex items-center gap-2">
        <CalendarFilters
          selectedPlatforms={selectedPlatforms}
          onPlatformsChange={setSelectedPlatforms}
          selectedStatuses={selectedStatuses}
          onStatusesChange={setSelectedStatuses}
        />
      </div>

      {/* ── Grille calendrier cliquable ──────────────────────────────────── */}
      <CalendarGrid
        interactive={false}
        filterPosts={filterPosts}
        onDayClick={handleDayClick}
        onPostClick={handlePostClick}
      />

      {/* ── Dialog PostComposer (création ou édition) ─────────────────────── */}
      {/*
       * La largeur du Dialog s'adapte dynamiquement selon l'état du panneau IA :
       * - Fermé  → sm:max-w-3xl (largeur standard)
       * - Ouvert → sm:max-w-5xl (place pour le panneau IA latéral de w-80)
       * isAIPanelOpen est synchronisé via le callback onAIPanelChange de PostComposer.
       */}
      <Dialog open={dialogOpen} onOpenChange={handleOpenChange}>
        <DialogContent
          className={cn(
            /* overflow-hidden : c'est le PostComposer interne qui scrolle, pas le Dialog
             * grid-rows-[auto_1fr] : row 1 = DialogHeader (auto), row 2 = PostComposer (1fr)
             * Le bouton × est en absolute dans shadcn → pas besoin d'une 3ème row */
            'max-h-[90vh] overflow-hidden grid-rows-[auto_1fr] transition-all duration-200',
            isAIPanelOpen ? 'sm:max-w-5xl' : 'sm:max-w-3xl',
          )}
        >
          <DialogHeader>
            {/* Titre conditionnel selon le mode et le statut du post */}
            <DialogTitle>
              {dialogMode === 'view'
                ? `Post publié${formattedEditDate ? ` — ${formattedEditDate}` : ''}`
                : dialogMode === 'edit' && editingPost?.status === 'FAILED'
                  ? 'Post échoué'
                  : dialogMode === 'edit'
                    ? `Modifier le post${formattedEditDate ? ` — ${formattedEditDate}` : ''}`
                    : `Nouveau post — ${formattedDate}`}
            </DialogTitle>
            <DialogDescription>
              {dialogMode === 'view'
                ? 'Ce post a déjà été publié. Il ne peut plus être modifié ni replanifié.'
                : dialogMode === 'edit' && editingPost?.status === 'FAILED'
                  ? 'Ce post n\'a pas pu être publié. Consultez l\'erreur ci-dessous.'
                  : dialogMode === 'edit'
                    ? 'Modifiez votre post et sauvegardez.'
                    : 'Composez et planifiez votre post pour cette date.'}
            </DialogDescription>
          </DialogHeader>

          {/* ── Alerte d'échec avec conseil actionnable (posts FAILED uniquement) ── */}
          {dialogMode === 'edit' && editingPost?.status === 'FAILED' && editingPost.failureReason && (
            <FailureAlert
              failureReason={editingPost.failureReason}
              onRetry={handleRetry}
            />
          )}

          {/*
           * PostComposer pré-rempli via le draft store (loadPost).
           * Mode 'create' : scheduledFor défini dans handleDayClick.
           * Mode 'edit'   : tous les champs définis dans handlePostClick via loadPost().
           * Mode 'view'   : même chose qu'édition mais sans PostComposer.Footer
           *                 (lecture seule — le post PUBLISHED ne peut pas être replanifié).
           *
           * onAIPanelChange : synchronise isAIPanelOpen local pour adapter la largeur du Dialog.
           * readOnly=true en mode 'view' : désactive le bouton ✨ et le panneau IA.
           */}
          <PostComposer
            onSuccess={handleSuccess}
            readOnly={dialogMode === 'view'}
            onAIPanelChange={setIsAIPanelOpen}
          >
            <PostComposer.PlatformTabs />
            <PostComposer.ContentTypePicker />
            <PostComposer.ThreadEditor />
            <PostComposer.CarouselEditor />
            <PostComposer.Editor />
            <PostComposer.Platforms />
            <PostComposer.MediaUpload />
            <PostComposer.Schedule />
            {dialogMode !== 'view' && <PostComposer.Footer />}
          </PostComposer>
        </DialogContent>
      </Dialog>
    </>
  )
}
