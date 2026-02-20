/**
 * @file modules/posts/components/PostComposer/Footer.tsx
 * @module posts
 * @description Barre d'actions du PostComposer avec les boutons de soumission.
 *   Fournit deux actions :
 *   - "Brouillon" : sauvegarde le post avec status DRAFT
 *   - "Planifier" (si scheduledFor défini) : sauvegarde avec status SCHEDULED
 *
 *   Les boutons sont désactivés si :
 *   - Aucun texte
 *   - Aucune plateforme sélectionnée
 *   - Dépassement de la limite de caractères
 *   - Soumission en cours
 *
 *   Interaction avec le contexte :
 *   - Lit : text, platforms, scheduledFor, isSubmitting
 *   - Appelle : saveDraft, schedulePost
 *
 * @example
 *   <PostComposer>
 *     <PostComposer.Footer />
 *   </PostComposer>
 */

'use client'

import { Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { getEffectiveCharLimit } from '@/modules/posts/schemas/post.schema'

import { usePostComposerContext } from './context'

// ─── Composant ────────────────────────────────────────────────────────────────

/**
 * Barre d'actions du PostComposer.
 * Adapte les boutons affichés selon l'état du brouillon
 * (planification active ou non).
 */
export function Footer(): React.JSX.Element {
  const { text, platforms, scheduledFor, isSubmitting, saveDraft, schedulePost } =
    usePostComposerContext()

  // ─── Calcul de l'état des boutons ─────────────────────────────────────────
  const charLimit = getEffectiveCharLimit(platforms)
  const isOverLimit = text.length > charLimit
  const hasText = text.trim().length > 0
  const hasPlatforms = platforms.length > 0

  // Un post peut être soumis si : texte non vide + plateformes sélectionnées + pas de dépassement
  const canSubmit = hasText && hasPlatforms && !isOverLimit && !isSubmitting

  // Bouton "Planifier" disponible uniquement si une date future est définie
  const canSchedule = canSubmit && scheduledFor !== null

  // ─── Messages d'aide ──────────────────────────────────────────────────────
  const helpText = !hasText
    ? 'Rédigez votre post pour continuer'
    : !hasPlatforms
      ? 'Sélectionnez au moins une plateforme'
      : isOverLimit
        ? 'Le texte dépasse la limite autorisée'
        : null

  return (
    <div className="flex flex-col gap-3 pt-2">
      {/* Message d'aide contextuel */}
      {helpText && !isSubmitting && (
        <p className="text-xs text-muted-foreground" role="status">
          {helpText}
        </p>
      )}

      {/* Boutons d'action */}
      <div className="flex items-center justify-end gap-2">
        {/* Bouton Brouillon */}
        <Button
          type="button"
          variant="outline"
          size="sm"
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

        {/* Bouton Planifier (uniquement si une date est sélectionnée) */}
        {scheduledFor && (
          <Button
            type="button"
            size="sm"
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
                Planifier
                <span className="ml-1.5 rounded bg-primary-foreground/20 px-1 py-0.5 text-[10px]">
                  {scheduledFor.toLocaleDateString('fr-FR', {
                    day: 'numeric',
                    month: 'short',
                  })}
                </span>
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  )
}
