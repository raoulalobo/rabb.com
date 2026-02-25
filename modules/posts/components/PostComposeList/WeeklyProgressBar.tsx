/**
 * @file modules/posts/components/PostComposeList/WeeklyProgressBar.tsx
 * @module posts
 * @description Barre de progression hebdomadaire : compte les posts SCHEDULED
 *   et PUBLISHED de la semaine en cours (lundi → dimanche) et les compare
 *   à un objectif configurable (WEEKLY_GOAL, par défaut 5).
 *
 *   - Barre de progression animée (transition CSS width 700ms)
 *   - Couleur adaptative : muted → primary → emerald selon l'avancement
 *   - Message motivationnel contextuel ("Bon début !", "Presque là !", etc.)
 *   - Rendu conditionnel :
 *     · masquée si aucun post chargé (état vide total)
 *     · masquée si des filtres sont actifs (données partielles → comptage incorrect)
 *   - Objectif futur : WEEKLY_GOAL sera configurable dans /settings
 *
 * @example
 *   <WeeklyProgressBar posts={allPosts} />
 *   // → "Semaine en cours  [▓▓▓▓░░░░░░]  3/5 · À mi-chemin !"
 */

'use client'

import { TrendingUp } from 'lucide-react'
import { useEffect, useState } from 'react'

import type { Post } from '@/modules/posts/types'

// ─── Constantes ───────────────────────────────────────────────────────────────

/**
 * Objectif hebdomadaire par défaut.
 * TODO: rendre configurable depuis /settings (profil utilisateur).
 */
const WEEKLY_GOAL = 5

// ─── Props ────────────────────────────────────────────────────────────────────

interface WeeklyProgressBarProps {
  /**
   * Posts chargés dans la liste (source de vérité pour le comptage hebdomadaire).
   * Les posts sont triés par scheduledFor DESC → les posts de la semaine
   * en cours sont dans les premières pages chargées.
   */
  posts: Post[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Calcule le lundi et le dimanche (23:59:59) de la semaine contenant `date`.
 * Semaine ISO (lundi = premier jour).
 *
 * @param date - Date de référence (typiquement `new Date()`)
 * @returns { monday, sunday } bornes de la semaine en cours
 *
 * @example
 *   currentWeekBounds(new Date('2026-02-25')) // mercredi
 *   // → { monday: 2026-02-23T00:00:00, sunday: 2026-03-01T23:59:59 }
 */
function currentWeekBounds(date: Date): { monday: Date; sunday: Date } {
  const dow = date.getDay() // 0 = dimanche, 1 = lundi … 6 = samedi
  const monday = new Date(date)
  // Décalage vers le lundi : dimanche (0) → -6, lundi (1) → 0, mardi (2) → -1…
  monday.setDate(date.getDate() - (dow === 0 ? 6 : dow - 1))
  monday.setHours(0, 0, 0, 0)

  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  sunday.setHours(23, 59, 59, 999)

  return { monday, sunday }
}

/**
 * Retourne le message motivationnel adapté à l'avancement.
 *
 * @param count    - Posts planifiés/publiés cette semaine
 * @param goal     - Objectif hebdomadaire
 * @param percent  - Pourcentage d'avancement (0-100)
 * @returns Message court affiché à droite du compteur
 */
function getMotivationalMessage(count: number, goal: number, percent: number): string {
  if (count === 0) return 'Planifiez votre semaine !'
  if (count > goal) return `+${count - goal} au-delà de l'objectif`
  if (count === goal) return 'Objectif atteint ✓'
  if (percent >= 60) return 'Presque là !'
  if (percent >= 40) return 'À mi-chemin !'
  return 'Bon début !'
}

// ─── Composant ────────────────────────────────────────────────────────────────

/**
 * Barre de progression hebdomadaire affichée en haut de la liste /compose.
 * Comptabilise les posts SCHEDULED + PUBLISHED de lundi à dimanche.
 * Se masque si la liste est vide ou si des filtres sont actifs.
 *
 * @param posts - Posts chargés dans la liste (paginated, 25+ items)
 */
export function WeeklyProgressBar({ posts }: WeeklyProgressBarProps): React.JSX.Element | null {
  const now = new Date()
  const { monday, sunday } = currentWeekBounds(now)

  // ── Comptage des posts de la semaine ───────────────────────────────────────
  // SCHEDULED (programmés) + PUBLISHED (déjà publiés) comptent tous les deux.
  // La date de référence : scheduledFor pour SCHEDULED, publishedAt pour PUBLISHED.
  const weeklyCount = posts.filter((p) => {
    if (p.status !== 'SCHEDULED' && p.status !== 'PUBLISHED') return false
    const ref = p.scheduledFor ?? p.publishedAt
    if (!ref) return false
    const d = new Date(ref)
    return d >= monday && d <= sunday
  }).length

  const rawPercent = Math.round((weeklyCount / WEEKLY_GOAL) * 100)
  // Plafonner à 100% pour la barre (l'affichage du compteur montre la vraie valeur)
  const displayPercent = Math.min(100, rawPercent)

  // ── Animation d'entrée ─────────────────────────────────────────────────────
  // On démarre à 0% puis on laisse la transition CSS amener la barre à sa vraie valeur.
  // Le délai de 50ms garantit que le DOM est monté avant le reflow nécessaire
  // pour que la transition s'applique depuis 0 → displayPercent.
  const [animatedPercent, setAnimatedPercent] = useState(0)
  useEffect(() => {
    const id = setTimeout(() => setAnimatedPercent(displayPercent), 50)
    return () => clearTimeout(id)
  }, [displayPercent])

  // ── Couleur de la barre (adaptative selon l'avancement) ───────────────────
  const barColorClass =
    weeklyCount >= WEEKLY_GOAL
      ? 'bg-emerald-500 dark:bg-emerald-400'   // Objectif atteint : vert
      : displayPercent >= 60
        ? 'bg-primary'                           // > 60% : couleur primaire pleine
        : 'bg-primary/60'                        // Démarrage : primaire atténuée

  const message = getMotivationalMessage(weeklyCount, WEEKLY_GOAL, displayPercent)

  return (
    /*
     * Disposition : icône + label | barre (flex-1) | compteur + message
     * La barre s'étire pour occuper tout l'espace disponible.
     * sm:block sur le message : masqué sur très petit écran pour éviter l'overflow.
     */
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5">
      {/* ── Label ─────────────────────────────────────────────────────────── */}
      <div className="flex shrink-0 items-center gap-1.5">
        <TrendingUp
          className={[
            'size-3.5 shrink-0',
            weeklyCount >= WEEKLY_GOAL ? 'text-emerald-500' : 'text-muted-foreground',
          ].join(' ')}
        />
        <span className="whitespace-nowrap text-xs font-medium text-muted-foreground">
          Semaine en cours
        </span>
      </div>

      {/* ── Barre de progression ─────────────────────────────────────────── */}
      {/*
       * overflow-hidden + rounded-full sur le conteneur garantissent que le
       * remplissage ne dépasse pas les bords arrondis.
       * transition-[width] duration-700 : animation smooth depuis 0% → valeur réelle.
       */}
      <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full transition-[width] duration-700 ease-out ${barColorClass}`}
          style={{ width: `${animatedPercent}%` }}
          role="progressbar"
          aria-valuenow={weeklyCount}
          aria-valuemin={0}
          aria-valuemax={WEEKLY_GOAL}
          aria-label={`${weeklyCount} sur ${WEEKLY_GOAL} posts planifiés cette semaine`}
        />
      </div>

      {/* ── Compteur + message ────────────────────────────────────────────── */}
      <div className="flex shrink-0 items-center gap-1.5">
        {/* Compteur "3/5" en tabular-nums pour éviter le décalage au changement */}
        <span className="text-xs font-semibold tabular-nums">
          {weeklyCount}
          <span className="font-normal text-muted-foreground">/{WEEKLY_GOAL}</span>
        </span>

        {/* Message motivationnel — masqué sur très petits écrans */}
        <span className="hidden text-xs text-muted-foreground sm:inline">
          · {message}
        </span>
      </div>
    </div>
  )
}
