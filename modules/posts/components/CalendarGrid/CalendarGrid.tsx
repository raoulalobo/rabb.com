/**
 * @file modules/posts/components/CalendarGrid/CalendarGrid.tsx
 * @module posts
 * @description Grille calendrier (vue mois et vue semaine) affichant les posts planifiés.
 *   Style Buffer/Later : cellules généreuses, numéro en haut gauche, fond today, weekend grisé.
 *
 *   Vues disponibles :
 *   - **Mois** : grille 7×6 classique, cellules 120px desktop
 *   - **Semaine** : 7 grandes cellules (220px desktop) avec scroll interne si > 6 posts
 *
 *   Responsive :
 *   - **Mobile (< 768px)** : grille ultra-compacte (52px/cellule) + points colorés par statut.
 *     Tap sur un jour → Sheet bottom avec liste des posts du jour.
 *   - **Tablette (768px–1023px)** : layout complet conservé, header sur deux lignes si besoin.
 *   - **Desktop (≥ 1024px)** : layout existant inchangé.
 *
 *   Props optionnelles rétrocompatibles (sans elles → comportement identique à l'original) :
 *   - `interactive`   : active le Popover d'aperçu lecture seule sur les chips
 *   - `filterPosts`   : filtre client-side appliqué aux posts de chaque cellule
 *   - `onMonthChange` : notifie le parent du mois affiché (pour invalidation cache externe)
 *   - `onDayClick`    : ouvre le composeur pré-rempli sur la date cliquée
 *   - `onPostClick`   : ouvre le Dialog d'édition sur le post cliqué
 *
 * @example
 *   // Usage basique (/calendar)
 *   <CalendarGrid />
 *
 *   // Usage avancé (/compose, vue calendrier)
 *   <CalendarGrid
 *     initialYear={2025}
 *     initialMonth={2}
 *     interactive
 *     filterPosts={(posts) => posts.filter(p => p.status === 'DRAFT')}
 *     onMonthChange={(year, month) => console.log(year, month)}
 *   />
 */

'use client'

import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { cn } from '@/lib/utils'
import { useCalendarPosts } from '@/modules/posts/hooks/useCalendarPosts'
import type { Post } from '@/modules/posts/types'

import { CalendarPostChip } from './CalendarPostChip'

// ─── Constantes ───────────────────────────────────────────────────────────────

/** Jours de la semaine affichés dans l'en-tête — desktop (lun → dim) */
const WEEK_DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

/** Abréviations ultra-courtes pour mobile */
const WEEK_DAYS_SHORT = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

/** Noms des mois en français */
const MONTHS_FR = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Génère les cellules du calendrier pour un mois donné.
 * Inclut les jours du mois précédent/suivant pour compléter les semaines.
 *
 * @param year  - Année
 * @param month - Mois 1-indexé
 * @returns Tableau de dates représentant toutes les cellules de la grille (42 max)
 */
function buildCalendarDays(year: number, month: number): Date[] {
  const firstDay = new Date(year, month - 1, 1)
  const lastDay = new Date(year, month, 0)

  // Ajustement : lundi = 0 (en JS, dimanche = 0)
  const startOffset = (firstDay.getDay() + 6) % 7

  const days: Date[] = []

  // Jours du mois précédent pour compléter la première semaine
  for (let i = startOffset - 1; i >= 0; i--) {
    days.push(new Date(year, month - 1, -i))
  }

  // Jours du mois courant
  for (let d = 1; d <= lastDay.getDate(); d++) {
    days.push(new Date(year, month - 1, d))
  }

  // Jours du mois suivant pour compléter la dernière semaine (max 42 cellules)
  const remaining = 42 - days.length
  for (let d = 1; d <= remaining; d++) {
    days.push(new Date(year, month, d))
  }

  return days
}

/**
 * Retourne le lundi de la semaine contenant `date`.
 *
 * @param date - N'importe quel jour de la semaine
 * @returns Date du lundi correspondant (heure remise à 0)
 */
function getWeekStart(date: Date): Date {
  const day = (date.getDay() + 6) % 7 // 0=lundi … 6=dimanche
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() - day)
}

/**
 * Génère les 7 jours d'une semaine à partir du lundi `weekStart`.
 *
 * @param weekStart - Lundi de la semaine
 * @returns Tableau de 7 Date (lun→dim)
 */
function buildWeekDays(weekStart: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) =>
    new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + i),
  )
}

/**
 * Formate le titre de navigation en vue semaine.
 * Même mois   → "3 – 9 mars 2026"
 * Mois diff.  → "28 mars – 3 avril 2026"
 *
 * @param start - Premier jour de la semaine (lundi)
 * @param end   - Dernier jour de la semaine (dimanche)
 * @returns Titre localisé fr-FR
 */
function formatWeekTitle(start: Date, end: Date): string {
  const fmt = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long' })
  const fmtYear = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })

  if (
    start.getMonth() === end.getMonth() &&
    start.getFullYear() === end.getFullYear()
  ) {
    // "3 – 9 mars 2026"
    return `${start.getDate()} – ${fmtYear.format(end)}`
  }

  // "28 mars – 3 avril 2026"
  if (start.getFullYear() === end.getFullYear()) {
    return `${fmt.format(start)} – ${fmtYear.format(end)}`
  }

  // Années différentes (rare) : "28 déc. 2025 – 3 janv. 2026"
  return `${fmtYear.format(start)} – ${fmtYear.format(end)}`
}

/**
 * Formate une date en clé "YYYY-MM-DD" pour la comparaison avec postsByDate.
 *
 * @param date - Date à formater
 */
function toDateKey(date: Date): string {
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

// ─── Types ────────────────────────────────────────────────────────────────────

/** Vue active du calendrier */
type CalendarView = 'month' | 'week'

// ─── Props ────────────────────────────────────────────────────────────────────

interface CalendarGridProps {
  /** Année initiale (défaut: année courante) */
  initialYear?: number
  /** Mois initial 1-indexé (défaut: mois courant) */
  initialMonth?: number
  /**
   * Si true : active le Popover d'aperçu lecture seule sur les chips.
   * Default: false → chips non interactifs (comportement actuel /calendar/).
   */
  interactive?: boolean
  /**
   * Filtre appliqué aux posts de chaque cellule avant rendu.
   * Absent → tout afficher.
   *
   * @example
   *   filterPosts={(posts) => posts.filter(p => p.status === 'SCHEDULED')}
   */
  filterPosts?: (posts: Post[]) => Post[]
  /**
   * Callback appelé à chaque changement de mois/semaine visible.
   * Permet au parent d'invalider son cache ou de mettre à jour son état.
   *
   * @param year  - Nouvelle année affichée
   * @param month - Nouveau mois affiché (1-indexé)
   */
  onMonthChange?: (year: number, month: number) => void
  /**
   * Callback déclenché lors d'un clic sur une cellule de jour.
   * Si fourni, les cellules deviennent cliquables.
   *
   * @param date - Date du jour cliqué
   *
   * @example
   *   onDayClick={(date) => openComposerDialog(date)}
   */
  onDayClick?: (date: Date) => void
  /**
   * Callback déclenché au clic sur un chip de post existant.
   * Si fourni : les chips deviennent des boutons cliquables (mode édition /calendar/).
   * Ne s'applique que quand `interactive=false` — le Popover prend la priorité sinon.
   *
   * @param post - Post cliqué dans la grille
   *
   * @example
   *   onPostClick={(post) => openEditDialog(post)}
   */
  onPostClick?: (post: Post) => void
  /**
   * Si true : active le mode sélection multiple.
   * Les chips affichent une checkbox, les cellules vides ne créent plus de post.
   * Default: false → comportement normal.
   */
  isSelectMode?: boolean
  /**
   * Set des IDs de posts actuellement sélectionnés.
   * Propagé à chaque chip pour afficher l'état coché/décoché.
   */
  selectedIds?: Set<string>
  /**
   * Callback déclenché quand l'utilisateur clique sur un chip en mode sélection.
   *
   * @param postId - ID du post à basculer dans la sélection
   */
  onToggleSelect?: (postId: string) => void
}

// ─── Composant principal ───────────────────────────────────────────────────────

/**
 * Grille calendrier avec vues Mois et Semaine.
 * Style Buffer/Later : cellules généreuses, numéro en haut à gauche,
 * fond today `bg-primary/5`, weekend légèrement grisé.
 *
 * En vue semaine à cheval sur 2 mois, TanStack Query est appelé deux fois
 * mais déduplique automatiquement les requêtes identiques.
 *
 * @param initialYear   - Année de départ (défaut: aujourd'hui)
 * @param initialMonth  - Mois de départ 1-indexé (défaut: aujourd'hui)
 * @param interactive   - Active le popover d'aperçu sur les chips (défaut: false)
 * @param filterPosts   - Filtre client-side appliqué par cellule (défaut: aucun)
 * @param onMonthChange - Callback après chaque changement de période
 * @param onDayClick    - Callback clic sur une cellule de jour
 */
export function CalendarGrid({
  initialYear,
  initialMonth,
  interactive = false,
  filterPosts,
  onMonthChange,
  onDayClick,
  onPostClick,
  isSelectMode = false,
  selectedIds,
  onToggleSelect,
}: CalendarGridProps): React.JSX.Element {
  const now = new Date()

  // ── Détection mobile (< 768px) ─────────────────────────────────────────────
  // SSR-safe : retourne false jusqu'au premier mount côté client
  const isMobile = useMediaQuery('(max-width: 767px)')

  // ── État du Sheet mobile (jour sélectionné au tap) ─────────────────────────
  /** Jour sélectionné sur mobile — null = Sheet fermé */
  const [mobileSelectedDay, setMobileSelectedDay] = useState<Date | null>(null)

  // ── État navigation ────────────────────────────────────────────────────────
  const [year, setYear] = useState(initialYear ?? now.getFullYear())
  const [month, setMonth] = useState(initialMonth ?? now.getMonth() + 1)
  const [view, setView] = useState<CalendarView>('month')

  /** Lundi de la semaine affichée (vue semaine uniquement) */
  const [weekStart, setWeekStart] = useState<Date>(() => getWeekStart(now))

  // ── Clé du jour courant ────────────────────────────────────────────────────
  const today = toDateKey(now)

  // ── Chargement des posts ───────────────────────────────────────────────────

  /**
   * Détecte si la semaine visible est à cheval sur 2 mois.
   * Dans ce cas, on a besoin de deux requêtes pour couvrir les deux mois.
   */
  const weekDaysPreview = buildWeekDays(weekStart)
  const weekEnd = weekDaysPreview[6]
  const needsTwoMonths =
    view === 'week' &&
    (weekEnd.getMonth() !== weekStart.getMonth() ||
      weekEnd.getFullYear() !== weekStart.getFullYear())

  // Mois principal
  const { postsByDate: data1, isLoading: l1 } = useCalendarPosts(year, month)

  // Mois suivant (uniquement si semaine à cheval)
  const nextMonth = month === 12 ? 1 : month + 1
  const nextYear = month === 12 ? year + 1 : year
  const { postsByDate: data2, isLoading: l2 } = useCalendarPosts(
    needsTwoMonths ? nextYear : year,
    needsTwoMonths ? nextMonth : month,
  )

  // Fusion des maps — TanStack Query déduplique les requêtes identiques
  const postsByDate = needsTwoMonths ? new Map([...data1, ...data2]) : data1
  const isLoading = l1 || (needsTwoMonths && l2)

  // ── Posts du jour sélectionné (Sheet mobile) ───────────────────────────────
  /**
   * Liste de posts pour le jour tapoté sur mobile — utilisée par le Sheet.
   * On applique filterPosts ici pour que les filtres actifs (plateforme, statut)
   * soient respectés dans le Sheet, comme dans les cellules du calendrier.
   */
  const mobileSelectedPosts: Post[] = useMemo(() => {
    const raw = mobileSelectedDay
      ? (postsByDate.get(toDateKey(mobileSelectedDay)) ?? [])
      : []
    return filterPosts ? filterPosts(raw) : raw
  }, [mobileSelectedDay, postsByDate, filterPosts])

  // ── Calcul des jours ───────────────────────────────────────────────────────

  /** Jours affichés : 42 en vue mois, 7 en vue semaine */
  const days = useMemo(
    () => (view === 'month' ? buildCalendarDays(year, month) : buildWeekDays(weekStart)),
    [view, year, month, weekStart],
  )

  // ── Titre du header ────────────────────────────────────────────────────────

  const headerTitle =
    view === 'month'
      ? `${MONTHS_FR[month - 1]} ${year}`
      : formatWeekTitle(weekStart, weekEnd)

  // ── Synchronisation year/month sur le mercredi de la semaine ──────────────

  /**
   * Met à jour year/month en se basant sur le mercredi de la semaine.
   * Cela évite les sauts de mois indésirables quand la semaine est à cheval.
   *
   * @param start - Lundi de la semaine
   */
  function syncYearMonthToWeek(start: Date): void {
    const wednesday = new Date(start)
    wednesday.setDate(start.getDate() + 3)
    const newYear = wednesday.getFullYear()
    const newMonth = wednesday.getMonth() + 1
    setYear(newYear)
    setMonth(newMonth)
    onMonthChange?.(newYear, newMonth)
  }

  // ── Navigation mois ────────────────────────────────────────────────────────

  /** Navigue vers le mois précédent. */
  function goToPrevMonth(): void {
    const newMonth = month === 1 ? 12 : month - 1
    const newYear = month === 1 ? year - 1 : year
    setMonth(newMonth)
    setYear(newYear)
    onMonthChange?.(newYear, newMonth)
  }

  /** Navigue vers le mois suivant. */
  function goToNextMonth(): void {
    const newMonth = month === 12 ? 1 : month + 1
    const newYear = month === 12 ? year + 1 : year
    setMonth(newMonth)
    setYear(newYear)
    onMonthChange?.(newYear, newMonth)
  }

  // ── Navigation semaine ─────────────────────────────────────────────────────

  /** Navigue vers la semaine précédente. */
  function goToPrevWeek(): void {
    const newStart = new Date(weekStart)
    newStart.setDate(weekStart.getDate() - 7)
    setWeekStart(newStart)
    syncYearMonthToWeek(newStart)
  }

  /** Navigue vers la semaine suivante. */
  function goToNextWeek(): void {
    const newStart = new Date(weekStart)
    newStart.setDate(weekStart.getDate() + 7)
    setWeekStart(newStart)
    syncYearMonthToWeek(newStart)
  }

  // ── Aujourd'hui ────────────────────────────────────────────────────────────

  /** Revient à la période courante (adapté à la vue active). */
  function goToToday(): void {
    if (view === 'month') {
      const todayYear = now.getFullYear()
      const todayMonth = now.getMonth() + 1
      setYear(todayYear)
      setMonth(todayMonth)
      onMonthChange?.(todayYear, todayMonth)
    } else {
      const todayWeekStart = getWeekStart(now)
      setWeekStart(todayWeekStart)
      setYear(now.getFullYear())
      setMonth(now.getMonth() + 1)
      onMonthChange?.(now.getFullYear(), now.getMonth() + 1)
    }
  }

  // ── Changement de vue ──────────────────────────────────────────────────────

  /**
   * Bascule entre les vues Mois et Semaine.
   * - Mois → Semaine : initialise sur la semaine du 15 du mois courant
   * - Semaine → Mois : affiche le mois du lundi de la semaine courante
   *
   * @param newView - Vue cible
   */
  function handleViewChange(newView: CalendarView): void {
    if (newView === view) return

    if (newView === 'week') {
      // Initialiser sur la semaine du 15 du mois courant (milieu de mois)
      const midMonth = new Date(year, month - 1, 15)
      const newWeekStart = getWeekStart(midMonth)
      setWeekStart(newWeekStart)
      setView('week')
    } else {
      // Revenir au mois du lundi de la semaine courante
      setMonth(weekStart.getMonth() + 1)
      setYear(weekStart.getFullYear())
      onMonthChange?.(weekStart.getFullYear(), weekStart.getMonth() + 1)
      setView('month')
    }
  }

  // ── Handlers navigation unifiés ────────────────────────────────────────────

  const goToPrev = view === 'month' ? goToPrevMonth : goToPrevWeek
  const goToNext = view === 'month' ? goToNextMonth : goToNextWeek
  const prevLabel = view === 'month' ? 'Mois précédent' : 'Semaine précédente'
  const nextLabel = view === 'month' ? 'Mois suivant' : 'Semaine suivante'

  // ── Rendu ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* ── En-tête : empilé sur mobile, horizontal sur ≥ sm ──────────────── */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">

        {/* Titre du mois ou de la semaine */}
        <h2 className="flex-1 text-base font-semibold sm:text-lg">{headerTitle}</h2>

        {/* Contrôles : toggle + navigation */}
        <div className="flex items-center justify-between gap-2 sm:justify-normal sm:gap-3">

          {/* Toggle Mois / Semaine — masqué sur mobile (toujours vue mois compacte) */}
          <div className="hidden sm:flex rounded-lg border bg-muted p-0.5">
            {(['month', 'week'] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => handleViewChange(v)}
                className={cn(
                  'rounded-md px-3 py-1 text-xs font-medium transition-all',
                  view === v
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {v === 'month' ? 'Mois' : 'Semaine'}
              </button>
            ))}
          </div>

          {/* Navigation ← Aujourd'hui → — taille réduite sur mobile */}
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              onClick={goToPrev}
              aria-label={prevLabel}
              className="size-7 sm:size-8"
            >
              <ChevronLeft className="size-3.5 sm:size-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={goToToday}
              className="h-7 px-2 text-xs sm:h-8 sm:px-3"
            >
              Aujourd&apos;hui
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={goToNext}
              aria-label={nextLabel}
              className="size-7 sm:size-8"
            >
              <ChevronRight className="size-3.5 sm:size-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* ── Grille calendrier ──────────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        {/* En-tête des jours de la semaine */}
        <div className="grid grid-cols-7 border-b border-border">
          {WEEK_DAYS.map((day, i) => (
            <div
              key={day + i}
              className={cn(
                'py-2.5 text-center text-xs font-semibold uppercase tracking-wide',
                // Weekend (sam=5, dim=6) légèrement atténué
                i >= 5 ? 'text-muted-foreground/50' : 'text-muted-foreground',
              )}
            >
              {/* Version mobile : lettre unique ; desktop : abréviation 3 lettres */}
              <span className="md:hidden">{WEEK_DAYS_SHORT[i]}</span>
              <span className="hidden md:inline">{day}</span>
            </div>
          ))}
        </div>

        {/* Cellules des jours */}
        <div className="grid grid-cols-7">
          {days.map((day, index) => {
            const dateKey = toDateKey(day)
            const posts = postsByDate.get(dateKey) ?? []

            // En vue semaine, toutes les cellules sont "dans le mois courant"
            const isCurrentMonth =
              view === 'week' ? true : day.getMonth() === month - 1

            return (
              <CalendarCell
                key={dateKey + index}
                date={day}
                isCurrentMonth={isCurrentMonth}
                isToday={dateKey === today}
                // Weekend : index dans la semaine (0=lun … 6=dim)
                isWeekend={index % 7 >= 5}
                posts={posts}
                isLoading={isLoading}
                interactive={interactive}
                filterPosts={filterPosts}
                onDayClick={onDayClick}
                onPostClick={onPostClick}
                view={view}
                // Bordure basse : toutes les cellules sauf la dernière ligne
                showBottomBorder={index < days.length - 7}
                // Bordure droite : toutes les cellules sauf la 7ème colonne
                showRightBorder={(index + 1) % 7 !== 0}
                // Props mobile : tap sur la cellule → ouvre le Sheet
                isMobile={isMobile}
                onMobileSelect={setMobileSelectedDay}
                // Props mode sélection multiple
                isSelectMode={isSelectMode}
                selectedIds={selectedIds}
                onToggleSelect={onToggleSelect}
              />
            )
          })}
        </div>
      </div>

      {/* ─── Sheet mobile : détail des posts d'un jour ──────────────────────── */}
      {/*
       * S'ouvre au tap sur une cellule de jour (mode mobile uniquement).
       * Affiche la liste des posts du jour sélectionné + bouton "Nouveau post".
       * onOpenChange(false) → ferme le Sheet sans effet de bord.
       */}
      <Sheet
        open={isMobile && mobileSelectedDay !== null}
        onOpenChange={(open) => { if (!open) setMobileSelectedDay(null) }}
      >
        <SheetContent
          side="bottom"
          className="max-h-[80vh] overflow-y-auto rounded-t-2xl px-4 pb-8"
        >
          <SheetHeader className="mb-4">
            <SheetTitle className="text-base">
              {mobileSelectedDay
                ? format(mobileSelectedDay, 'EEEE d MMMM yyyy', { locale: fr })
                : ''}
            </SheetTitle>
          </SheetHeader>

          {/* Liste des posts du jour ou message vide */}
          {mobileSelectedPosts.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Aucun post ce jour
            </p>
          ) : (
            <div className="space-y-2">
              {mobileSelectedPosts.map((post) => (
                <CalendarPostChip
                  key={post.id}
                  post={post}
                  // onEdit : ferme le Sheet puis ouvre le Dialog.
                  // CalendarContent détermine le mode (edit vs view) selon le statut.
                  onEdit={() => {
                    setMobileSelectedDay(null)
                    onPostClick?.(post)
                  }}
                  // Mode sélection multiple propagé au Sheet mobile
                  isSelectMode={isSelectMode}
                  isSelected={selectedIds?.has(post.id) ?? false}
                  onToggleSelect={onToggleSelect}
                />
              ))}
            </div>
          )}

          {/* Bouton "Nouveau post ce jour" — réutilise onDayClick du parent.
              Ferme le Sheet puis déclenche l'ouverture du Dialog composeur
              avec la date pré-remplie (comportement identique au clic desktop). */}
          {onDayClick && mobileSelectedDay && (
            <Button
              className="mt-6 w-full"
              onClick={() => {
                const day = mobileSelectedDay
                setMobileSelectedDay(null)
                onDayClick(day)
              }}
            >
              <Plus className="mr-2 size-4" />
              Nouveau post ce jour
            </Button>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}

// ─── Cellule de jour ──────────────────────────────────────────────────────────

interface CalendarCellProps {
  date: Date
  isCurrentMonth: boolean
  isToday: boolean
  /** true si le jour est samedi (col 6) ou dimanche (col 7) */
  isWeekend: boolean
  posts: Post[]
  isLoading: boolean
  showBottomBorder: boolean
  showRightBorder: boolean
  /** Active le Popover d'aperçu sur les chips (propagé depuis CalendarGrid) */
  interactive: boolean
  /** Vue active — détermine les dimensions et MAX_VISIBLE */
  view: CalendarView
  /** Filtre optionnel propagé depuis CalendarGrid.filterPosts */
  filterPosts?: (posts: Post[]) => Post[]
  /**
   * Propagé depuis CalendarGrid.onDayClick.
   * Si fourni, la cellule devient cliquable.
   */
  onDayClick?: (date: Date) => void
  /**
   * Propagé depuis CalendarGrid.onPostClick.
   * Si fourni, chaque chip de post devient un bouton d'édition.
   */
  onPostClick?: (post: Post) => void
  /**
   * Mode mobile actif (viewport < 768px).
   * Active le rendu compact (date + points) au lieu des chips complets.
   */
  isMobile?: boolean
  /**
   * Callback déclenché au tap sur une cellule en mode mobile.
   * Ouvre le Sheet "Détail du jour" dans CalendarGrid.
   *
   * @param date - Jour tapoté
   */
  onMobileSelect?: (date: Date) => void
  /** Propagé depuis CalendarGrid : active le mode sélection multiple */
  isSelectMode?: boolean
  /** Propagé depuis CalendarGrid : Set des IDs sélectionnés */
  selectedIds?: Set<string>
  /** Propagé depuis CalendarGrid : callback de bascule de sélection */
  onToggleSelect?: (postId: string) => void
}

/**
 * Cellule individuelle du calendrier représentant un jour.
 *
 * Affiche :
 * - Numéro du jour en haut à gauche (cercle primary si today)
 * - Bouton "+" en haut à droite (visible au hover, déclenche onDayClick)
 * - Posts (limités à MAX_VISIBLE) + badge "+N autres" si dépassement
 *
 * En vue semaine, la zone de posts est scrollable si > 6 posts.
 */
function CalendarCell({
  date,
  isCurrentMonth,
  isToday,
  isWeekend,
  posts,
  isLoading,
  showBottomBorder,
  showRightBorder,
  interactive,
  view,
  filterPosts,
  onDayClick,
  onPostClick,
  isMobile = false,
  onMobileSelect,
  isSelectMode = false,
  selectedIds,
  onToggleSelect,
}: CalendarCellProps): React.JSX.Element {
  // Nombre de posts visibles : plus généreux en vue semaine
  const MAX_VISIBLE = view === 'week' ? 6 : 3

  // Application du filtre client-side (mode /compose) avant slicing
  const effectivePosts = filterPosts ? filterPosts(posts) : posts
  const visiblePosts = effectivePosts.slice(0, MAX_VISIBLE)
  const hiddenCount = effectivePosts.length - MAX_VISIBLE

  // En mode sélection, bloquer la création de posts (clic sur cellule vide)
  const isClickable = Boolean(onDayClick) && !isSelectMode

  /**
   * Couleur de fond de la cellule (priorité décroissante) :
   * 1. Aujourd'hui   → bg-primary/5 (teinte légère de la couleur primaire)
   * 2. Weekend       → bg-muted/30 (gris très léger)
   * 3. Autres jours  → transparent (fond neutre)
   */
  const cellBg = isToday ? 'bg-primary/5' : isWeekend ? 'bg-muted/30' : ''

  /** Classes de bordures communes aux deux versions (mobile et desktop) */
  const borderClasses = cn(
    showBottomBorder && 'border-b border-border',
    showRightBorder && 'border-r border-border',
  )

  // ── Compteurs par statut (partagés par les deux modes de rendu) ─────────────
  const failedCount    = effectivePosts.filter((p) => p.status === 'FAILED').length
  const scheduledCount = effectivePosts.filter((p) => p.status === 'SCHEDULED').length
  const publishedCount = effectivePosts.filter((p) => p.status === 'PUBLISHED').length
  const draftCount     = effectivePosts.filter((p) => p.status === 'DRAFT').length

  // ═══════════════════════════════════════════════════════════════════════════
  // VERSION MOBILE (< md) : ultra-compact — date + points colorés par statut
  // Tap sur la cellule → ouvre le Sheet dans CalendarGrid
  // ═══════════════════════════════════════════════════════════════════════════
  const mobileCell = (
    <div
      className={cn(
        'md:hidden flex min-h-[52px] cursor-pointer flex-col items-center justify-start gap-1 p-1',
        borderClasses,
        cellBg,
        'transition-colors active:bg-accent/50',
      )}
      role="button"
      aria-label={`Voir les posts du ${date.toLocaleDateString('fr-FR')}`}
      onClick={() => onMobileSelect?.(date)}
    >
      {/* Numéro du jour — cercle primary si aujourd'hui */}
      <span
        className={cn(
          'flex size-5 items-center justify-center rounded-full text-[11px] font-medium',
          isToday
            ? 'bg-primary font-semibold text-primary-foreground'
            : 'text-foreground',
          !isCurrentMonth && 'text-muted-foreground/40',
        )}
      >
        {date.getDate()}
      </span>

      {/* Points colorés : un point par statut présent (peu importe la quantité) */}
      {effectivePosts.length > 0 && (
        <div className="flex flex-wrap justify-center gap-[3px]">
          {/* FAILED → rouge */}
          {failedCount    > 0 && <span className="size-1.5 rounded-full bg-red-500" />}
          {/* SCHEDULED → bleu */}
          {scheduledCount > 0 && <span className="size-1.5 rounded-full bg-blue-500" />}
          {/* PUBLISHED → vert */}
          {publishedCount > 0 && <span className="size-1.5 rounded-full bg-green-500" />}
          {/* DRAFT → gris */}
          {draftCount     > 0 && <span className="size-1.5 rounded-full bg-gray-400" />}
        </div>
      )}
    </div>
  )

  // ═══════════════════════════════════════════════════════════════════════════
  // VERSION DESKTOP (≥ md) : layout complet avec chips détaillés
  // ═══════════════════════════════════════════════════════════════════════════

  /** Dimensions de la cellule desktop selon la vue */
  const cellDimensions =
    view === 'week'
      ? 'min-h-[180px] md:min-h-[220px] p-1.5 md:p-2'
      : 'min-h-[100px] md:min-h-[120px] p-1.5 md:p-2'

  const desktopCell = (
    /**
     * `group` active le groupe CSS pour afficher le bouton "+" au hover
     * via la classe `group-hover:flex` sur l'enfant.
     */
    <div
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      aria-label={
        isClickable ? `Créer un post le ${date.toLocaleDateString('fr-FR')}` : undefined
      }
      onClick={isClickable ? () => onDayClick!(date) : undefined}
      onKeyDown={
        isClickable
          ? (e) => {
              // Accessibilité clavier : Entrée ou Espace déclenchent le clic
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onDayClick!(date)
              }
            }
          : undefined
      }
      className={cn(
        'group hidden md:block', // Masqué sur mobile, visible ≥ md
        cellDimensions,
        cellBg,
        borderClasses,
        isClickable &&
          'cursor-pointer transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
      )}
    >
      {/* Wrapper opacité : jours hors mois visible à 40% en vue mois */}
      <div className={cn('flex h-full flex-col', !isCurrentMonth && 'opacity-40')}>

        {/* ── En-tête cellule : numéro gauche + bouton "+" droite ──────── */}
        <div className="mb-1 flex items-center justify-between">
          {/* Groupe gauche : numéro du jour + badges de statuts */}
          <div className="flex items-center gap-1">
            {/* Numéro du jour — cercle coloré si aujourd'hui */}
            <span
              className={cn(
                'flex size-6 items-center justify-center rounded-full text-xs',
                isToday
                  ? 'bg-primary font-semibold text-primary-foreground'
                  : 'text-foreground',
              )}
            >
              {date.getDate()}
            </span>

            {/* ── Badges multi-statuts ─────────────────────────────────────── */}
            {/*
             * Un badge par statut présent dans la cellule (après filtrage).
             * Couleurs : FAILED=rouge · SCHEDULED=bleu · PUBLISHED=vert · DRAFT=gris
             * Ordre d'affichage : FAILED → SCHEDULED → PUBLISHED → DRAFT
             */}
            {effectivePosts.length > 0 && (
              <div className="flex items-center gap-0.5">
                {failedCount > 0 && (
                  <span
                    title={`${failedCount} post${failedCount > 1 ? 's' : ''} échoué${failedCount > 1 ? 's' : ''}`}
                    className="flex min-w-[14px] items-center justify-center rounded-full px-1 text-[9px] font-medium leading-tight bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400"
                  >
                    {failedCount}
                  </span>
                )}
                {scheduledCount > 0 && (
                  <span
                    title={`${scheduledCount} post${scheduledCount > 1 ? 's' : ''} planifié${scheduledCount > 1 ? 's' : ''}`}
                    className="flex min-w-[14px] items-center justify-center rounded-full px-1 text-[9px] font-medium leading-tight bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400"
                  >
                    {scheduledCount}
                  </span>
                )}
                {publishedCount > 0 && (
                  <span
                    title={`${publishedCount} post${publishedCount > 1 ? 's' : ''} publié${publishedCount > 1 ? 's' : ''}`}
                    className="flex min-w-[14px] items-center justify-center rounded-full px-1 text-[9px] font-medium leading-tight bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400"
                  >
                    {publishedCount}
                  </span>
                )}
                {draftCount > 0 && (
                  <span
                    title={`${draftCount} brouillon${draftCount > 1 ? 's' : ''}`}
                    className="flex min-w-[14px] items-center justify-center rounded-full px-1 text-[9px] font-medium leading-tight bg-muted text-muted-foreground"
                  >
                    {draftCount}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Bouton "+" — visible uniquement au hover de la cellule */}
          {isClickable && (
            <button
              type="button"
              onClick={(e) => {
                // Stopper la propagation pour éviter le double déclenchement
                // (le onClick de la cellule parent ferait aussi la même action)
                e.stopPropagation()
                onDayClick!(date)
              }}
              className="hidden size-5 items-center justify-center rounded text-muted-foreground hover:bg-accent group-hover:flex"
              aria-label={`Ajouter un post le ${date.toLocaleDateString('fr-FR')}`}
            >
              <Plus className="size-3" />
            </button>
          )}
        </div>

        {/* ── Zone de posts ─────────────────────────────────────────────── */}
        <div
          className={cn(
            'space-y-0.5',
            // En vue semaine : scroll vertical si beaucoup de posts
            view === 'week' && 'max-h-[160px] overflow-y-auto md:max-h-[185px]',
          )}
        >
          {isLoading ? (
            // Skeleton de chargement : une barre pleine largeur
            <div className="h-4 w-full animate-pulse rounded bg-muted" />
          ) : (
            <>
              {visiblePosts.map((post) => (
                <CalendarPostChip
                  key={post.id}
                  post={post}
                  interactive={interactive}
                  // onEdit propagé depuis CalendarGrid.onPostClick :
                  // active le mode bouton d'édition quand interactive=false
                  onEdit={onPostClick}
                  // Props mode sélection multiple
                  isSelectMode={isSelectMode}
                  isSelected={selectedIds?.has(post.id) ?? false}
                  onToggleSelect={onToggleSelect}
                />
              ))}

              {/* Indicateur "+N autres" quand MAX_VISIBLE est dépassé */}
              {hiddenCount > 0 && (
                <p className="pl-1 text-[10px] text-muted-foreground">
                  +{hiddenCount} autre{hiddenCount > 1 ? 's' : ''}
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )

  // On rend les deux versions dans un fragment :
  // - mobileCell  : visible sur mobile (< md), caché sur md+
  // - desktopCell : caché sur mobile, visible sur md+ (géré avec hidden md:block)
  return (
    <>
      {mobileCell}
      {desktopCell}
    </>
  )
}
