/**
 * @file modules/posts/components/PostComposeList/WeekCoverageStrip.tsx
 * @module posts
 * @description Bande de couverture hebdomadaire : affiche les 7 prochains jours
 *   sous forme de pills et met en évidence les jours sans post planifié (trous).
 *
 *   - Jour couvert (≥1 post SCHEDULED) : pill verte avec compteur
 *   - Jour vide (0 post SCHEDULED)     : pill pointillée cliquable → ouvre AgentModal
 *   - Jour actuel                       : date en gras
 *   - Weekends                          : légèrement atténués
 *   - Non rendu si les 7 jours sont tous couverts (aucun trou)
 *   - Non rendu si des filtres sont actifs (la liste ne reflète plus la réalité globale)
 *
 * Interaction :
 *   Cliquer sur un jour vide déclenche `onCreateForDay(date)` → ouvre l'AgentModal
 *   en mode création. L'utilisateur peut ensuite planifier via le popover inline.
 *
 * @example
 *   <WeekCoverageStrip
 *     posts={allPosts}
 *     onCreateForDay={(day) => handleOpenCreate()}
 *   />
 */

'use client'

import { Plus } from 'lucide-react'

import type { Post } from '@/modules/posts/types'

// ─── Props ────────────────────────────────────────────────────────────────────

interface WeekCoverageStripProps {
  /** Posts chargés dans la liste (utilisés pour calculer la couverture par jour) */
  posts: Post[]
  /**
   * Callback déclenché quand l'utilisateur clique sur un jour vide.
   * Reçoit la date du jour sélectionné (pour pré-remplissage futur).
   * Actuellement : ouvre simplement l'AgentModal en mode création.
   *
   * @param day - Date du jour sans post cliqué
   */
  onCreateForDay: (day: Date) => void
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Noms courts des jours de la semaine en français */
const SHORT_WEEKDAY = ['dim', 'lun', 'mar', 'mer', 'jeu', 'ven', 'sam']

/** Noms courts des mois en français pour le label de date */
const SHORT_MONTH = ['jan', 'fév', 'mar', 'avr', 'mai', 'jun', 'jul', 'aoû', 'sep', 'oct', 'nov', 'déc']

/**
 * Retourne la clé de jour "YYYY-MM-DD" (locale) pour comparer deux dates
 * indépendamment du fuseau horaire.
 *
 * @param date - Date à normaliser
 * @returns Clé string unique pour le jour
 *
 * @example
 *   dayKey(new Date('2026-02-25T09:00:00Z')) // → "2026-2-25"
 */
function dayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
}

// ─── Composant ────────────────────────────────────────────────────────────────

/**
 * Bande de couverture des 7 prochains jours.
 * Non rendue si tous les jours sont couverts ou si des filtres sont actifs.
 *
 * @param posts          - Posts chargés (source de vérité pour la couverture)
 * @param onCreateForDay - Callback pour ouvrir le composer sur un jour vide
 */
export function WeekCoverageStrip({
  posts,
  onCreateForDay,
}: WeekCoverageStripProps): React.JSX.Element | null {
  const now = new Date()
  // Minuit local du jour courant (référence pour les comparaisons de jours)
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  // ── 7 jours à partir d'aujourd'hui ─────────────────────────────────────────
  const days: Date[] = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(todayStart)
    d.setDate(todayStart.getDate() + i)
    return d
  })

  // ── Comptage des posts SCHEDULED par jour ───────────────────────────────────
  // Map dayKey → nombre de posts SCHEDULED tombant ce jour-là.
  // On ignore DRAFT, PUBLISHED, FAILED : seuls les planifiés comptent pour la couverture.
  const countByDay = new Map<string, number>()
  for (const post of posts) {
    if (post.status === 'SCHEDULED' && post.scheduledFor) {
      const k = dayKey(new Date(post.scheduledFor))
      countByDay.set(k, (countByDay.get(k) ?? 0) + 1)
    }
  }

  // ── Guard : ne rien rendre si aucun trou sur les 7 jours ───────────────────
  const hasGap = days.some((d) => !countByDay.has(dayKey(d)))
  if (!hasGap) return null

  const todayKey = dayKey(todayStart)

  return (
    <div className="rounded-xl border border-border bg-card px-3 py-2.5">
      {/* ── En-tête ──────────────────────────────────────────────────────── */}
      <p className="mb-2 text-xs font-medium text-muted-foreground">
        Prochains 7 jours
      </p>

      {/* ── Rangée de pills ──────────────────────────────────────────────── */}
      {/*
       * overflow-x-auto : scroll horizontal sur mobile pour éviter le line-wrap.
       * pb-1 : espace pour la scrollbar sur certains OS.
       */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {days.map((day) => {
          const k = dayKey(day)
          const count = countByDay.get(k) ?? 0
          const isCovered = count > 0
          const isToday = k === todayKey
          const isWeekend = day.getDay() === 0 || day.getDay() === 6

          // Label : "lun 24 fév" (aujourd'hui) ou "lun 24" (autres jours)
          const dayLabel = `${SHORT_WEEKDAY[day.getDay()]} ${day.getDate()}${isToday ? ` ${SHORT_MONTH[day.getMonth()]}` : ''}`

          if (isCovered) {
            /* ── Jour couvert : pill verte non cliquable ─────────────────── */
            return (
              <div
                key={k}
                className={[
                  'flex shrink-0 flex-col items-center gap-0.5 rounded-lg border px-2.5 py-1.5 min-w-[52px]',
                  // Weekends légèrement atténués
                  isWeekend
                    ? 'border-emerald-200/60 bg-emerald-50/60 dark:border-emerald-800/40 dark:bg-emerald-900/10'
                    : 'border-emerald-200 bg-emerald-50 dark:border-emerald-700/50 dark:bg-emerald-900/20',
                ].join(' ')}
                title={`${count} post${count > 1 ? 's' : ''} planifié${count > 1 ? 's' : ''}`}
              >
                {/* Nom du jour */}
                <span
                  className={[
                    'text-[10px] leading-none',
                    isToday
                      ? 'font-semibold text-emerald-700 dark:text-emerald-400'
                      : 'font-medium text-emerald-600/80 dark:text-emerald-500',
                  ].join(' ')}
                >
                  {dayLabel}
                </span>

                {/* Compteur de posts */}
                <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">
                  ●{count}
                </span>
              </div>
            )
          }

          /* ── Jour vide : pill cliquable ──────────────────────────────── */
          return (
            <button
              key={k}
              type="button"
              onClick={() => onCreateForDay(day)}
              title={`Créer un post pour le ${day.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}`}
              className={[
                'flex shrink-0 flex-col items-center gap-0.5 rounded-lg border border-dashed px-2.5 py-1.5 min-w-[52px]',
                'transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                // Weekends : ton encore plus atténué
                isWeekend
                  ? 'border-border/50 text-muted-foreground/50 hover:border-border hover:bg-muted/50 hover:text-muted-foreground'
                  : 'border-border text-muted-foreground hover:border-primary/40 hover:bg-primary/5 hover:text-foreground',
              ].join(' ')}
            >
              {/* Nom du jour — gras si aujourd'hui */}
              <span
                className={[
                  'text-[10px] leading-none',
                  isToday ? 'font-semibold' : 'font-medium',
                ].join(' ')}
              >
                {dayLabel}
              </span>

              {/* Icône "Créer" */}
              <Plus className="size-2.5" />
            </button>
          )
        })}
      </div>
    </div>
  )
}
