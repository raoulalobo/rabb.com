/**
 * @file modules/posts/components/PostComposer/Footer.tsx
 * @module posts
 * @description Barre d'actions du PostComposer avec les boutons de soumission.
 *   Fournit quatre actions :
 *   - "Brouillon" : sauvegarde le post comme draft chez Zernio
 *   - "Planifier" (si scheduledFor défini) : planifie avec scheduledFor + timezone
 *   - "File d'attente" : ajoute au prochain créneau libre (queuedFromProfile)
 *   - "Publier" : publication immédiate (publishNow: true)
 *
 *   Interaction avec le contexte :
 *   - Lit : text, platforms, scheduledFor, isSubmitting
 *   - Appelle : saveDraft, schedulePost, enqueuePost, publishPost
 *
 * @example
 *   <PostComposer>
 *     <PostComposer.Footer />
 *   </PostComposer>
 */

'use client'

import { ListOrdered, Loader2, Send, Zap } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { getCharLimit } from '@/modules/posts/schemas/post.schema'

import { usePostComposerContext } from './context'

// ─── Composant ────────────────────────────────────────────────────────────────

/**
 * Barre d'actions du PostComposer.
 * Adapte les boutons affichés selon l'état du brouillon.
 */
export function Footer(): React.JSX.Element {
  const {
    text,
    platforms,
    scheduledFor,
    isSubmitting,
    readOnly,
    saveDraft,
    schedulePost,
    enqueuePost,
    publishPost,
  } = usePostComposerContext()

  // ─── Calcul de l'état des boutons ─────────────────────────────────────────
  const charLimit = platforms.length > 0
    ? Math.min(...platforms.map((p) => getCharLimit(p)))
    : 63206
  const isOverLimit = text.length > charLimit
  const hasText = text.trim().length > 0
  const hasPlatforms = platforms.length > 0

  const canSubmit = hasText && hasPlatforms && !isOverLimit && !isSubmitting
  const canSchedule = canSubmit && scheduledFor !== null

  // En lecture seule (post PUBLISHED) → ne rien afficher
  if (readOnly) return <></>

  // ─── Messages d'aide ──────────────────────────────────────────────────────
  const helpText = !hasText
    ? 'Rédigez votre post pour continuer'
    : !hasPlatforms
      ? 'Sélectionnez au moins une plateforme'
      : isOverLimit
        ? 'Le texte dépasse la limite autorisée'
        : null

  return (
    <div className="sticky bottom-0 bg-background flex flex-col gap-3 pt-2">
      {/* Message d'aide contextuel */}
      {helpText && !isSubmitting && (
        <p className="text-xs text-muted-foreground" role="status">
          {helpText}
        </p>
      )}

      {/* Boutons d'action
          Mobile : colonne inversée (action principale en haut)
          Desktop (sm+) : ligne alignée à droite */}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
        {/* Bouton Brouillon */}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full sm:w-auto"
          onClick={saveDraft}
          disabled={!canSubmit}
          aria-label="Enregistrer comme brouillon"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 size-3.5 animate-spin" />
              Sauvegarde…
            </>
          ) : (
            'Brouillon'
          )}
        </Button>

        {/* Bouton File d'attente — assigne le prochain créneau libre */}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full sm:w-auto"
          onClick={enqueuePost}
          disabled={!canSubmit}
          aria-label="Ajouter à la file d'attente"
        >
          {isSubmitting ? (
            <Loader2 className="mr-2 size-3.5 animate-spin" />
          ) : (
            <ListOrdered className="mr-1.5 size-3.5" />
          )}
          File d&apos;attente
        </Button>

        {/* Bouton Planifier (uniquement si une date est sélectionnée) */}
        {scheduledFor && (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="w-full sm:w-auto"
            onClick={schedulePost}
            disabled={!canSchedule}
            aria-label={`Planifier pour le ${scheduledFor.toLocaleDateString('fr-FR')}`}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 size-3.5 animate-spin" />
                Planification…
              </>
            ) : (
              <>
                <Send className="mr-1.5 size-3.5" />
                Planifier
                <span className="ml-1.5 rounded bg-secondary-foreground/10 px-1 py-0.5 text-[10px]">
                  {scheduledFor.toLocaleDateString('fr-FR', {
                    day: 'numeric',
                    month: 'short',
                  })}
                </span>
              </>
            )}
          </Button>
        )}

        {/* Bouton Publier maintenant */}
        <Button
          type="button"
          size="sm"
          className="w-full sm:w-auto"
          onClick={publishPost}
          disabled={!canSubmit}
          aria-label="Publier maintenant"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 size-3.5 animate-spin" />
              Publication…
            </>
          ) : (
            <>
              <Zap className="mr-1.5 size-3.5" />
              Publier
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
