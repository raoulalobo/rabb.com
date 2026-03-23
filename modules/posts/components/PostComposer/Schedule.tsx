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

import { CalendarClock, Lightbulb } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import {
  getNextOccurrence,
  useBestTimeSlots,
} from '@/modules/analytics/hooks/useBestTimeSlots'

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
  const { scheduledFor, setScheduledFor, isSubmitting, readOnly } = usePostComposerContext()
  const { slots } = useBestTimeSlots(3)

  /**
   * Applique un créneau recommandé : calcule la prochaine occurrence
   * et met à jour scheduledFor dans le store.
   */
  const applySlot = (dayOfWeek: number, hour: number): void => {
    const nextDate = getNextOccurrence(dayOfWeek, hour)
    setScheduledFor(nextDate)
  }

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
        disabled={isSubmitting || readOnly}
        placeholder="Choisir une date de publication…"
      />

      {/* Créneaux recommandés (basés sur l'engagement passé) */}
      {!readOnly && slots.length > 0 && (
        <div className="space-y-1.5">
          <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <Lightbulb className="size-3" />
            Créneaux recommandés
          </p>
          <div className="flex flex-wrap gap-1.5">
            {slots.map((slot) => (
              <button
                key={`${slot.dayOfWeek}-${slot.hour}`}
                type="button"
                onClick={() => applySlot(slot.dayOfWeek, slot.hour)}
                disabled={isSubmitting}
                className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 rounded-md"
              >
                <Badge
                  variant="outline"
                  className="cursor-pointer gap-1 px-2 py-0.5 text-[11px] transition-colors hover:bg-primary hover:text-primary-foreground"
                >
                  {slot.label}
                </Badge>
              </button>
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground">
            Basé sur votre engagement passé
          </p>
        </div>
      )}

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
