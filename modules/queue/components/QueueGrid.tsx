/**
 * @file modules/queue/components/QueueGrid.tsx
 * @module queue
 * @description Grille 7 jours affichant les créneaux de la file d'attente.
 *   Orchestrateur principal du module queue côté client.
 *   Combine le hook useQueueSlots (données), le store Zustand (état UI),
 *   les composants QueueDayColumn (colonnes) et QueueSlotEditor (dialog).
 *
 *   Interactions :
 *   - Clic sur "Ajouter" dans une colonne → ouvre le dialog en mode création
 *   - Clic sur un créneau → ouvre le dialog en mode édition
 *   - Actions rapides (toggle, supprimer) directement dans les colonnes
 *   - Invalidation automatique du cache TanStack après chaque mutation
 *
 * @example
 *   // Utilisé dans app/(dashboard)/queue/page.tsx
 *   <QueueGrid />
 */

'use client'

import { useQueryClient } from '@tanstack/react-query'
import { CalendarClock } from 'lucide-react'

import { useQueueSlots } from '@/modules/queue/hooks/useQueueSlots'
import { queueQueryKeys } from '@/modules/queue/queries/queue.queries'
import { useQueueStore } from '@/modules/queue/store/queue.store'

import { QueueDayColumn } from './QueueDayColumn'
import { QueueSlotEditor } from './QueueSlotEditor'

// ─── Composant ───────────────────────────────────────────────────────────────

/**
 * Grille de 7 jours affichant les créneaux de file d'attente.
 * Layout responsive : 7 colonnes sur desktop, 2 colonnes sur tablette, 1 sur mobile.
 * Gère l'état du dialog d'édition via le store Zustand.
 *
 * @returns Grille de créneaux avec dialog d'édition
 */
export function QueueGrid(): React.JSX.Element {
  const queryClient = useQueryClient()

  // ── Données : créneaux groupés par jour ────────────────────────────────────
  const { days, isLoading } = useQueueSlots()

  // ── État UI : dialog d'édition/création ────────────────────────────────────
  const {
    selectedDay,
    editingSlot,
    isEditorOpen,
    openCreateEditor,
    openEditEditor,
    closeEditor,
  } = useQueueStore()

  // ── Callback : invalider le cache après une mutation ───────────────────────
  /**
   * Invalide la query TanStack des créneaux pour déclencher un re-fetch.
   * Appelé après chaque création, modification ou suppression réussie.
   */
  function handleMutationSuccess(): void {
    queryClient.invalidateQueries({ queryKey: queueQueryKeys.slots() })
  }

  // ── Skeleton de chargement ─────────────────────────────────────────────────
  if (isLoading) {
    return <QueueGridSkeleton />
  }

  // ── Comptage total des créneaux ─────────────────────────────────────────────
  const totalActive = days.reduce(
    (acc, day) => acc + day.slots.length,
    0,
  )

  return (
    <>
      {/* ── Info résumé ──────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
        <CalendarClock className="size-4" />
        <span>
          {totalActive === 0
            ? 'Aucun créneau actif — ajoutez des créneaux pour programmer vos posts automatiquement.'
            : `${totalActive} créneau${totalActive > 1 ? 'x' : ''} actif${totalActive > 1 ? 's' : ''} cette semaine.`}
        </span>
      </div>

      {/* ── Grille 7 jours ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-7">
        {days.map((day) => (
          <QueueDayColumn
            key={day.dayOfWeek}
            day={day}
            onAddSlot={openCreateEditor}
            onEditSlot={openEditEditor}
            onMutationSuccess={handleMutationSuccess}
          />
        ))}
      </div>

      {/* ── Dialog d'édition/création ────────────────────────────────────── */}
      <QueueSlotEditor
        open={isEditorOpen}
        onClose={closeEditor}
        editingSlot={editingSlot}
        selectedDay={selectedDay}
        onSuccess={handleMutationSuccess}
      />
    </>
  )
}

// ─── Skeleton inline (pour le chargement initial) ────────────────────────────

/**
 * Skeleton de la grille de file d'attente.
 * Affiche 7 colonnes de cartes avec des placeholders animés.
 * Utilisé pendant le premier chargement des données TanStack Query.
 */
function QueueGridSkeleton(): React.JSX.Element {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-7">
      {Array.from({ length: 7 }).map((_, i) => (
        <div key={i} className="rounded-lg border bg-card p-4 space-y-3">
          {/* En-tête du jour */}
          <div className="flex items-center justify-between">
            <div className="h-4 w-16 rounded bg-muted animate-pulse" />
            <div className="h-5 w-12 rounded-full bg-muted animate-pulse" />
          </div>
          {/* 2 créneaux placeholder */}
          <div className="space-y-2">
            <div className="h-9 w-full rounded-md bg-muted animate-pulse" />
            <div className="h-9 w-full rounded-md bg-muted animate-pulse" />
          </div>
          {/* Bouton ajouter */}
          <div className="h-8 w-full rounded-md border border-dashed bg-muted/30 animate-pulse" />
        </div>
      ))}
    </div>
  )
}
