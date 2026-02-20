/**
 * @file modules/posts/components/CalendarGrid/CalendarGrid.tsx
 * @module posts
 * @description Grille calendrier mensuelle affichant les posts planifiés.
 *   Affiche une grille 7 colonnes (lun–dim) avec les posts positionnés par date.
 *   Code couleur par statut : DRAFT (gris), SCHEDULED (bleu), PUBLISHED (vert), FAILED (rouge).
 *
 * @example
 *   <CalendarGrid year={2024} month={3} />
 */

'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { useCalendarPosts } from '@/modules/posts/hooks/useCalendarPosts'
import type { Post } from '@/modules/posts/types'

import { CalendarPostChip } from './CalendarPostChip'

// ─── Constantes ───────────────────────────────────────────────────────────────

/** Jours de la semaine affichés dans l'en-tête (lun → dim) */
const WEEK_DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

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
 * @param year - Année
 * @param month - Mois 1-indexé
 * @returns Tableau de dates représentant toutes les cellules de la grille
 */
function buildCalendarDays(year: number, month: number): Date[] {
  const firstDay = new Date(year, month - 1, 1)
  const lastDay = new Date(year, month, 0)

  // Ajustement : lundi = 0 (en JS, dimanche = 0)
  const startOffset = (firstDay.getDay() + 6) % 7 // 0=lundi, 6=dimanche

  const days: Date[] = []

  // Jours du mois précédent pour compléter la première semaine
  for (let i = startOffset - 1; i >= 0; i--) {
    const d = new Date(year, month - 1, -i)
    days.push(d)
  }

  // Jours du mois courant
  for (let d = 1; d <= lastDay.getDate(); d++) {
    days.push(new Date(year, month - 1, d))
  }

  // Jours du mois suivant pour compléter la dernière semaine (grille de 6 semaines max)
  const remaining = 42 - days.length // 6 semaines × 7 jours
  for (let d = 1; d <= remaining; d++) {
    days.push(new Date(year, month, d))
  }

  return days
}

/**
 * Formate une date en clé "YYYY-MM-DD" pour la comparaison avec postsByDate.
 */
function toDateKey(date: Date): string {
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

// ─── Composant ────────────────────────────────────────────────────────────────

interface CalendarGridProps {
  /** Année initiale (défaut: année courante) */
  initialYear?: number
  /** Mois initial 1-indexé (défaut: mois courant) */
  initialMonth?: number
}

/**
 * Grille calendrier mensuelle avec navigation mois précédent/suivant.
 * Charge les posts via useCalendarPosts() et les positionne par date.
 *
 * @param initialYear - Année de départ (défaut: aujourd'hui)
 * @param initialMonth - Mois de départ 1-indexé (défaut: aujourd'hui)
 */
export function CalendarGrid({
  initialYear,
  initialMonth,
}: CalendarGridProps): React.JSX.Element {
  const now = new Date()
  const [year, setYear] = useState(initialYear ?? now.getFullYear())
  const [month, setMonth] = useState(initialMonth ?? now.getMonth() + 1)

  const { postsByDate, isLoading } = useCalendarPosts(year, month)

  // Générer les cellules de la grille
  const days = buildCalendarDays(year, month)
  const today = toDateKey(now)

  /**
   * Navigue vers le mois précédent.
   */
  const goToPrevMonth = (): void => {
    if (month === 1) {
      setMonth(12)
      setYear((y) => y - 1)
    } else {
      setMonth((m) => m - 1)
    }
  }

  /**
   * Navigue vers le mois suivant.
   */
  const goToNextMonth = (): void => {
    if (month === 12) {
      setMonth(1)
      setYear((y) => y + 1)
    } else {
      setMonth((m) => m + 1)
    }
  }

  return (
    <div className="space-y-4">
      {/* ── En-tête : navigation mois ──────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">
          {MONTHS_FR[month - 1]} {year}
        </h2>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            onClick={goToPrevMonth}
            aria-label="Mois précédent"
            className="size-8"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setYear(now.getFullYear())
              setMonth(now.getMonth() + 1)
            }}
            className="h-8 text-xs"
          >
            Aujourd&apos;hui
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={goToNextMonth}
            aria-label="Mois suivant"
            className="size-8"
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      {/* ── Grille calendrier ──────────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        {/* En-tête des jours de la semaine */}
        <div className="grid grid-cols-7 border-b border-border">
          {WEEK_DAYS.map((day) => (
            <div
              key={day}
              className="py-2 text-center text-xs font-medium text-muted-foreground"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Cellules des jours (6 semaines × 7 jours = 42 cellules) */}
        <div className="grid grid-cols-7">
          {days.map((day, index) => {
            const dateKey = toDateKey(day)
            const isCurrentMonth = day.getMonth() === month - 1
            const isToday = dateKey === today
            const posts = postsByDate.get(dateKey) ?? []

            return (
              <CalendarCell
                key={dateKey + index}
                date={day}
                isCurrentMonth={isCurrentMonth}
                isToday={isToday}
                posts={posts}
                isLoading={isLoading}
                // Bordure sur toutes les cellules sauf la dernière ligne
                showBottomBorder={index < days.length - 7}
                // Bordure droite sur toutes les cellules sauf la 7ème colonne
                showRightBorder={(index + 1) % 7 !== 0}
              />
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── Cellule de jour ──────────────────────────────────────────────────────────

interface CalendarCellProps {
  date: Date
  isCurrentMonth: boolean
  isToday: boolean
  posts: Post[]
  isLoading: boolean
  showBottomBorder: boolean
  showRightBorder: boolean
}

/**
 * Cellule individuelle du calendrier représentant un jour.
 * Affiche le numéro du jour et les chips des posts.
 */
function CalendarCell({
  date,
  isCurrentMonth,
  isToday,
  posts,
  isLoading,
  showBottomBorder,
  showRightBorder,
}: CalendarCellProps): React.JSX.Element {
  // Limiter l'affichage à 3 posts par cellule (+ indicateur "+N" si plus)
  const MAX_VISIBLE = 3
  const visiblePosts = posts.slice(0, MAX_VISIBLE)
  const hiddenCount = posts.length - MAX_VISIBLE

  return (
    <div
      className={[
        'min-h-[90px] p-1.5',
        showBottomBorder ? 'border-b border-border' : '',
        showRightBorder ? 'border-r border-border' : '',
        !isCurrentMonth ? 'bg-muted/20' : '',
      ].join(' ')}
    >
      {/* Numéro du jour */}
      <div className="mb-1 flex justify-end">
        <span
          className={[
            'flex size-6 items-center justify-center rounded-full text-xs',
            isToday
              ? 'bg-primary font-semibold text-primary-foreground'
              : isCurrentMonth
                ? 'text-foreground'
                : 'text-muted-foreground/40',
          ].join(' ')}
        >
          {date.getDate()}
        </span>
      </div>

      {/* Posts de la journée */}
      <div className="space-y-0.5">
        {isLoading ? (
          // Skeleton pendant le chargement
          <div className="h-4 w-full animate-pulse rounded bg-muted" />
        ) : (
          <>
            {visiblePosts.map((post) => (
              <CalendarPostChip key={post.id} post={post} />
            ))}
            {/* Indicateur "+N autres" si plus de MAX_VISIBLE posts */}
            {hiddenCount > 0 && (
              <p className="text-[10px] text-muted-foreground pl-1">
                +{hiddenCount} autre{hiddenCount > 1 ? 's' : ''}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  )
}
