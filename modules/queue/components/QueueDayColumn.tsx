/**
 * @file modules/queue/components/QueueDayColumn.tsx
 * @module queue
 * @description Colonne d'un jour de la semaine dans la grille de file d'attente.
 *   Affiche le nom du jour, le nombre de créneaux, et la liste des créneaux
 *   triés par heure croissante. Chaque créneau affiche un badge plateforme.
 *   Un bouton "+" permet d'ajouter un nouveau créneau à ce jour.
 *
 * @example
 *   <QueueDayColumn day={lundiDay} onAddSlot={handleAdd} onEditSlot={handleEdit} />
 */

'use client'

import { Clock, Loader2, Plus, Trash2 } from 'lucide-react'
import Image from 'next/image'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PLATFORM_CONFIG } from '@/modules/platforms/constants'
import type { LatePlatform } from '@/lib/late'
import { removeQueueSlot } from '@/modules/queue/actions/queue.action'
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

// ─── Composant ───────────────────────────────────────────────────────────────

/**
 * Colonne représentant un jour de la semaine avec ses créneaux.
 * Chaque créneau affiche un badge coloré avec le nom de la plateforme.
 */
export function QueueDayColumn({
  day,
  onAddSlot,
  onEditSlot,
  onMutationSuccess,
}: QueueDayColumnProps): React.JSX.Element {
  const [isPending, startTransition] = useTransition()
  const [pendingSlotId, setPendingSlotId] = useState<string | null>(null)

  /**
   * Supprime un créneau via l'API Zernio (read-modify-write sur le schedule).
   */
  function handleDelete(slot: QueueSlot): void {
    setPendingSlotId(slot.id)
    // Timezone détecté au moment de l'action — reflète la position réelle de l'utilisateur
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
    startTransition(async () => {
      const result = await removeQueueSlot(slot.dayOfWeek, slot.time, slot.platform, timezone)
      setPendingSlotId(null)
      if (result.success) {
        toast.success('Créneau supprimé')
        onMutationSuccess()
      } else {
        toast.error(result.error ?? 'Erreur lors de la suppression')
      }
    })
  }

  const slotCount = day.slots.length

  return (
    <Card className="flex flex-col">
      {/* ── En-tête du jour ─────────────────────────────────────────────── */}
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold">
            {day.label}
          </CardTitle>
          {slotCount > 0 && (
            <Badge variant="secondary" className="text-xs">
              {slotCount} créneau{slotCount > 1 ? 'x' : ''}
            </Badge>
          )}
        </div>
      </CardHeader>

      {/* ── Liste des créneaux ───────────────────────────────────────────── */}
      <CardContent className="flex-1 space-y-2">
        {day.slots.length === 0 ? (
          <p className="text-center text-xs text-muted-foreground py-4">
            Aucun créneau
          </p>
        ) : (
          day.slots.map((slot) => {
            const isSlotPending = pendingSlotId === slot.id
            // Récupérer la config de la plateforme pour la couleur du badge
            const platformConfig = PLATFORM_CONFIG[slot.platform as LatePlatform]

            return (
              <div
                key={slot.id}
                className={`
                  group flex items-center gap-2 rounded-md border p-2 text-sm
                  transition-all cursor-pointer hover:bg-accent/50
                  ${isSlotPending ? 'pointer-events-none opacity-60 animate-pulse' : ''}
                  ${isPending && !isSlotPending ? 'pointer-events-none' : ''}
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
                <span className="font-medium">{slot.time}</span>

                {/* Icône plateforme */}
                {platformConfig && (
                  <Image
                    src={platformConfig.iconPath}
                    alt={platformConfig.label}
                    width={14}
                    height={14}
                    className="size-3.5 shrink-0"
                    title={platformConfig.label}
                  />
                )}

                {/* Spacer */}
                <div className="flex-1" />

                {/* Actions rapides au hover */}
                {isSlotPending ? (
                  <Loader2 className="size-4 animate-spin text-muted-foreground" />
                ) : (
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-6 text-destructive hover:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDelete(slot)
                      }}
                      title="Supprimer"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            )
          })
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
