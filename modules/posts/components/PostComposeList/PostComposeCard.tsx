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

import { Calendar, Loader2, Pencil, Trash2 } from 'lucide-react'
import { useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { PLATFORM_CONFIG } from '@/modules/platforms/constants'
import type { Post } from '@/modules/posts/types'

// ─── Props ────────────────────────────────────────────────────────────────────

interface PostComposeCardProps {
  /** Post DRAFT à afficher */
  post: Post
  /** Callback appelé quand l'utilisateur clique "Modifier" */
  onEdit: (post: Post) => void
  /** Callback appelé après la suppression réussie du post */
  onDelete: (postId: string) => void
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

/**
 * Retourne les classes CSS du badge selon le statut du post.
 *
 * @param status - Statut du post
 * @returns Classes Tailwind pour le badge
 */
function getStatusBadgeVariant(status: Post['status']): 'default' | 'secondary' | 'outline' {
  switch (status) {
    case 'DRAFT':
      return 'secondary'
    case 'SCHEDULED':
      return 'default'
    default:
      return 'outline'
  }
}

/** Labels lisibles des statuts */
const STATUS_LABELS: Record<Post['status'], string> = {
  DRAFT: 'Brouillon',
  SCHEDULED: 'Planifié',
  PUBLISHED: 'Publié',
  FAILED: 'Échoué',
}

// ─── Composant ────────────────────────────────────────────────────────────────

/**
 * Carte d'un post DRAFT dans la liste de composition.
 * Affiche les informations essentielles du post et les actions disponibles.
 */
export function PostComposeCard({ post, onEdit, onDelete }: PostComposeCardProps): React.JSX.Element {
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
    <div className="flex gap-3 rounded-xl border border-border bg-card p-4 transition-shadow hover:shadow-sm">
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
          <Badge variant={getStatusBadgeVariant(post.status)} className="text-xs py-0">
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
                className="size-8 overflow-hidden rounded border border-border bg-muted"
              >
                <img
                  src={url}
                  alt={`Média ${i + 1}`}
                  className="size-full object-cover"
                />
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
      <div className="flex shrink-0 items-start gap-1.5">
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
