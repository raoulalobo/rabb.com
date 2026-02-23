/**
 * @file modules/posts/utils/status-styles.ts
 * @module posts
 * @description Source de vérité unique pour les styles visuels liés aux statuts de post.
 *
 *   Centralise les classes Tailwind et libellés français pour éviter toute divergence
 *   entre PostComposeCard, CalendarPostChip et la légende du calendrier.
 *
 *   Statuts disponibles :
 *   - DRAFT     → gris neutre  (brouillon non soumis)
 *   - SCHEDULED → bleu         (planifié, en attente de publication)
 *   - PUBLISHED → vert         (publié avec succès)
 *   - FAILED    → rouge        (échec de publication)
 *
 * @example
 *   import { STATUS_BADGE_CLASSES, STATUS_LABELS } from '@/modules/posts/utils/status-styles'
 *
 *   // Dans un Badge shadcn/ui :
 *   <Badge variant="outline" className={`text-xs py-0 ${STATUS_BADGE_CLASSES[post.status]}`}>
 *     {STATUS_LABELS[post.status]}
 *   </Badge>
 */

import type { Post } from '@/modules/posts/types'

// ─── Libellés ─────────────────────────────────────────────────────────────────

/**
 * Libellés français par statut, utilisés dans les badges, popover et légende.
 *
 * @example
 *   STATUS_LABELS['PUBLISHED'] // → 'Publié'
 */
export const STATUS_LABELS: Record<Post['status'], string> = {
  DRAFT:     'Brouillon',
  SCHEDULED: 'Planifié',
  PUBLISHED: 'Publié',
  FAILED:    'Échoué',
}

// ─── Styles Badge (PostComposeCard + popover CalendarPostChip) ─────────────────

/**
 * Classes Tailwind pour les composants `<Badge>` shadcn/ui.
 * Surcharge le variant par défaut (`outline`) avec des couleurs sémantiques.
 * `border-0` annule la bordure du variant `outline`.
 *
 * Utilisation : `<Badge variant="outline" className={`text-xs py-0 ${STATUS_BADGE_CLASSES[post.status]}`}>`
 *
 * @example
 *   STATUS_BADGE_CLASSES['FAILED'] // → 'bg-red-100 text-red-700 border-0 dark:bg-red-900/40 dark:text-red-300'
 */
export const STATUS_BADGE_CLASSES: Record<Post['status'], string> = {
  DRAFT:     'bg-muted/80 text-muted-foreground border-0',
  SCHEDULED: 'bg-blue-100 text-blue-700 border-0 dark:bg-blue-900/40 dark:text-blue-300',
  PUBLISHED: 'bg-green-100 text-green-700 border-0 dark:bg-green-900/40 dark:text-green-300',
  FAILED:    'bg-red-100 text-red-700 border-0 dark:bg-red-900/40 dark:text-red-300',
}

// ─── Styles Chip (CalendarPostChip + légende CalendarPage) ───────────────────

/**
 * Classes Tailwind pour les chips compacts de la grille calendrier et la légende.
 * Identiques à STATUS_BADGE_CLASSES mais sans `border-0` (les chips n'ont pas de bordure).
 *
 * Utilisation : `<div className={`flex items-center rounded px-1.5 py-0.5 ${STATUS_CHIP_CLASSES[post.status]}`}>`
 *
 * @example
 *   STATUS_CHIP_CLASSES['PUBLISHED'] // → 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
 */
export const STATUS_CHIP_CLASSES: Record<Post['status'], string> = {
  DRAFT:     'bg-muted/80 text-muted-foreground',
  SCHEDULED: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  PUBLISHED: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  FAILED:    'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
}
