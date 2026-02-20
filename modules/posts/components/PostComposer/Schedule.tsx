/**
 * @file modules/posts/components/PostComposer/Schedule.tsx
 * @module posts
 * @description Section de planification du post : date et heure de publication.
 *   Utilise DateTimePicker (Popover + Calendar + spinners heure/minute)
 *   à la place de l'input datetime-local natif.
 *
 *   Interaction avec le contexte :
 *   - Lit : scheduledFor, isSubmitting
 *   - Écrit : setScheduledFor
 *
 *   La date minimale est calculée à maintenant + 5 minutes pour éviter
 *   les planifications dans le passé immédiat.
 *
 * @example
 *   <PostComposer>
 *     <PostComposer.Schedule />
 *   </PostComposer>
 */

'use client'

import { CalendarClock } from 'lucide-react'

import { usePostComposerContext } from './context'
import { DateTimePicker } from './DateTimePicker'

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Retourne la date minimale autorisée pour la planification (maintenant + 5 min).
 * Recalculée à chaque rendu pour rester à jour.
 *
 * @returns Date minimale pour DateTimePicker
 */
function getMinDate(): Date {
  const min = new Date()
  // Ajouter 5 minutes pour éviter les planifications dans le passé immédiat
  min.setMinutes(min.getMinutes() + 5)
  return min
}

// ─── Composant ────────────────────────────────────────────────────────────────

/**
 * Section de planification de la date et heure de publication.
 * Affiche le DateTimePicker et un résumé lisible de la date sélectionnée.
 *
 * @returns Section planification avec label, picker et confirmation
 */
export function Schedule(): React.JSX.Element {
  const { scheduledFor, setScheduledFor, isSubmitting } = usePostComposerContext()

  return (
    <div className="space-y-2">
      {/* Label avec icône */}
      <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <CalendarClock className="size-3.5" />
        Planifier pour
      </p>

      {/* Sélecteur de date/heure avec popover calendrier + spinners */}
      <DateTimePicker
        value={scheduledFor}
        onChange={setScheduledFor}
        minDate={getMinDate()}
        disabled={isSubmitting}
        placeholder="Choisir une date de publication…"
      />

      {/* Confirmation lisible de la date sélectionnée */}
      {scheduledFor && (
        <p className="text-xs text-muted-foreground">
          Publication prévue le{' '}
          <span className="font-medium text-foreground">
            {scheduledFor.toLocaleDateString('fr-FR', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </span>
          {' à '}
          <span className="font-medium text-foreground">
            {scheduledFor.toLocaleTimeString('fr-FR', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        </p>
      )}
    </div>
  )
}
