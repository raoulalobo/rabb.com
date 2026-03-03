/**
 * @file modules/posts/components/PostComposeList/SelectionRecap.tsx
 * @module posts
 * @description Popover récapitulatif des posts sélectionnés (cross-filtres).
 *
 *   Affiché comme trigger cliquable "N sélectionné(s)" dans la BulkActionBar.
 *   Permet à l'utilisateur de voir l'ensemble des posts sélectionnés (y compris
 *   ceux de filtres précédents, invisibles dans la vue courante) et de désélectionner
 *   chaque post individuellement ou de tout vider d'un coup.
 *
 *   Structure du Popover :
 *   - Trigger : chip "N sélectionné(s)" (underline au hover)
 *   - Content (side="top") :
 *     - Header : "Sélection (N posts)" + bouton "Tout effacer"
 *     - Liste scrollable (max-h-[50vh]) : une mini-card par post
 *       · icône plateforme (bgColor + dot coloré)
 *       · label plateforme + texte tronqué
 *       · badge statut (STATUS_BADGE_CLASSES)
 *       · date planifiée si SCHEDULED
 *       · bouton × (désélectionner ce post)
 *
 * @example
 *   <SelectionRecap
 *     selectedPosts={selectedPosts}
 *     onDeselect={(postId) => deselect(postId)}
 *     onClearAll={clearSelection}
 *   />
 */

'use client'

import { X } from 'lucide-react'
import { useState } from 'react'

import { Badge } from '@/components/ui/badge'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { PLATFORM_CONFIG } from '@/modules/platforms/constants'
import { STATUS_BADGE_CLASSES, STATUS_LABELS } from '@/modules/posts/utils/status-styles'
import type { Post } from '@/modules/posts/types'

// ─── Types ────────────────────────────────────────────────────────────────────

interface SelectionRecapProps {
  /** Liste complète des posts sélectionnés (tous filtres confondus) */
  selectedPosts: Post[]
  /**
   * Callback : retire un post de la sélection par son ID.
   * Appelé au clic sur le bouton × d'une ligne.
   */
  onDeselect: (postId: string) => void
  /**
   * Callback : vide toute la sélection.
   * Appelé au clic sur "Tout effacer" dans le header du Popover.
   * Ferme automatiquement le Popover.
   */
  onClearAll: () => void
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Formate une date de planification en chaîne courte française.
 * Affiche jour + mois + heure si l'heure n'est pas minuit.
 *
 * @param date - Date de planification (peut être null)
 * @returns Chaîne formatée (ex: "15 mars · 14h30") ou chaîne vide si null
 *
 * @example
 *   formatScheduledDate(new Date('2026-03-15T14:30:00')) // → "15 mars · 14h30"
 *   formatScheduledDate(new Date('2026-03-15T00:00:00')) // → "15 mars"
 *   formatScheduledDate(null)                           // → ""
 */
function formatScheduledDate(date: Date | null): string {
  if (!date) return ''
  const d = new Date(date)
  // Formatter le jour + mois en français
  const dayMonth = d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
  const h = d.getHours()
  const m = d.getMinutes()
  // Afficher l'heure seulement si non minuit (heure et minutes non nulles)
  if (h !== 0 || m !== 0) {
    const timeStr = `${String(h).padStart(2, '0')}h${m > 0 ? String(m).padStart(2, '0') : ''}`
    return `${dayMonth} · ${timeStr}`
  }
  return dayMonth
}

// ─── Composant ────────────────────────────────────────────────────────────────

/**
 * Chip cliquable "N sélectionné(s)" qui ouvre un Popover listant tous les posts
 * sélectionnés avec option de désélection individuelle ou globale.
 */
export function SelectionRecap({
  selectedPosts,
  onDeselect,
  onClearAll,
}: SelectionRecapProps): React.JSX.Element {
  /** Contrôle l'état ouvert/fermé du Popover */
  const [open, setOpen] = useState(false)

  const count = selectedPosts.length

  return (
    <Popover open={open} onOpenChange={setOpen}>
      {/*
       * Trigger : chip texte cliquable.
       * underline-offset-2 + hover:underline → feedback visuel interactif.
       * cursor-pointer : indique clairement que l'élément est cliquable.
       */}
      <PopoverTrigger asChild>
        <button
          type="button"
          className="cursor-pointer text-sm font-medium text-foreground underline-offset-2 hover:underline"
        >
          {count} sélectionné{count !== 1 ? 's' : ''}
        </button>
      </PopoverTrigger>

      {/*
       * Popover côté "top" : s'ouvre au-dessus de la BulkActionBar fixe en bas.
       * align="start" : aligne à gauche du trigger.
       * w-80 : largeur fixe 320px pour un affichage constant.
       * p-0 : padding géré manuellement par les sections internes.
       */}
      <PopoverContent
        side="top"
        align="start"
        className="w-80 p-0"
        sideOffset={8}
      >
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
          <span className="text-sm font-medium text-foreground">
            Sélection ({count} post{count !== 1 ? 's' : ''})
          </span>
          {/* "Tout effacer" : vide la sélection + ferme le Popover */}
          <button
            type="button"
            onClick={() => {
              onClearAll()
              setOpen(false)
            }}
            className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            Tout effacer
          </button>
        </div>

        {/* ── Liste des posts sélectionnés ─────────────────────────────────── */}
        {/*
         * max-h-[50vh] : limite la hauteur à 50% du viewport pour rester visible
         *   même avec beaucoup de posts sélectionnés.
         * overflow-y-auto : scroll vertical si la liste dépasse.
         */}
        <div className="max-h-[50vh] overflow-y-auto py-1">
          {selectedPosts.map((post) => {
            // Récupère la config de la plateforme (fallback sur un objet minimal si inconnu)
            const config = PLATFORM_CONFIG[post.platform as keyof typeof PLATFORM_CONFIG]
            const platformLabel = config?.label ?? post.platform
            const platformColor = config?.color ?? '#888888'

            return (
              /*
               * Ligne post :
               * - flex items-center gap-2 : icône + contenu + bouton × alignés
               * - px-3 py-2 : padding interne confortable
               * - hover:bg-muted/50 : feedback visuel survol
               * - group : permet hover:opacity-100 sur le bouton × (visible au survol)
               */
              <div
                key={post.id}
                className="group flex items-center gap-2 px-3 py-2 hover:bg-muted/50"
              >
                {/* ── Icône plateforme ──────────────────────────────────────── */}
                {/*
                 * Rond coloré (bgColor de la plateforme) avec un petit dot de la couleur de marque.
                 * size-6 : compact mais lisible.
                 */}
                <div
                  className="flex size-6 shrink-0 items-center justify-center rounded-full"
                  style={{ backgroundColor: config?.bgColor ?? '#F5F5F5' }}
                  title={platformLabel}
                >
                  <div
                    className="size-2 rounded-full"
                    style={{ backgroundColor: platformColor }}
                  />
                </div>

                {/* ── Contenu : plateforme + texte + badge + date ───────────── */}
                <div className="min-w-0 flex-1">
                  {/* Ligne supérieure : label plateforme + badge statut */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium text-foreground">
                      {platformLabel}
                    </span>
                    {/* Badge statut : réutilise STATUS_BADGE_CLASSES (source de vérité) */}
                    <Badge
                      variant="outline"
                      className={`px-1 py-0 text-[10px] leading-4 ${STATUS_BADGE_CLASSES[post.status]}`}
                    >
                      {STATUS_LABELS[post.status]}
                    </Badge>
                  </div>

                  {/* Texte du post tronqué (line-clamp-1) */}
                  <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                    {post.text || <span className="italic">Post vide</span>}
                  </p>

                  {/* Date de planification (uniquement pour SCHEDULED) */}
                  {post.status === 'SCHEDULED' && post.scheduledFor && (
                    <p className="mt-0.5 text-[10px] text-muted-foreground/70">
                      {formatScheduledDate(post.scheduledFor)}
                    </p>
                  )}
                </div>

                {/* ── Bouton désélectionner (×) ─────────────────────────────── */}
                {/*
                 * opacity-0 group-hover:opacity-100 : visible uniquement au survol de la ligne.
                 * hover:bg-destructive/10 hover:text-destructive : feedback rouge pour indiquer
                 *   que l'action retire cet élément.
                 */}
                <button
                  type="button"
                  onClick={() => onDeselect(post.id)}
                  aria-label={`Désélectionner ce post ${platformLabel}`}
                  title="Retirer de la sélection"
                  className="flex size-5 shrink-0 items-center justify-center rounded-full text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                >
                  <X className="size-3" />
                </button>
              </div>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}
