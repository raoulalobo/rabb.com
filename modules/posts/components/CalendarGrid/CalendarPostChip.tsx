/**
 * @file modules/posts/components/CalendarGrid/CalendarPostChip.tsx
 * @module posts
 * @description Chip compact représentant un post dans la grille calendrier.
 *   Design inspiré de Buffer : icône plateforme + heure + icône statut.
 *   Le fond et la bordure gauche utilisent les couleurs de la plateforme (pastel/accent).
 *   Le texte est supprimé du chip (trop compact) — visible dans le Popover.
 *
 *   Deux modes :
 *   - `interactive=false` (défaut) : <div> non interactif — comportement /calendar/.
 *   - `interactive=true`           : <button> + Popover shadcn/ui d'aperçu lecture seule.
 *
 *   Icônes statut :
 *   - PUBLISHED → CheckCircle2 vert
 *   - SCHEDULED → Clock3 bleu
 *   - DRAFT     → FileText gris
 *   - FAILED    → XCircle rouge
 *
 * @example
 *   // Non interactif (page /calendar)
 *   <CalendarPostChip post={post} />
 *
 *   // Interactif avec popover d'aperçu (page /compose)
 *   <CalendarPostChip post={post} interactive />
 */

import { Calendar, CheckCircle2, Clock3, FileText, ImageIcon, XCircle } from 'lucide-react'
import Image from 'next/image'

import { Badge } from '@/components/ui/badge'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { PLATFORM_CONFIG } from '@/modules/platforms/constants'
import { FailureAlert } from '@/modules/posts/components/FailureAlert'
import { getFailureAdvice } from '@/modules/posts/utils/failure-advice'
import {
  STATUS_BADGE_CLASSES,
  STATUS_LABELS,
} from '@/modules/posts/utils/status-styles'
import type { Post } from '@/modules/posts/types'

// ─── Mapping statut → icône + couleur texte ───────────────────────────────────

/**
 * Association statut → composant icône Lucide + classe couleur Tailwind.
 * Utilisé dans le chip pour l'indicateur visuel à droite.
 */
const STATUS_ICON_CONFIG = {
  PUBLISHED: { Icon: CheckCircle2, className: 'text-green-600' },
  SCHEDULED: { Icon: Clock3,       className: 'text-blue-600'  },
  DRAFT:     { Icon: FileText,     className: 'text-gray-400'  },
  FAILED:    { Icon: XCircle,      className: 'text-red-500'   },
} as const

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
  /**
   * Si fourni (et interactive=false) : le chip devient un <button> qui appelle
   * onEdit(post) au clic. Utilisé par /calendar pour ouvrir le Dialog en mode édition.
   * Compatible avec interactive=false uniquement (le mode Popover prend la priorité).
   */
  onEdit?: (post: Post) => void
  /**
   * Si true : le chip est en mode sélection multiple.
   * Affiche une checkbox au lieu du comportement normal.
   * PUBLISHED reste sélectionnable — le serveur gère l'éligibilité.
   */
  isSelectMode?: boolean
  /** true si ce post est actuellement sélectionné (mode sélection) */
  isSelected?: boolean
  /**
   * Callback déclenché au clic en mode sélection.
   * Bascule la sélection de ce post.
   *
   * @param postId - ID du post à basculer
   */
  onToggleSelect?: (postId: string) => void
}

// ─── Composant ────────────────────────────────────────────────────────────────

/**
 * Chip compact style Buffer pour afficher un post dans une cellule de la grille.
 *
 * Layout : [logo plateforme] [heure ou "Brouillon"] [spacer] [icône statut]
 * Fond   : bgColor pastel de la plateforme (ex: #FDF2F8 pour Instagram)
 * Bordure: 3px à gauche avec la couleur accent de la plateforme
 *
 * Sans `interactive` : div non cliquable — comportement /calendar/.
 * Avec `interactive`  : bouton + Popover d'aperçu lecture seule contenant :
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
  onEdit,
  isSelectMode = false,
  isSelected = false,
  onToggleSelect,
}: CalendarPostChipProps): React.JSX.Element {
  // Config plateforme : fournit bgColor (fond pastel), color (accent), iconPath, label
  const platformConfig = PLATFORM_CONFIG[post.platform as keyof typeof PLATFORM_CONFIG]

  // Icône + couleur selon le statut du post
  const statusConfig = STATUS_ICON_CONFIG[post.status] ?? STATUS_ICON_CONFIG.DRAFT
  const { Icon: StatusIcon } = statusConfig

  // Heure de planification (scheduledFor prioritaire) ou publication
  const dateToShow = post.scheduledFor ?? post.publishedAt
  const timeLabel = dateToShow
    ? new Date(dateToShow).toLocaleTimeString('fr-FR', {
        hour: '2-digit',
        minute: '2-digit',
      })
    : null

  // Couleurs inline (valeurs hex → ne peuvent pas être des classes Tailwind statiques)
  const chipStyle = {
    backgroundColor: platformConfig?.bgColor ?? '#F9FAFB',
    borderLeftColor: platformConfig?.color ?? '#6B7280',
  }

  // Classes de base du chip (communes aux deux modes)
  const chipClasses =
    'flex w-full items-center gap-1.5 rounded border-l-[3px] px-1.5 py-0.5 text-xs transition-opacity hover:opacity-80'

  // Contenu interne du chip (identique dans les deux modes)
  const chipContent = (
    <>
      {/* Logo plateforme 14×14 (si config disponible) */}
      {platformConfig?.iconPath && (
        <Image
          src={platformConfig.iconPath}
          alt={post.platform}
          width={14}
          height={14}
          className="shrink-0"
        />
      )}

      {/* Heure (si planifié/publié) ou label "Brouillon" */}
      <span className="flex-1 truncate font-medium tabular-nums text-gray-700">
        {timeLabel ?? 'Brouillon'}
      </span>

      {/* Icône statut à droite */}
      <StatusIcon className={`size-3.5 shrink-0 ${statusConfig.className}`} />
    </>
  )

  // ── Mode sélection multiple : checkbox + chip cliquable ────────────────────
  // Prioritaire sur tous les autres modes (onEdit, interactive).
  // PUBLISHED reste sélectionnable — le serveur filtre côté Server Action.
  if (isSelectMode) {
    return (
      <button
        type="button"
        style={chipStyle}
        className={[
          chipClasses,
          'cursor-pointer',
          // Anneau de sélection : bleu si sélectionné, gris sinon
          isSelected ? 'ring-2 ring-primary' : 'ring-1 ring-border hover:ring-primary/50',
        ].join(' ')}
        aria-pressed={isSelected}
        aria-label={`${isSelected ? 'Désélectionner' : 'Sélectionner'} le post`}
        onClick={(e) => {
          // Stopper la propagation vers la cellule calendrier parente
          e.stopPropagation()
          onToggleSelect?.(post.id)
        }}
      >
        {/*
         * Indicateur visuel de sélection : <div> au lieu de <Checkbox> (shadcn rend un <button>).
         * Un <button> dans un <button> est invalide HTML → hydration error.
         * On simule visuellement la checkbox avec un <div> pur.
         */}
        <div
          aria-hidden
          className={[
            'size-3 shrink-0 rounded-[3px] border flex items-center justify-center transition-colors',
            isSelected
              ? 'bg-primary border-primary text-primary-foreground'
              : 'border-muted-foreground/50 bg-background',
          ].join(' ')}
        >
          {/* Coche SVG visible uniquement si sélectionné */}
          {isSelected && (
            <svg viewBox="0 0 10 10" className="size-2 stroke-current" strokeWidth={2} fill="none">
              <polyline points="1.5,5 4,7.5 8.5,2.5" />
            </svg>
          )}
        </div>
        {chipContent}
      </button>
    )
  }

  // ── Mode non interactif + onEdit : bouton cliquable pour édition /calendar ──
  // Ce mode s'active quand interactive=false et onEdit est fourni.
  // Tous les statuts (y compris PUBLISHED) déclenchent onEdit : c'est CalendarContent
  // qui décide du mode dialog (edit vs view) selon le statut du post.
  if (!interactive && onEdit) {
    return (
      <button
        type="button"
        style={chipStyle}
        className={`${chipClasses} cursor-pointer hover:ring-1 hover:ring-primary/30`}
        onClick={(e) => {
          // Empêche le bubbling vers le <div> CalendarCell qui appellerait
          // handleDayClick() → reset() et écraserait le store chargé par loadPost().
          e.stopPropagation()
          onEdit(post)
        }}
        title={
          post.status === 'PUBLISHED'
            ? `Voir le post — ${post.text}`
            : post.status === 'FAILED' && post.failureReason
              ? `Erreur : ${getFailureAdvice(post.failureReason).summary} — Cliquer pour corriger`
              : `Modifier — [${STATUS_LABELS[post.status]}] ${post.text}`
        }
      >
        {chipContent}
      </button>
    )
  }

  // ── Mode non interactif (lecture seule) ───────────────────────────────────
  // S'applique uniquement quand aucune prop onEdit n'est fournie.
  if (!interactive) {
    return (
      <div
        style={chipStyle}
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
          style={chipStyle}
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
          {platformConfig && (
            <img
              src={platformConfig.iconPath}
              alt={platformConfig.label}
              className="size-4 shrink-0"
            />
          )}
          {/* Nom de la plateforme */}
          <span className="text-xs font-semibold">
            {platformConfig?.label ?? post.platform}
          </span>
          {/* Badge statut aligné à droite */}
          <Badge
            variant="outline"
            className={`ml-auto py-0 text-[10px] ${STATUS_BADGE_CLASSES[post.status]}`}
          >
            {STATUS_LABELS[post.status]}
          </Badge>
        </div>

        {/* ── Texte complet (max 4 lignes, overflow clip) ─────────────────── */}
        <p className="line-clamp-4 text-xs leading-relaxed text-muted-foreground">
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

        {/* ── Alerte d'échec compacte (visible uniquement pour les posts FAILED) ── */}
        {post.status === 'FAILED' && post.failureReason && (
          <FailureAlert compact failureReason={post.failureReason} />
        )}
      </PopoverContent>
    </Popover>
  )
}
