/**
 * @file modules/posts/components/CalendarGrid/CalendarPostChip.tsx
 * @module posts
 * @description Chip compact représentant un post dans la grille calendrier.
 *   Code couleur par statut :
 *   - DRAFT      : gris (non planifié)
 *   - SCHEDULED  : bleu (planifié, en attente)
 *   - PUBLISHED  : vert (publié avec succès)
 *   - FAILED     : rouge (publication échouée)
 *
 * @example
 *   <CalendarPostChip post={post} />
 */

import type { Post } from '@/modules/posts/types'

// ─── Constantes de style par statut ───────────────────────────────────────────

const STATUS_STYLES: Record<Post['status'], string> = {
  DRAFT: 'bg-muted/80 text-muted-foreground',
  SCHEDULED: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  PUBLISHED: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  FAILED: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
}

const STATUS_LABELS: Record<Post['status'], string> = {
  DRAFT: 'Brouillon',
  SCHEDULED: 'Planifié',
  PUBLISHED: 'Publié',
  FAILED: 'Échoué',
}

// ─── Composant ────────────────────────────────────────────────────────────────

interface CalendarPostChipProps {
  /** Post à afficher */
  post: Post
}

/**
 * Chip compact pour afficher un post dans une cellule de la grille calendrier.
 * Affiche le début du texte et l'heure si planifié.
 * Couleur selon le statut du post.
 *
 * @param post - Post à représenter
 */
export function CalendarPostChip({ post }: CalendarPostChipProps): React.JSX.Element {
  const style = STATUS_STYLES[post.status]

  // Heure de planification/publication (si disponible)
  const dateToShow = post.scheduledFor ?? post.publishedAt
  const timeLabel = dateToShow
    ? new Date(dateToShow).toLocaleTimeString('fr-FR', {
        hour: '2-digit',
        minute: '2-digit',
      })
    : null

  // Texte tronqué pour tenir dans la cellule
  const truncatedText = post.text.length > 20 ? `${post.text.slice(0, 20)}…` : post.text

  return (
    <div
      className={[
        'flex cursor-default items-center gap-1 rounded px-1.5 py-0.5',
        'text-[11px] leading-tight transition-opacity hover:opacity-80',
        style,
      ].join(' ')}
      title={`[${STATUS_LABELS[post.status]}] ${post.text}`}
      role="listitem"
    >
      {/* Heure ou point de statut */}
      {timeLabel ? (
        <span className="shrink-0 font-medium tabular-nums">{timeLabel}</span>
      ) : (
        <span className="size-1.5 shrink-0 rounded-full bg-current opacity-60" />
      )}

      {/* Extrait du texte */}
      <span className="truncate">{truncatedText}</span>
    </div>
  )
}
