/**
 * @file modules/queue/components/QueueDayColumn.tsx
 * @module queue
 * @description Colonne d'un jour de la semaine dans la grille de file d'attente.
 *   Affiche le nom du jour, le nombre de créneaux, et la liste des créneaux
 *   triés par heure croissante. Chaque créneau est cliquable pour l'éditer.
 *   Un bouton "+" permet d'ajouter un nouveau créneau à ce jour.
 *
 * @example
 *   <QueueDayColumn day={lundiDay} onAddSlot={handleAdd} onEditSlot={handleEdit} />
 */

'use client'

import { Clock, Plus, ToggleLeft, ToggleRight, Trash2 } from 'lucide-react'
import { useTransition } from 'react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { deleteQueueSlot, updateQueueSlot } from '@/modules/queue/actions/queue.action'
import type { QueueDay, QueueSlot } from '@/modules/queue/types'

// ─── Types ───────────────────────────────────────────────────────────────────

interface QueueDayColumnProps {
  /** Données du jour (label, créneaux triés) */
  day: QueueDay
  /** Callback pour ouvrir le dialog de création d'un créneau pour ce jour */
  onAddSlot: (dayOfWeek: number) => void
  /** Callback pour ouvrir le dialog d'édition d'un créneau existant */
  onEditSlot: (slot: QueueSlot) => void
  /** Callback appelé après une mutation réussie (pour invalider le cache TanStack) */
  onMutationSuccess: () => void
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Formate une heure et minute en chaîne lisible (ex: "09:00", "14:30").
 *
 * @param hour - Heure (0-23)
 * @param minute - Minute (0-59)
 * @returns Chaîne formatée "HH:MM"
 *
 * @example
 *   formatTime(9, 0)   // → "09:00"
 *   formatTime(14, 30) // → "14:30"
 */
function formatTime(hour: number, minute: number): string {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

// ─── Composant ───────────────────────────────────────────────────────────────

/**
 * Colonne représentant un jour de la semaine avec ses créneaux.
 * Affiche un en-tête (nom du jour + count) et la liste des créneaux
 * avec des actions rapides (toggle actif, supprimer).
 *
 * @param props - Props du composant
 * @returns Colonne de jour avec créneaux
 */
export function QueueDayColumn({
  day,
  onAddSlot,
  onEditSlot,
  onMutationSuccess,
}: QueueDayColumnProps): React.JSX.Element {
  const [isPending, startTransition] = useTransition()

  /**
   * Toggle l'état actif/inactif d'un créneau sans ouvrir le dialog.
   * Appelle directement la Server Action updateQueueSlot.
   */
  function handleToggleActive(slot: QueueSlot): void {
    startTransition(async () => {
      const result = await updateQueueSlot({ id: slot.id, active: !slot.active })
      if (result.success) {
        toast.success(slot.active ? 'Créneau désactivé' : 'Créneau activé')
        onMutationSuccess()
      } else {
        toast.error(result.error ?? 'Erreur lors de la mise à jour')
      }
    })
  }

  /**
   * Supprime un créneau après confirmation implicite (action rapide).
   */
  function handleDelete(slotId: string): void {
    startTransition(async () => {
      const result = await deleteQueueSlot(slotId)
      if (result.success) {
        toast.success('Créneau supprimé')
        onMutationSuccess()
      } else {
        toast.error(result.error ?? 'Erreur lors de la suppression')
      }
    })
  }

  // Nombre de créneaux actifs pour le badge
  const activeCount = day.slots.filter((s) => s.active).length

  return (
    <Card className="flex flex-col">
      {/* ── En-tête du jour ─────────────────────────────────────────────── */}
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold">
            {day.label}
          </CardTitle>
          {activeCount > 0 && (
            <Badge variant="secondary" className="text-xs">
              {activeCount} créneau{activeCount > 1 ? 'x' : ''}
            </Badge>
          )}
        </div>
      </CardHeader>

      {/* ── Liste des créneaux ───────────────────────────────────────────── */}
      <CardContent className="flex-1 space-y-2">
        {day.slots.length === 0 ? (
          // État vide : aucun créneau pour ce jour
          <p className="text-center text-xs text-muted-foreground py-4">
            Aucun créneau
          </p>
        ) : (
          day.slots.map((slot) => (
            <div
              key={slot.id}
              className={`
                group flex items-center gap-2 rounded-md border p-2 text-sm
                transition-colors cursor-pointer hover:bg-accent/50
                ${!slot.active ? 'opacity-50' : ''}
                ${isPending ? 'pointer-events-none' : ''}
              `}
              onClick={() => onEditSlot(slot)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onEditSlot(slot)
                }
              }}
            >
              {/* Icône horloge + heure */}
              <Clock className="size-3.5 shrink-0 text-muted-foreground" />
              <span className="font-medium">{formatTime(slot.hour, slot.minute)}</span>

              {/* Badge plateforme (si spécifique) */}
              {slot.platform && (
                <Badge variant="outline" className="text-xs capitalize">
                  {slot.platform}
                </Badge>
              )}

              {/* Spacer */}
              <div className="flex-1" />

              {/* Actions rapides (visibles au hover) */}
              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                {/* Toggle actif/inactif */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-6"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleToggleActive(slot)
                  }}
                  title={slot.active ? 'Désactiver' : 'Activer'}
                >
                  {slot.active ? (
                    <ToggleRight className="size-3.5 text-green-500" />
                  ) : (
                    <ToggleLeft className="size-3.5 text-muted-foreground" />
                  )}
                </Button>

                {/* Supprimer */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-6 text-destructive hover:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleDelete(slot.id)
                  }}
                  title="Supprimer"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </div>
          ))
        )}

        {/* ── Bouton ajouter ───────────────────────────────────────────── */}
        <Button
          variant="ghost"
          size="sm"
          className="w-full border border-dashed text-xs text-muted-foreground hover:text-foreground"
          onClick={() => onAddSlot(day.dayOfWeek)}
        >
          <Plus className="mr-1 size-3.5" />
          Ajouter
        </Button>
      </CardContent>
    </Card>
  )
}
