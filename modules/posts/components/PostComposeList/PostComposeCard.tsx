/**
 * @file modules/posts/components/PostComposeList/PostComposeCard.tsx
 * @module posts
 * @description Carte d'un post DRAFT dans la liste /compose.
 *
 *   Affiche :
 *   - Icône de la plateforme (depuis PLATFORM_CONFIG)
 *   - Texte tronqué à 2 lignes
 *   - Vignettes des médias (max 3 affichées + compteur)
 *   - Badge statut (DRAFT / SCHEDULED)
 *   - Date prévue si scheduledFor
 *   - Actions : Modifier (ouvre AgentModal en mode edit) · Supprimer
 *
 * @example
 *   <PostComposeCard
 *     post={post}
 *     onEdit={(post) => { setSelectedPost(post); setModalOpen(true) }}
 *     onDelete={(postId) => { removePostFromList(postId) }}
 *   />
 */

'use client'

import { Calendar, Loader2, Pencil, Play, Trash2 } from 'lucide-react'
import { useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { PLATFORM_CONFIG } from '@/modules/platforms/constants'
import { STATUS_BADGE_CLASSES, STATUS_LABELS } from '@/modules/posts/utils/status-styles'
import type { Post } from '@/modules/posts/types'

// ─── Props ────────────────────────────────────────────────────────────────────

interface PostComposeCardProps {
  /** Post DRAFT à afficher */
  post: Post
  /** Callback appelé quand l'utilisateur clique "Modifier" */
  onEdit: (post: Post) => void
  /** Callback appelé après la suppression réussie du post */
  onDelete: (postId: string) => void
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

// ─── Helper détection type de média ──────────────────────────────────────────

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

// ─── Composant ────────────────────────────────────────────────────────────────

/**
 * Carte d'un post DRAFT dans la liste de composition.
 * Affiche les informations essentielles du post et les actions disponibles.
 */
export function PostComposeCard({ post, onEdit, onDelete, onDetail }: PostComposeCardProps): React.JSX.Element {
  const [isDeleting, setIsDeleting] = useState(false)

  const config = PLATFORM_CONFIG[post.platform as keyof typeof PLATFORM_CONFIG]

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
     * Les boutons d'action (Modifier / Supprimer) appellent e.stopPropagation() via leur
     * div wrapper pour ne pas déclencher ce handler lors d'un clic sur les boutons.
     *
     * Accessibilité : role="button" + tabIndex + onKeyDown permettent la navigation clavier
     * (Tab pour focus, Entrée/Espace pour activer) quand onDetail est actif.
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
      onKeyDown={onDetail ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onDetail(post) } } : undefined}
      aria-label={onDetail ? `Voir les détails du post ${post.platform}` : undefined}
    >
      {/* ── Icône de plateforme ───────────────────────────────────────────── */}
      <div
        className="flex size-8 shrink-0 items-center justify-center rounded-md"
        style={{ backgroundColor: config?.bgColor ?? '#f5f5f5' }}
      >
        {config ? (
          <img
            src={config.iconPath}
            alt={config.label}
            className="size-5 object-contain"
          />
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
          {/* Badge couleur sémantique importé depuis status-styles.ts (source de vérité) */}
          <Badge variant="outline" className={`text-xs py-0 ${STATUS_BADGE_CLASSES[post.status]}`}>
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
                     * Vidéo : preload="metadata" charge uniquement les métadonnées
                     * et la première image (poster naturel) sans télécharger le fichier entier.
                     * muted est obligatoire pour l'autoplay éventuel et évite le son en vignette.
                     */}
                    <video
                      src={url}
                      preload="metadata"
                      muted
                      playsInline
                      className="size-full object-cover"
                      aria-label={`Vidéo ${i + 1}`}
                    />
                    {/* Overlay icône Play pour signaler que c'est une vidéo */}
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                      <Play className="size-3 fill-white text-white" />
                    </div>
                  </>
                ) : (
                  <img
                    src={url}
                    alt={`Média ${i + 1}`}
                    className="size-full object-cover"
                  />
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

        {/* Date planifiée (si présente) */}
        {post.scheduledFor && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Calendar className="size-3 shrink-0" />
            <span>{formatScheduledDate(post.scheduledFor)}</span>
          </div>
        )}
      </div>

      {/* ── Actions ───────────────────────────────────────────────────────── */}
      {/*
       * stopPropagation sur cette div : empêche le clic sur Modifier ou Supprimer
       * de remonter jusqu'à l'onClick de la carte parente (qui ouvrirait le modal de détail).
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
