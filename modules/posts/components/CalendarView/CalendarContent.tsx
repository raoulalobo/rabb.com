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
import { useSearchParams } from 'next/navigation'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { CalendarGrid } from '@/modules/posts/components/CalendarGrid/CalendarGrid'
import { PostComposer } from '@/modules/posts/components/PostComposer'
import { postQueryKeys } from '@/modules/posts/queries/posts.queries'
import { useDraftStore } from '@/modules/posts/store/draft.store'
import type { Post, PostStatus } from '@/modules/posts/types'

import { CalendarFilters } from './CalendarFilters'

// ─── Composant ────────────────────────────────────────────────────────────────

/**
 * Orchestrateur de la page Calendrier.
 * Gère le Dialog PostComposer ouvert depuis la grille calendrier.
 */
export function CalendarContent(): React.JSX.Element {
  // ── Accès au store brouillon pour reset + pré-remplissage ────────────────────
  const { reset, setScheduledFor, loadPost } = useDraftStore()

  // ── Client TanStack Query pour invalider le cache après succès ───────────────
  const queryClient = useQueryClient()

  // ── Lecture des paramètres URL pour le pré-filtrage initial ─────────────────
  // Exemple : /calendar?status=FAILED → pré-sélectionne le filtre FAILED au montage.
  // Utilisé notamment depuis le lien "Voir et corriger" du dashboard.
  const searchParams = useSearchParams()

  /**
   * Extrait et valide le(s) statut(s) passés dans l'URL (?status=FAILED ou ?status=SCHEDULED,...).
   * Seuls les statuts connus (DRAFT, SCHEDULED, PUBLISHED, FAILED) sont acceptés.
   * Exemple : ?status=FAILED → ['FAILED']
   */
  const initialStatuses = useMemo<PostStatus[]>(() => {
    // Valeurs autorisées (correspondant à l'enum Prisma PostStatus)
    const VALID: PostStatus[] = ['DRAFT', 'SCHEDULED', 'PUBLISHED', 'FAILED']
    // Récupère toutes les valeurs du paramètre "status" (peut être répété)
    const raw = searchParams.getAll('status')
    return raw.filter((s): s is PostStatus => VALID.includes(s as PostStatus))
  }, [searchParams])

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
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  /** 'create' = clic sur cellule vide | 'edit' = clic sur un chip de post existant */
  const [dialogMode, setDialogMode] = useState<'create' | 'edit'>('create')
  /** Post en cours d'édition (uniquement en mode 'edit') */
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
   * Charge le post dans le draft store et ouvre le Dialog en mode édition.
   *
   * @param post - Post DB cliqué dans la grille calendrier
   */
  const handlePostClick = useCallback(
    (post: Post): void => {
      // Charger le post dans le store (reset + remplissage des champs)
      loadPost(post)
      setEditingPost(post)
      setDialogMode('edit')
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
    }
  }, [])

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
      {/* ── Toolbar de filtres plateforme + statut ───────────────────────── */}
      {/*
       * Les filtres sont en state local (pas de store Zustand) :
       * ils se réinitialisent à chaque navigation — comportement MVP souhaité.
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
      {/*
       * interactive=false : pas de Popover d'aperçu sur les chips
       * filterPosts       : filtre client-side mémoïsé (plateformes + statuts)
       * onDayClick        : cellules vides → ouvre le Dialog en mode création
       * onPostClick       : chips existants → ouvre le Dialog en mode édition
       */}
      <CalendarGrid
        interactive={false}
        filterPosts={filterPosts}
        onDayClick={handleDayClick}
        onPostClick={handlePostClick}
      />

      {/* ── Dialog PostComposer (création ou édition) ─────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={handleOpenChange}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            {/* Titre conditionnel selon le mode (création ou édition) */}
            <DialogTitle>
              {dialogMode === 'edit'
                ? `Modifier le post${formattedEditDate ? ` — ${formattedEditDate}` : ''}`
                : `Nouveau post — ${formattedDate}`}
            </DialogTitle>
            <DialogDescription>
              {dialogMode === 'edit'
                ? 'Modifiez votre post et sauvegardez.'
                : 'Composez et planifiez votre post pour cette date.'}
            </DialogDescription>
          </DialogHeader>

          {/*
           * PostComposer pré-rempli via le draft store.
           * Mode création : scheduledFor défini dans handleDayClick.
           * Mode édition  : tous les champs définis dans handlePostClick via loadPost().
           * onSuccess : ferme le Dialog + invalide le cache après soumission réussie.
           */}
          <PostComposer onSuccess={handleSuccess}>
            <PostComposer.PlatformTabs />
            <PostComposer.Editor />
            <PostComposer.Platforms />
            <PostComposer.MediaUpload />
            <PostComposer.Schedule />
            <PostComposer.Footer />
          </PostComposer>
        </DialogContent>
      </Dialog>
    </>
  )
}
