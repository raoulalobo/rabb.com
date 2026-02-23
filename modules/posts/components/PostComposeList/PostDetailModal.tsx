/**
 * @file modules/posts/components/PostComposeList/PostDetailModal.tsx
 * @module posts
 * @description Modal de détail d'un post — affiche toutes les informations d'un post
 *   en un coup d'œil : texte complet, galerie médias, compteur de caractères animé,
 *   grille de métadonnées et actions rapides (modifier / supprimer).
 *
 *   Aesthetic « Obsidian Ledger » :
 *   - Bande couleur de plateforme (3px) en haut du modal
 *   - Icône plateforme dans un badge coloré
 *   - Galerie sombre (bg-zinc-950) avec prévisualisation principale + miniatures
 *   - Compteur de caractères avec barre de progression (couleur plateforme → amber → rouge)
 *   - Grille de métadonnées structurée (MetaRow)
 *   - Blocs contextuel selon le statut (PUBLISHED success / FAILED alert)
 *
 *   Accessibilité :
 *   - Focus trap Radix Dialog
 *   - ESC ferme le modal
 *   - DialogTitle + DialogDescription sr-only pour screen readers
 *   - Boutons avec aria-label
 *
 *   Pattern lastPostRef : conserve le dernier post affiché pendant l'animation
 *   de fermeture du modal pour éviter un flash de contenu vide.
 *
 * @example
 *   <PostDetailModal
 *     post={selectedPost}
 *     open={detailOpen}
 *     onOpenChange={setDetailOpen}
 *     onEdit={(post) => { setSelectedPost(post); setModalOpen(true) }}
 *     onDelete={(postId) => { removeFromList(postId) }}
 *   />
 */

'use client'

import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock,
  ExternalLink,
  Hash,
  Link2,
  Loader2,
  Pencil,
  Play,
  Trash2,
  X,
} from 'lucide-react'
import { useRef, useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
import { PLATFORM_CONFIG } from '@/modules/platforms/constants'
import { STATUS_BADGE_CLASSES, STATUS_LABELS } from '@/modules/posts/utils/status-styles'
import type { Post } from '@/modules/posts/types'

// ─── Props ────────────────────────────────────────────────────────────────────

interface PostDetailModalProps {
  /** Post à afficher (null pendant l'animation de fermeture — lastPostRef prend le relais) */
  post: Post | null
  /** État d'ouverture du modal */
  open: boolean
  /** Callback de changement d'état */
  onOpenChange: (open: boolean) => void
  /** Callback pour basculer vers l'AgentModal en mode édition */
  onEdit: (post: Post) => void
  /** Callback après suppression réussie (retire le post de la liste parente) */
  onDelete: (postId: string) => void
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Extensions vidéo reconnues pour la détection du type de média */
const VIDEO_EXTENSIONS = /\.(mp4|mov|webm|avi|mkv|m4v|ogv)(\?.*)?$/i

/**
 * Détermine si une URL pointe vers une vidéo.
 *
 * @param url - URL du média à analyser
 * @returns true si c'est une vidéo, false si c'est une image
 */
function isVideoUrl(url: string): boolean {
  return VIDEO_EXTENSIONS.test(url)
}

/**
 * Formate une date en chaîne complète lisible en français.
 *
 * @param date - Date à formater (null → retourne '—')
 * @returns Chaîne formatée, ex: "lundi 15 mars 2024 à 09h00"
 */
function formatFullDate(date: Date | null): string {
  if (!date) return '—'
  return new Date(date).toLocaleString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// ─── Sous-composant MetaRow ───────────────────────────────────────────────────

interface MetaRowProps {
  /** Icône Lucide (size-3 recommandé) */
  icon: React.ReactNode
  /** Libellé court affiché en majuscules */
  label: string
  /** Valeur à droite (peut être du JSX pour les liens) */
  value: React.ReactNode
}

/**
 * Ligne de métadonnée : icône dans un cercle + libellé uppercase + valeur.
 * Utilisée dans la grille d'informations du modal (créé le, planifié pour, etc.).
 *
 * @example
 *   <MetaRow icon={<Calendar className="size-3" />} label="Planifié pour" value={formatFullDate(post.scheduledFor)} />
 */
function MetaRow({ icon, label, value }: MetaRowProps): React.JSX.Element {
  return (
    <div className="flex items-start gap-3 py-2.5 first:pt-0 last:pb-0">
      {/* Icône dans un cercle muted */}
      <div className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        {/* Label uppercase + très espacé pour différencier du contenu */}
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70 leading-none">
          {label}
        </p>
        <div className="mt-0.5 text-sm text-foreground break-all leading-relaxed">
          {value}
        </div>
      </div>
    </div>
  )
}

// ─── Composant principal ──────────────────────────────────────────────────────

/**
 * Modal de détail d'un post avec aesthetic « Obsidian Ledger ».
 *
 * Utilise `lastPostRef` pour conserver le contenu affiché pendant l'animation
 * de fermeture du Dialog Radix (évite le flash de contenu vide quand `post` passe à null).
 *
 * @param post        - Post à afficher (null pendant la transition de fermeture)
 * @param open        - Contrôle l'ouverture du Dialog
 * @param onOpenChange - Callback Radix appelé à chaque changement d'état
 * @param onEdit      - Ouvre l'AgentModal en mode édition après fermeture du détail
 * @param onDelete    - Retire le post de la liste parente après suppression
 */
export function PostDetailModal({
  post,
  open,
  onOpenChange,
  onEdit,
  onDelete,
}: PostDetailModalProps): React.JSX.Element {
  // ── lastPostRef : préserver le contenu pendant l'animation de fermeture ──────
  // Radix Dialog maintient l'animation de fermeture ~200ms après que `open` passe à false.
  // Pendant cette durée, `post` peut être null. On conserve la dernière valeur non-null
  // pour que le contenu reste affiché pendant l'animation (pas de flash vide).
  const lastPostRef = useRef<Post | null>(null)
  if (post) lastPostRef.current = post
  const displayPost = post ?? lastPostRef.current

  // ── État de suppression (spinner dans le bouton Supprimer) ────────────────
  const [isDeleting, setIsDeleting] = useState(false)

  // ── Index du média sélectionné dans la galerie ────────────────────────────
  const [activeMediaIndex, setActiveMediaIndex] = useState(0)

  // Aucun post à afficher (premier rendu, avant toute ouverture) → fragment vide
  if (!displayPost) return <></>

  const config = PLATFORM_CONFIG[displayPost.platform as keyof typeof PLATFORM_CONFIG]

  // ── Calcul du compteur de caractères ──────────────────────────────────────
  const charCount = displayPost.text.length
  const maxChars = config?.maxChars ?? 0
  // Pourcentage plafonné à 100% pour la largeur de la barre (dépassement = barre pleine rouge)
  const charPercent = maxChars > 0 ? Math.min((charCount / maxChars) * 100, 100) : 0
  const isOverLimit = maxChars > 0 && charCount > maxChars
  const isNearLimit = maxChars > 0 && charCount / maxChars > 0.8

  // ── Couleur de la barre de progression ────────────────────────────────────
  // Progression : couleur plateforme → amber (>80%) → rouge (>100%)
  const progressColor = isOverLimit
    ? '#ef4444'           // rouge destructif
    : isNearLimit
      ? '#f59e0b'         // amber avertissement
      : (config?.color ?? '#6366f1') // couleur de marque de la plateforme

  // ── Suppression du post ───────────────────────────────────────────────────
  /**
   * Supprime le post via l'API, ferme le modal, puis notifie le parent.
   * Une temporisation de 250ms permet à l'animation de fermeture du Dialog
   * de se terminer avant que la carte disparaisse de la liste.
   */
  const handleDelete = async (): Promise<void> => {
    if (isDeleting) return
    setIsDeleting(true)

    try {
      const res = await fetch(`/api/posts/${displayPost.id}`, { method: 'DELETE' })
      if (res.ok) {
        onOpenChange(false)
        // Attendre la fin de l'animation de fermeture avant de retirer de la liste
        setTimeout(() => { onDelete(displayPost.id) }, 250)
      } else {
        console.error('[PostDetailModal] Erreur suppression :', res.status)
        setIsDeleting(false)
      }
    } catch (err) {
      console.error('[PostDetailModal] Erreur suppression :', err)
      setIsDeleting(false)
    }
  }

  // ── Basculer vers l'édition ───────────────────────────────────────────────
  /**
   * Ferme le modal de détail, attend la fin de l'animation, puis ouvre
   * l'AgentModal en mode édition avec le post courant.
   */
  const handleEdit = (): void => {
    onOpenChange(false)
    // Légère temporisation pour que les deux modals ne se superposent pas
    setTimeout(() => { onEdit(displayPost) }, 200)
  }

  // Seuls les posts DRAFT et SCHEDULED sont éditables
  const canEdit = displayPost.status !== 'PUBLISHED' && displayPost.status !== 'FAILED'

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        // Réinitialiser l'état de suppression à la fermeture
        if (!nextOpen) setIsDeleting(false)
        onOpenChange(nextOpen)
      }}
    >
      {/*
       * DialogContent avec showCloseButton={false} pour implémenter notre propre
       * bouton de fermeture (style personnalisé dans le header).
       *
       * p-0 gap-0 overflow-hidden : retirer le padding par défaut pour contrôler
       * précisément chaque zone (header, galerie, footer).
       *
       * max-w-[calc(100%-2rem)] : marge de 1rem de chaque côté sur mobile.
       * sm:max-w-lg md:max-w-xl : élargissement progressif sur desktop.
       */}
      <DialogContent
        showCloseButton={false}
        className="p-0 gap-0 overflow-hidden max-w-[calc(100%-2rem)] sm:max-w-lg md:max-w-xl"
      >
        {/* ── Accessibilité : titre et description sr-only ──────────────────── */}
        <DialogTitle className="sr-only">
          Détails du post {config?.label ?? displayPost.platform}
        </DialogTitle>
        <DialogDescription className="sr-only">
          Post {STATUS_LABELS[displayPost.status]} sur {config?.label ?? displayPost.platform}.
          {displayPost.scheduledFor && ` Planifié pour le ${formatFullDate(displayPost.scheduledFor)}.`}
        </DialogDescription>

        {/* ── Bande couleur plateforme (3px) ───────────────────────────────── */}
        {/*
         * Signature visuelle « Obsidian Ledger » : fine bande de la couleur de
         * marque en haut du modal — identifie instantanément la plateforme.
         */}
        <div
          className="h-1 w-full shrink-0"
          style={{ backgroundColor: config?.color ?? '#6366f1' }}
          aria-hidden="true"
        />

        {/* ── Contenu scrollable ────────────────────────────────────────────── */}
        {/*
         * max-h-[85vh] : le modal ne dépasse pas 85% de la hauteur de l'écran.
         * overflow-y-auto : scroll interne si le contenu est trop long.
         * Le footer reste sticky grâce au flex du DialogContent.
         */}
        <div className="max-h-[85vh] overflow-y-auto">

          {/* ── Header : icône plateforme + infos + statut + fermeture ──────── */}
          <div className="flex items-start gap-3 p-5 pb-4">

            {/* Icône de plateforme dans un badge coloré */}
            <div
              className="flex size-10 shrink-0 items-center justify-center rounded-xl shadow-sm"
              style={{ backgroundColor: config?.bgColor ?? '#f5f5f5' }}
            >
              {config ? (
                <img
                  src={config.iconPath}
                  alt={config.label}
                  className="size-6 object-contain"
                />
              ) : (
                /* Fallback : 2 premières lettres de la plateforme */
                <span className="text-sm font-bold text-muted-foreground uppercase">
                  {displayPost.platform.slice(0, 2)}
                </span>
              )}
            </div>

            {/* Nom de la plateforme + description + badge statut */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[15px] font-semibold text-foreground leading-tight">
                  {config?.label ?? displayPost.platform}
                </span>
                <Badge
                  variant="outline"
                  className={`text-xs py-0 ${STATUS_BADGE_CLASSES[displayPost.status]}`}
                >
                  {STATUS_LABELS[displayPost.status]}
                </Badge>
              </div>
              {config?.description && (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {config.description}
                </p>
              )}
            </div>

            {/* Bouton fermeture — en haut à droite du header */}
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className={[
                'flex size-8 shrink-0 items-center justify-center rounded-lg',
                'text-muted-foreground hover:text-foreground hover:bg-muted/80',
                'transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              ].join(' ')}
              aria-label="Fermer le modal"
            >
              <X className="size-4" />
            </button>
          </div>

          {/* ── Séparateur ────────────────────────────────────────────────────── */}
          <div className="mx-5 border-t border-border" />

          {/* ── Galerie médias ────────────────────────────────────────────────── */}
          {/*
           * Fond noir (bg-zinc-950) pour maximiser le contraste des médias.
           * Prévisualisation principale centrée avec hauteur max limitée.
           * Rangée de miniatures si plusieurs médias.
           */}
          {displayPost.mediaUrls.length > 0 && (
            <div className="mx-5 mt-4 overflow-hidden rounded-xl bg-zinc-950">

              {/* Prévisualisation principale */}
              <div
                className="relative flex items-center justify-center"
                style={{ minHeight: 160, maxHeight: 280 }}
              >
                {isVideoUrl(displayPost.mediaUrls[activeMediaIndex]) ? (
                  /*
                   * Vidéo : controls natifs du navigateur.
                   * preload="metadata" charge uniquement la première frame sans
                   * télécharger le fichier entier.
                   */
                  <video
                    key={displayPost.mediaUrls[activeMediaIndex]}
                    src={displayPost.mediaUrls[activeMediaIndex]}
                    controls
                    preload="metadata"
                    playsInline
                    className="max-h-[280px] w-full object-contain"
                    aria-label={`Vidéo ${activeMediaIndex + 1} sur ${displayPost.mediaUrls.length}`}
                  />
                ) : (
                  <img
                    key={displayPost.mediaUrls[activeMediaIndex]}
                    src={displayPost.mediaUrls[activeMediaIndex]}
                    alt={`Média ${activeMediaIndex + 1} sur ${displayPost.mediaUrls.length}`}
                    className="max-h-[280px] w-full object-contain"
                  />
                )}

                {/* Compteur de médias (ex: "2 / 4") — visible si plusieurs médias */}
                {displayPost.mediaUrls.length > 1 && (
                  <div className="absolute bottom-2 right-2 rounded-md bg-black/60 px-2 py-0.5 text-[11px] font-medium text-white backdrop-blur-sm">
                    {activeMediaIndex + 1} / {displayPost.mediaUrls.length}
                  </div>
                )}
              </div>

              {/* Rangée de miniatures (affichée uniquement si > 1 média) */}
              {displayPost.mediaUrls.length > 1 && (
                <div className="flex gap-1.5 overflow-x-auto p-2.5">
                  {displayPost.mediaUrls.map((url, i) => (
                    <button
                      key={url}
                      type="button"
                      onClick={() => setActiveMediaIndex(i)}
                      className={[
                        'relative size-12 shrink-0 overflow-hidden rounded-md transition-all',
                        // Miniature active : ring blanc + pleine opacité
                        // Miniature inactive : opacité réduite, hover partiel
                        i === activeMediaIndex
                          ? 'ring-2 ring-white ring-offset-1 ring-offset-zinc-950 opacity-100'
                          : 'opacity-50 hover:opacity-80',
                      ].join(' ')}
                      aria-label={`Voir le média ${i + 1}`}
                      aria-pressed={i === activeMediaIndex}
                    >
                      {isVideoUrl(url) ? (
                        <>
                          <video
                            src={url}
                            preload="metadata"
                            muted
                            playsInline
                            className="size-full object-cover"
                            aria-hidden="true"
                          />
                          {/* Overlay icône Play pour signaler que c'est une vidéo */}
                          <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                            <Play className="size-3 fill-white text-white" />
                          </div>
                        </>
                      ) : (
                        <img
                          src={url}
                          alt={`Miniature ${i + 1}`}
                          className="size-full object-cover"
                        />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Texte complet du post ─────────────────────────────────────────── */}
          {/*
           * whitespace-pre-wrap : préserve les retours à la ligne intentionnels.
           * break-words : évite le débordement horizontal sur les URLs longues.
           * font-feature-settings : active les ligatures et chiffres contextuels (si la
           * police les supporte) pour une meilleure lisibilité typographique.
           */}
          <div className="px-5 mt-4">
            <p
              className="text-[14.5px] leading-[1.75] text-foreground whitespace-pre-wrap break-words"
              style={{ fontFeatureSettings: '"cv02", "cv03", "cv04"' }}
            >
              {displayPost.text}
            </p>
          </div>

          {/* ── Compteur de caractères ────────────────────────────────────────── */}
          {/*
           * Affiché uniquement si la plateforme a une limite connue (maxChars > 0).
           * La barre de progression change de couleur :
           *   0–80%   → couleur de marque de la plateforme
           *   80–100% → amber (avertissement)
           *   >100%   → rouge (dépassement)
           */}
          {maxChars > 0 && (
            <div className="px-5 mt-3">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/70">
                  Caractères
                </span>
                <span
                  className="font-mono text-[12px] font-semibold tabular-nums"
                  style={{ color: progressColor }}
                >
                  {charCount.toLocaleString('fr-FR')}
                  <span className="text-muted-foreground/50 font-normal">
                    {' '}/ {maxChars.toLocaleString('fr-FR')}
                  </span>
                </span>
              </div>
              {/* Barre de progression animée */}
              <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${charPercent}%`,
                    backgroundColor: progressColor,
                  }}
                />
              </div>
            </div>
          )}

          {/* ── Séparateur + Grille de métadonnées ───────────────────────────── */}
          <div className="mx-5 mt-4 border-t border-border" />

          <div className="px-5 py-4 divide-y divide-border/50">

            {/* Date de création */}
            <MetaRow
              icon={<Clock className="size-3" />}
              label="Créé le"
              value={formatFullDate(displayPost.createdAt)}
            />

            {/* Date planifiée (uniquement si présente) */}
            {displayPost.scheduledFor && (
              <MetaRow
                icon={<Calendar className="size-3" />}
                label="Planifié pour"
                value={formatFullDate(displayPost.scheduledFor)}
              />
            )}

            {/* Date de publication effective (uniquement si publié) */}
            {displayPost.publishedAt && (
              <MetaRow
                icon={<CheckCircle2 className="size-3" />}
                label="Publié le"
                value={formatFullDate(displayPost.publishedAt)}
              />
            )}

            {/* ID Late — référence unique côté getlate.dev */}
            {displayPost.latePostId && (
              <MetaRow
                icon={<Hash className="size-3" />}
                label="ID Late"
                value={
                  <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                    {displayPost.latePostId}
                  </code>
                }
              />
            )}

            {/* Lien direct vers le post sur la plateforme sociale */}
            {displayPost.platformPostUrl && (
              <MetaRow
                icon={<Link2 className="size-3" />}
                label="Lien publié"
                value={
                  <a
                    href={displayPost.platformPostUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm font-medium underline-offset-2 hover:underline"
                    style={{ color: config?.color ?? 'inherit' }}
                  >
                    Voir sur {config?.label ?? displayPost.platform}
                    <ExternalLink className="size-3 shrink-0" />
                  </a>
                }
              />
            )}
          </div>

          {/* ── Bloc FAILED : affiche la raison d'échec ──────────────────────── */}
          {displayPost.status === 'FAILED' && displayPost.failureReason && (
            <div className="mx-5 mb-4 rounded-lg border border-red-200 bg-red-50 p-3.5 dark:border-red-900/50 dark:bg-red-950/30">
              <div className="flex gap-2.5">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-red-500 dark:text-red-400" />
                <div>
                  <p className="text-sm font-semibold text-red-700 dark:text-red-300">
                    Échec de publication
                  </p>
                  <p className="mt-1 text-xs text-red-600/80 dark:text-red-400/80 leading-relaxed">
                    {displayPost.failureReason}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ── Bloc PUBLISHED : confirmation de succès ───────────────────────── */}
          {displayPost.status === 'PUBLISHED' && (
            <div className="mx-5 mb-4 rounded-lg border border-green-200 bg-green-50 p-3.5 dark:border-green-900/50 dark:bg-green-950/30">
              <div className="flex gap-2.5">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-green-600 dark:text-green-400" />
                <p className="text-sm text-green-700 dark:text-green-300">
                  Ce post a été publié avec succès sur {config?.label ?? displayPost.platform}.
                </p>
              </div>
            </div>
          )}

          {/* ── Footer sticky : limite de caractères + actions ───────────────── */}
          {/*
           * bg-muted/30 + border-t : pied de modal visuellement distinct du contenu.
           * justify-between : info limite à gauche, boutons d'action à droite.
           */}
          <div className="flex items-center justify-between gap-3 border-t border-border bg-muted/30 px-5 py-3.5">

            {/* Info : limite de la plateforme */}
            {maxChars > 0 ? (
              <span className="text-xs text-muted-foreground">
                Limite : {maxChars.toLocaleString('fr-FR')} car.
              </span>
            ) : (
              /* Spacer pour conserver l'alignement des boutons à droite */
              <div />
            )}

            {/* Boutons d'action */}
            <div className="flex items-center gap-2">

              {/* Bouton Modifier → ouvre AgentModal en mode édition */}
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs h-8"
                onClick={handleEdit}
                disabled={!canEdit || isDeleting}
                title={!canEdit ? 'Les posts publiés ou en erreur ne peuvent pas être modifiés' : undefined}
              >
                <Pencil className="size-3" />
                Modifier
              </Button>

              {/* Bouton Supprimer — icône seule avec aria-label */}
              <button
                type="button"
                onClick={() => void handleDelete()}
                disabled={isDeleting}
                className={[
                  'flex size-8 items-center justify-center rounded-md border border-border text-muted-foreground',
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
        </div>
      </DialogContent>
    </Dialog>
  )
}
