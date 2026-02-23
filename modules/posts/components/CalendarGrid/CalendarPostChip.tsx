/**
 * @file modules/posts/components/CalendarGrid/CalendarPostChip.tsx
 * @module posts
 * @description Chip compact représentant un post dans la grille calendrier.
 *
 *   Deux modes :
 *   - `interactive=false` (défaut) : <div> non interactif — comportement /calendar/ actuel.
 *   - `interactive=true`           : <button> + Popover shadcn/ui d'aperçu lecture seule.
 *
 *   Code couleur par statut :
 *   - DRAFT      : gris (non planifié)
 *   - SCHEDULED  : bleu (planifié, en attente)
 *   - PUBLISHED  : vert (publié avec succès)
 *   - FAILED     : rouge (publication échouée)
 *
 * @example
 *   // Non interactif (page /calendar)
 *   <CalendarPostChip post={post} />
 *
 *   // Interactif avec popover d'aperçu (page /compose)
 *   <CalendarPostChip post={post} interactive />
 */

import { Calendar, ImageIcon } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { PLATFORM_CONFIG } from '@/modules/platforms/constants'
import {
  STATUS_BADGE_CLASSES,
  STATUS_CHIP_CLASSES,
  STATUS_LABELS,
} from '@/modules/posts/utils/status-styles'
import type { Post } from '@/modules/posts/types'

// ─── Helper ───────────────────────────────────────────────────────────────────

/**
 * Formate une date (Date ou string ISO) pour l'affichage dans le popover.
 * Exemple de rendu : "21 février à 17:00"
 *
 * @param date - Date à formater
 * @returns Chaîne localisée en français
 */
function formatScheduledDate(date: Date | string): string {
  const d = date instanceof Date ? date : new Date(date)
  return d.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface CalendarPostChipProps {
  /** Post à afficher */
  post: Post
  /**
   * Si true : rend le chip cliquable.
   * Ouvre un Popover d'aperçu lecture seule (plateforme, statut, texte, date, médias).
   * Default: false → <div> non interactif (comportement /calendar/).
   */
  interactive?: boolean
}

// ─── Composant ────────────────────────────────────────────────────────────────

/**
 * Chip compact pour afficher un post dans une cellule de la grille calendrier.
 *
 * Sans `interactive` : div non cliquable — identique au comportement /calendar/.
 * Avec `interactive`  : bouton qui ouvre un Popover d'aperçu lecture seule contenant :
 *   - Icône + nom de la plateforme + badge statut
 *   - Texte complet (max 4 lignes avec overflow)
 *   - Date planifiée (si présente)
 *   - Nombre de médias (si > 0)
 *
 * @param post        - Post à représenter
 * @param interactive - Active le mode bouton + popover (défaut : false)
 */
export function CalendarPostChip({
  post,
  interactive = false,
}: CalendarPostChipProps): React.JSX.Element {
  // Couleur sémantique du chip selon le statut (source : status-styles.ts)
  const style = STATUS_CHIP_CLASSES[post.status]

  // Heure de planification ou publication (si disponible)
  const dateToShow = post.scheduledFor ?? post.publishedAt
  const timeLabel = dateToShow
    ? new Date(dateToShow).toLocaleTimeString('fr-FR', {
        hour: '2-digit',
        minute: '2-digit',
      })
    : null

  // Texte tronqué pour tenir dans la cellule
  const truncatedText = post.text.length > 20 ? `${post.text.slice(0, 20)}…` : post.text

  // Config plateforme pour l'affichage de l'icône dans le popover
  const config = PLATFORM_CONFIG[post.platform as keyof typeof PLATFORM_CONFIG]

  // Classes communes du chip (appliquées dans les deux modes)
  const chipClasses = [
    'flex items-center gap-1 rounded px-1.5 py-0.5',
    'text-[11px] leading-tight transition-opacity hover:opacity-80',
    style,
  ].join(' ')

  // Contenu interne du chip (identique dans les deux modes)
  const chipContent = (
    <>
      {/* Heure si planifié, sinon un point de statut */}
      {timeLabel ? (
        <span className="shrink-0 font-medium tabular-nums">{timeLabel}</span>
      ) : (
        <span className="size-1.5 shrink-0 rounded-full bg-current opacity-60" />
      )}
      {/* Extrait du texte tronqué */}
      <span className="truncate">{truncatedText}</span>
    </>
  )

  // ── Mode non interactif (comportement /calendar/ actuel) ──────────────────
  if (!interactive) {
    return (
      <div
        className={chipClasses}
        title={`[${STATUS_LABELS[post.status]}] ${post.text}`}
        role="listitem"
      >
        {chipContent}
      </div>
    )
  }

  // ── Mode interactif : bouton + Popover d'aperçu lecture seule ─────────────
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`${chipClasses} cursor-pointer hover:ring-1 hover:ring-primary/30`}
          title={`[${STATUS_LABELS[post.status]}] ${post.text}`}
        >
          {chipContent}
        </button>
      </PopoverTrigger>

      <PopoverContent className="w-64 space-y-2 p-3" align="start">
        {/* ── En-tête : plateforme + badge statut ────────────────────────── */}
        <div className="flex items-center gap-2">
          {/* Icône SVG de la plateforme (si config disponible) */}
          {config && (
            <img
              src={config.iconPath}
              alt={config.label}
              className="size-4 shrink-0"
            />
          )}
          {/* Nom de la plateforme */}
          <span className="text-xs font-semibold">
            {config?.label ?? post.platform}
          </span>
          {/* Badge statut aligné à droite */}
          <Badge
            variant="outline"
            className={`ml-auto text-[10px] py-0 ${STATUS_BADGE_CLASSES[post.status]}`}
          >
            {STATUS_LABELS[post.status]}
          </Badge>
        </div>

        {/* ── Texte complet (max 4 lignes, overflow clip) ─────────────────── */}
        <p className="text-xs leading-relaxed text-muted-foreground line-clamp-4">
          {post.text}
        </p>

        {/* ── Métadonnées : date + nb médias ──────────────────────────────── */}
        <div className="space-y-1 text-[11px] text-muted-foreground">
          {/* Date de planification ou publication */}
          {dateToShow && (
            <div className="flex items-center gap-1">
              <Calendar className="size-3 shrink-0" />
              <span>{formatScheduledDate(dateToShow)}</span>
            </div>
          )}
          {/* Nombre de médias (masqué si aucun) */}
          {post.mediaUrls.length > 0 && (
            <div className="flex items-center gap-1">
              <ImageIcon className="size-3 shrink-0" />
              <span>
                {post.mediaUrls.length} média{post.mediaUrls.length > 1 ? 's' : ''}
              </span>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
