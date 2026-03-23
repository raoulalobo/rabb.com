/**
 * @file modules/queue/components/QueueSlotEditor.tsx
 * @module queue
 * @description Dialog pour ajouter ou modifier un créneau de file d'attente.
 *   En mode création (editingSlot = null), pré-remplit le jour sélectionné.
 *   En mode édition (editingSlot = QueueSlot), pré-remplit tous les champs.
 *   Valide les données avec Zod avant soumission.
 *
 *   Interactions :
 *   - Formulaire avec sélecteurs d'heure, minute et plateforme
 *   - Soumission via Server Action (createQueueSlot / updateQueueSlot)
 *   - Invalidation du cache TanStack Query après succès
 *
 * @example
 *   <QueueSlotEditor
 *     open={isEditorOpen}
 *     onClose={closeEditor}
 *     editingSlot={editingSlot}
 *     selectedDay={selectedDay}
 *     onSuccess={handleSuccess}
 *   />
 */

'use client'

import { useState, useEffect, useTransition } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { createQueueSlot, updateQueueSlot } from '@/modules/queue/actions/queue.action'
import type { QueueSlot } from '@/modules/queue/types'

// ─── Constantes ──────────────────────────────────────────────────────────────

/** Libellés des jours pour le sélecteur */
const DAY_OPTIONS = [
  { value: '1', label: 'Lundi' },
  { value: '2', label: 'Mardi' },
  { value: '3', label: 'Mercredi' },
  { value: '4', label: 'Jeudi' },
  { value: '5', label: 'Vendredi' },
  { value: '6', label: 'Samedi' },
  { value: '0', label: 'Dimanche' },
]

/** Heures disponibles (0-23) */
const HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => ({
  value: String(i),
  label: String(i).padStart(2, '0'),
}))

/** Minutes disponibles par tranches de 15 min */
const MINUTE_OPTIONS = [
  { value: '0', label: '00' },
  { value: '15', label: '15' },
  { value: '30', label: '30' },
  { value: '45', label: '45' },
]

/** Plateformes disponibles pour le filtre (null = toutes) */
const PLATFORM_OPTIONS = [
  { value: 'all', label: 'Toutes les plateformes' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'twitter', label: 'Twitter / X' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'threads', label: 'Threads' },
  { value: 'bluesky', label: 'Bluesky' },
]

// ─── Types ───────────────────────────────────────────────────────────────────

interface QueueSlotEditorProps {
  /** Contrôle l'ouverture du dialog */
  open: boolean
  /** Callback pour fermer le dialog */
  onClose: () => void
  /** Créneau en cours d'édition (null = mode création) */
  editingSlot: QueueSlot | null
  /** Jour pré-sélectionné en mode création */
  selectedDay: number | null
  /** Callback après une mutation réussie (invalidation cache) */
  onSuccess: () => void
}

// ─── Composant ───────────────────────────────────────────────────────────────

/**
 * Dialog de création/édition d'un créneau de file d'attente.
 * Gère les deux modes (création et édition) avec un formulaire unifié.
 *
 * @param props - Props du composant
 * @returns Dialog avec formulaire de créneau
 */
export function QueueSlotEditor({
  open,
  onClose,
  editingSlot,
  selectedDay,
  onSuccess,
}: QueueSlotEditorProps): React.JSX.Element {
  const [isPending, startTransition] = useTransition()

  // ── État local du formulaire ────────────────────────────────────────────────
  const [dayOfWeek, setDayOfWeek] = useState<string>('1')
  const [hour, setHour] = useState<string>('9')
  const [minute, setMinute] = useState<string>('0')
  const [platform, setPlatform] = useState<string>('all')

  // ── Synchronisation avec les props ──────────────────────────────────────────
  // Quand le dialog s'ouvre, pré-remplir les champs selon le mode
  useEffect(() => {
    if (!open) return

    if (editingSlot) {
      // Mode édition : charger les valeurs du créneau existant
      setDayOfWeek(String(editingSlot.dayOfWeek))
      setHour(String(editingSlot.hour))
      setMinute(String(editingSlot.minute))
      setPlatform(editingSlot.platform ?? 'all')
    } else {
      // Mode création : pré-remplir le jour sélectionné, heure par défaut 9h00
      setDayOfWeek(String(selectedDay ?? 1))
      setHour('9')
      setMinute('0')
      setPlatform('all')
    }
  }, [open, editingSlot, selectedDay])

  // ── Soumission du formulaire ────────────────────────────────────────────────

  /**
   * Soumet le formulaire de création ou d'édition.
   * Appelle la Server Action appropriée et gère les retours.
   */
  function handleSubmit(): void {
    const data = {
      dayOfWeek: Number(dayOfWeek),
      hour: Number(hour),
      minute: Number(minute),
      platform: platform === 'all' ? null : platform,
    }

    startTransition(async () => {
      if (editingSlot) {
        // Mode édition
        const result = await updateQueueSlot({ ...data, id: editingSlot.id })
        if (result.success) {
          toast.success('Créneau modifié')
          onSuccess()
          onClose()
        } else {
          toast.error(result.error ?? 'Erreur lors de la modification')
        }
      } else {
        // Mode création
        const result = await createQueueSlot(data)
        if (result.success) {
          toast.success('Créneau créé')
          onSuccess()
          onClose()
        } else {
          toast.error(result.error ?? 'Erreur lors de la création')
        }
      }
    })
  }

  // ── Titre dynamique selon le mode ───────────────────────────────────────────
  const isEditing = editingSlot !== null
  const title = isEditing ? 'Modifier le créneau' : 'Nouveau créneau'
  const description = isEditing
    ? 'Modifiez les paramètres de ce créneau horaire.'
    : 'Ajoutez un créneau récurrent pour programmer automatiquement vos posts.'

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {/* ── Formulaire ─────────────────────────────────────────────────── */}
        <div className="space-y-4 py-4">
          {/* Sélecteur de jour */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Jour</label>
            <Select value={dayOfWeek} onValueChange={setDayOfWeek}>
              <SelectTrigger>
                <SelectValue placeholder="Choisir un jour" />
              </SelectTrigger>
              <SelectContent>
                {DAY_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Sélecteurs d'heure et minute côte à côte */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <label className="text-sm font-medium">Heure</label>
              <Select value={hour} onValueChange={setHour}>
                <SelectTrigger>
                  <SelectValue placeholder="Heure" />
                </SelectTrigger>
                <SelectContent>
                  {HOUR_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}h
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Minute</label>
              <Select value={minute} onValueChange={setMinute}>
                <SelectTrigger>
                  <SelectValue placeholder="Minute" />
                </SelectTrigger>
                <SelectContent>
                  {MINUTE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Sélecteur de plateforme */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Plateforme</label>
            <Select value={platform} onValueChange={setPlatform}>
              <SelectTrigger>
                <SelectValue placeholder="Choisir une plateforme" />
              </SelectTrigger>
              <SelectContent>
                {PLATFORM_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Optionnel — laissez &quot;Toutes les plateformes&quot; pour un créneau universel.
            </p>
          </div>
        </div>

        {/* ── Footer avec boutons ──────────────────────────────────────── */}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Annuler
          </Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending
              ? 'Enregistrement...'
              : isEditing
                ? 'Enregistrer'
                : 'Créer le créneau'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
