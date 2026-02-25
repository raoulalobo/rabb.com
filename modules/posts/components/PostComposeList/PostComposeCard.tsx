/**
 * @file modules/posts/components/PostComposeList/PostComposeCard.tsx
 * @module posts
 * @description Carte d'un post dans la liste /compose.
 *
 *   Affiche :
 *   - Icône de la plateforme (depuis PLATFORM_CONFIG)
 *   - Texte tronqué à 2 lignes
 *   - Vignettes des médias (max 3 affichées + compteur)
 *   - Badge statut (DRAFT / SCHEDULED / PUBLISHED / FAILED)
 *   - Date planifiée cliquable → Popover de replanification inline
 *   - Bouton "+ Planifier" pour les DRAFT sans date
 *   - Actions : Modifier (ouvre AgentModal en mode edit) · Supprimer
 *
 *   Replanification inline :
 *   - Clic sur la date → Popover avec Calendar shadcn + sélecteurs heure/minute
 *   - Clic sur "+ Planifier" (DRAFT sans date) → même Popover
 *   - "Confirmer" → PATCH /api/posts/[id] → onReschedule(updatedPost)
 *   - "Supprimer la date" → PATCH { scheduledFor: null } → retour en DRAFT
 *
 * @example
 *   <PostComposeCard
 *     post={post}
 *     onEdit={(post) => { setSelectedPost(post); setModalOpen(true) }}
 *     onDelete={(postId) => { removePostFromList(postId) }}
 *     onReschedule={(updatedPost) => { updatePostInList(updatedPost) }}
 *   />
 */

'use client'

import { Calendar, CalendarClock, Check, Loader2, Pencil, Play, Trash2, X } from 'lucide-react'
import { useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Calendar as CalendarPicker } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { PLATFORM_CONFIG } from '@/modules/platforms/constants'
import { STATUS_BADGE_CLASSES, STATUS_LABELS } from '@/modules/posts/utils/status-styles'
import type { Post } from '@/modules/posts/types'

// ─── Props ────────────────────────────────────────────────────────────────────

interface PostComposeCardProps {
  /** Post à afficher */
  post: Post
  /** Callback appelé quand l'utilisateur clique "Modifier" */
  onEdit: (post: Post) => void
  /** Callback appelé après la suppression réussie du post */
  onDelete: (postId: string) => void
  /** Callback appelé après une replanification réussie avec le post mis à jour */
  onReschedule: (updatedPost: Post) => void
  /** Callback appelé quand l'utilisateur clique sur le corps de la carte (ouvre le modal de détail) */
  onDetail?: (post: Post) => void
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Formate une date en chaîne lisible en français.
 * Ex: "15 mars à 09h00"
 *
 * @param date - Date à formater
 * @returns Chaîne formatée en français
 */
function formatScheduledDate(date: Date): string {
  return new Date(date).toLocaleString('fr-FR', {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** Extensions vidéo reconnues */
const VIDEO_EXTENSIONS = /\.(mp4|mov|webm|avi|mkv|m4v|ogv)(\?.*)?$/i

/**
 * Détermine si une URL pointe vers une vidéo en se basant sur l'extension.
 *
 * @param url - URL du média
 * @returns true si c'est une vidéo, false si c'est une image
 *
 * @example
 *   isVideoUrl('https://...supabase.co/posts/video.mp4') // true
 *   isVideoUrl('https://...supabase.co/posts/photo.jpg') // false
 */
function isVideoUrl(url: string): boolean {
  return VIDEO_EXTENSIONS.test(url)
}

// ─── Constantes de l'heure ────────────────────────────────────────────────────

/** Heures disponibles dans le sélecteur (0-23) */
const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'))

/** Minutes disponibles (quarts d'heure) */
const MINUTES = ['00', '15', '30', '45']

// ─── Composant ────────────────────────────────────────────────────────────────

/**
 * Carte d'un post dans la liste de composition.
 * Affiche les informations essentielles du post et les actions disponibles,
 * dont la replanification inline via un Popover Calendar.
 */
export function PostComposeCard({
  post,
  onEdit,
  onDelete,
  onReschedule,
  onDetail,
}: PostComposeCardProps): React.JSX.Element {
  const [isDeleting, setIsDeleting] = useState(false)

  // ── État du popover de replanification ──────────────────────────────────
  const [rescheduleOpen, setRescheduleOpen] = useState(false)
  /** Jour sélectionné dans le Calendar (undefined = aucun) */
  const [pickedDate, setPickedDate] = useState<Date | undefined>(undefined)
  /** Heure sélectionnée "HH" */
  const [pickedHour, setPickedHour] = useState('09')
  /** Minute sélectionnée "MM" */
  const [pickedMinute, setPickedMinute] = useState('00')
  const [isRescheduling, setIsRescheduling] = useState(false)

  const config = PLATFORM_CONFIG[post.platform as keyof typeof PLATFORM_CONFIG]

  // Seuls DRAFT et SCHEDULED peuvent être replanifiés
  const canReschedule = post.status === 'DRAFT' || post.status === 'SCHEDULED'

  /**
   * Initialise le picker depuis la date existante du post (ou valeurs par défaut).
   * Appelé à l'ouverture du popover pour pré-remplir les sélecteurs.
   */
  const initPicker = (): void => {
    if (post.scheduledFor) {
      const d = new Date(post.scheduledFor)
      setPickedDate(d)
      setPickedHour(String(d.getHours()).padStart(2, '0'))
      setPickedMinute(String(d.getMinutes()).padStart(2, '0'))
    } else {
      // Pas de date existante : initialiser au lendemain à 09h00
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      setPickedDate(tomorrow)
      setPickedHour('09')
      setPickedMinute('00')
    }
  }

  /**
   * Confirme la replanification : appelle PATCH /api/posts/[id] avec la date construite.
   * Met à jour la liste via onReschedule (update optimiste dans le parent).
   */
  const handleConfirmReschedule = async (): Promise<void> => {
    if (!pickedDate || isRescheduling) return
    setIsRescheduling(true)

    // Combiner la date du Calendar et les sélecteurs heure/minute
    const dt = new Date(pickedDate)
    dt.setHours(parseInt(pickedHour, 10), parseInt(pickedMinute, 10), 0, 0)

    try {
      const res = await fetch(`/api/posts/${post.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduledFor: dt.toISOString() }),
      })

      if (res.ok) {
        const updatedPost = await res.json() as Post
        onReschedule(updatedPost)
        setRescheduleOpen(false)
      } else {
        console.error('[PostComposeCard] Erreur replanification :', res.status)
      }
    } catch (err) {
      console.error('[PostComposeCard] Erreur replanification :', err)
    }

    setIsRescheduling(false)
  }

  /**
   * Supprime la date planifiée (scheduledFor = null → statut DRAFT).
   * Appelle PATCH /api/posts/[id] avec { scheduledFor: null }.
   */
  const handleRemoveDate = async (): Promise<void> => {
    if (isRescheduling) return
    setIsRescheduling(true)

    try {
      const res = await fetch(`/api/posts/${post.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduledFor: null }),
      })

      if (res.ok) {
        const updatedPost = await res.json() as Post
        onReschedule(updatedPost)
        setRescheduleOpen(false)
      } else {
        console.error('[PostComposeCard] Erreur suppression date :', res.status)
      }
    } catch (err) {
      console.error('[PostComposeCard] Erreur suppression date :', err)
    }

    setIsRescheduling(false)
  }

  /**
   * Supprime le post via l'API et notifie le parent.
   * Appelle DELETE /api/posts/[id].
   */
  const handleDelete = async (): Promise<void> => {
    if (isDeleting) return
    setIsDeleting(true)

    try {
      const res = await fetch(`/api/posts/${post.id}`, { method: 'DELETE' })
      if (res.ok) {
        onDelete(post.id)
      } else {
        console.error('[PostComposeCard] Erreur suppression :', res.status)
        setIsDeleting(false)
      }
    } catch (err) {
      console.error('[PostComposeCard] Erreur suppression :', err)
      setIsDeleting(false)
    }
  }

  return (
    /*
     * onClick sur l'ensemble de la carte → ouvre le modal de détail (si onDetail est fourni).
     * Les boutons d'action (Modifier / Supprimer / Replanifier) appellent e.stopPropagation()
     * via leur div wrapper pour ne pas déclencher ce handler.
     *
     * Accessibilité : role="button" + tabIndex + onKeyDown permettent la navigation clavier.
     */
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions
    <div
      className={[
        'flex gap-3 rounded-xl border border-border bg-card p-4 transition-shadow hover:shadow-sm',
        onDetail ? 'cursor-pointer hover:border-border/80' : '',
      ].join(' ')}
      onClick={() => onDetail?.(post)}
      role={onDetail ? 'button' : undefined}
      tabIndex={onDetail ? 0 : undefined}
      onKeyDown={
        onDetail
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onDetail(post)
              }
            }
          : undefined
      }
      aria-label={onDetail ? `Voir les détails du post ${post.platform}` : undefined}
    >
      {/* ── Icône de plateforme ───────────────────────────────────────────── */}
      <div
        className="flex size-8 shrink-0 items-center justify-center rounded-md"
        style={{ backgroundColor: config?.bgColor ?? '#f5f5f5' }}
      >
        {config ? (
          <img src={config.iconPath} alt={config.label} className="size-5 object-contain" />
        ) : (
          <span className="text-xs font-bold text-muted-foreground uppercase">
            {post.platform.slice(0, 2)}
          </span>
        )}
      </div>

      {/* ── Contenu principal ─────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0 space-y-1.5">
        {/* Ligne 1 : nom de la plateforme + badge statut */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-foreground">
            {config?.label ?? post.platform}
          </span>
          <Badge
            variant="outline"
            className={`text-xs py-0 ${STATUS_BADGE_CLASSES[post.status]}`}
          >
            {STATUS_LABELS[post.status]}
          </Badge>
        </div>

        {/* Texte tronqué (2 lignes max) */}
        <p className="line-clamp-2 text-sm text-muted-foreground leading-relaxed">
          {post.text}
        </p>

        {/* Vignettes des médias (max 3 + compteur) */}
        {post.mediaUrls.length > 0 && (
          <div className="flex gap-1 flex-wrap">
            {post.mediaUrls.slice(0, 3).map((url, i) => (
              <div
                key={url}
                className="relative size-8 overflow-hidden rounded border border-border bg-muted"
              >
                {isVideoUrl(url) ? (
                  <>
                    {/*
                     * preload="metadata" : charge uniquement la première frame
                     * sans télécharger le fichier entier.
                     */}
                    <video
                      src={url}
                      preload="metadata"
                      muted
                      playsInline
                      className="size-full object-cover"
                      aria-label={`Vidéo ${i + 1}`}
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                      <Play className="size-3 fill-white text-white" />
                    </div>
                  </>
                ) : (
                  <img src={url} alt={`Média ${i + 1}`} className="size-full object-cover" />
                )}
              </div>
            ))}
            {post.mediaUrls.length > 3 && (
              <div className="flex size-8 items-center justify-center rounded border border-border bg-muted text-xs text-muted-foreground font-medium">
                +{post.mediaUrls.length - 3}
              </div>
            )}
          </div>
        )}

        {/* ── Date planifiée cliquable (popover de replanification) ─────── */}
        {/*
         * stopPropagation : empêche le clic sur le trigger du popover de remonter
         * jusqu'à l'onClick de la carte parente (qui ouvrirait le modal de détail).
         */}
        <div onClick={(e) => e.stopPropagation()}>
          <Popover
            open={rescheduleOpen}
            onOpenChange={(open) => {
              // À l'ouverture : initialiser le picker depuis la date existante
              if (open) initPicker()
              setRescheduleOpen(open)
            }}
          >
            {post.scheduledFor ? (
              /* Date existante : chip cliquable */
              <PopoverTrigger asChild>
                <button
                  type="button"
                  disabled={!canReschedule}
                  className={[
                    'flex items-center gap-1 text-xs text-muted-foreground rounded px-1 -ml-1',
                    canReschedule
                      ? 'hover:text-foreground hover:bg-muted transition-colors cursor-pointer'
                      : 'cursor-default',
                  ].join(' ')}
                  title={canReschedule ? 'Cliquer pour replanifier' : undefined}
                >
                  <Calendar className="size-3 shrink-0" />
                  <span>{formatScheduledDate(post.scheduledFor)}</span>
                </button>
              </PopoverTrigger>
            ) : canReschedule ? (
              /* Pas de date : bouton "+ Planifier" discret */
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="flex items-center gap-1 text-xs text-muted-foreground/60 hover:text-muted-foreground rounded px-1 -ml-1 transition-colors"
                >
                  <CalendarClock className="size-3 shrink-0" />
                  <span>Planifier</span>
                </button>
              </PopoverTrigger>
            ) : null}

            {/* ── Contenu du Popover ─────────────────────────────────── */}
            <PopoverContent
              className="w-auto p-0"
              align="start"
              side="bottom"
              // stopPropagation : évite que les clics dans le popover ferment des modals parents
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex flex-col">
                {/* Calendrier pour sélectionner le jour */}
                <CalendarPicker
                  mode="single"
                  selected={pickedDate}
                  onSelect={setPickedDate}
                  // Désactiver les jours passés (replanification = futur uniquement)
                  disabled={(day) => day < new Date(new Date().setHours(0, 0, 0, 0))}
                  initialFocus
                />

                {/* Sélecteurs heure / minute */}
                <div className="flex items-center gap-2 border-t px-3 py-2.5">
                  <span className="text-xs text-muted-foreground shrink-0">Heure :</span>

                  {/* Sélecteur heure */}
                  <select
                    value={pickedHour}
                    onChange={(e) => setPickedHour(e.target.value)}
                    className="h-7 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                    aria-label="Heure"
                  >
                    {HOURS.map((h) => (
                      <option key={h} value={h}>{h}h</option>
                    ))}
                  </select>

                  <span className="text-xs text-muted-foreground">:</span>

                  {/* Sélecteur minute (quarts d'heure) */}
                  <select
                    value={pickedMinute}
                    onChange={(e) => setPickedMinute(e.target.value)}
                    className="h-7 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                    aria-label="Minute"
                  >
                    {MINUTES.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>

                {/* Boutons d'action */}
                <div className="flex items-center gap-1.5 border-t px-3 py-2">
                  {/* Confirmer : disabled si aucune date sélectionnée */}
                  <Button
                    size="sm"
                    className="h-7 gap-1.5 text-xs flex-1"
                    disabled={!pickedDate || isRescheduling}
                    onClick={() => void handleConfirmReschedule()}
                  >
                    {isRescheduling ? (
                      <Loader2 className="size-3 animate-spin" />
                    ) : (
                      <Check className="size-3" />
                    )}
                    Confirmer
                  </Button>

                  {/* Supprimer la date — visible uniquement si une date existe déjà */}
                  {post.scheduledFor && (
                    <button
                      type="button"
                      disabled={isRescheduling}
                      onClick={() => void handleRemoveDate()}
                      title="Supprimer la date planifiée (retour en brouillon)"
                      className={[
                        'flex size-7 items-center justify-center rounded-md border border-border',
                        'text-muted-foreground hover:border-destructive/50 hover:bg-destructive/10 hover:text-destructive',
                        'transition-colors disabled:cursor-not-allowed disabled:opacity-50',
                      ].join(' ')}
                      aria-label="Supprimer la date planifiée"
                    >
                      <X className="size-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* ── Actions ───────────────────────────────────────────────────────── */}
      {/*
       * stopPropagation : empêche le clic sur Modifier/Supprimer de remonter
       * jusqu'à l'onClick de la carte (modal de détail).
       */}
      <div
        className="flex shrink-0 items-start gap-1.5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Bouton Modifier — ouvre l'AgentModal en mode édition */}
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 text-xs h-7 px-2"
          onClick={() => onEdit(post)}
          disabled={isDeleting || post.status === 'PUBLISHED' || post.status === 'FAILED'}
        >
          <Pencil className="size-3" />
          Modifier
        </Button>

        {/* Bouton Supprimer */}
        <button
          type="button"
          onClick={() => void handleDelete()}
          disabled={isDeleting}
          className={[
            'flex size-7 items-center justify-center rounded-md border border-border text-muted-foreground',
            'hover:border-destructive/50 hover:bg-destructive/10 hover:text-destructive',
            'transition-colors disabled:cursor-not-allowed disabled:opacity-50',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          ].join(' ')}
          aria-label="Supprimer ce post"
        >
          {isDeleting ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Trash2 className="size-3.5" />
          )}
        </button>
      </div>
    </div>
  )
}
