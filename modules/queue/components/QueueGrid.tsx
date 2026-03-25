/**
 * @file modules/queue/components/QueueGrid.tsx
 * @module queue
 * @description Grille 7 jours affichant les créneaux de la file d'attente.
 *   Orchestrateur principal du module queue côté client.
 *   Supporte le filtrage par plateforme via des onglets en haut de la grille.
 *
 *   Interactions :
 *   - Onglets de filtre par plateforme (Toutes / Instagram / LinkedIn / ...)
 *   - Clic sur "Ajouter" dans une colonne → ouvre le dialog en mode création
 *   - Clic sur un créneau → ouvre le dialog en mode édition
 *   - Actions rapides (supprimer) directement dans les colonnes
 *   - Invalidation automatique du cache TanStack après chaque mutation
 *
 * @example
 *   <QueueGrid />
 */

'use client'

import { useQueryClient } from '@tanstack/react-query'
import { CalendarClock } from 'lucide-react'

import { cn } from '@/lib/utils'
import { PLATFORM_CONFIG } from '@/modules/platforms/constants'
import type { LatePlatform } from '@/lib/late'
import { useQueueSlots } from '@/modules/queue/hooks/useQueueSlots'
import { queueQueryKeys } from '@/modules/queue/queries/queue.queries'
import { useQueueStore } from '@/modules/queue/store/queue.store'

import { QueueDayColumn } from './QueueDayColumn'
import { QueueSlotEditor } from './QueueSlotEditor'

// ─── Composant ───────────────────────────────────────────────────────────────

/**
 * Grille de 7 jours affichant les créneaux de file d'attente.
 * Inclut un filtre par plateforme sous forme d'onglets.
 *
 * @returns Grille de créneaux avec filtre plateforme et dialog d'édition
 */
export function QueueGrid(): React.JSX.Element {
  const queryClient = useQueryClient()

  // ── État UI : filtre plateforme + dialog ──────────────────────────────────
  const {
    selectedDay,
    editingSlot,
    isEditorOpen,
    openCreateEditor,
    openEditEditor,
    closeEditor,
    filterPlatform,
    setFilterPlatform,
  } = useQueueStore()

  // ── Données : créneaux groupés par jour (filtrés par plateforme) ──────────
  const { days, platforms, isLoading } = useQueueSlots(filterPlatform)

  // ── Callback : invalider le cache après une mutation ───────────────────────
  function handleMutationSuccess(): void {
    queryClient.invalidateQueries({ queryKey: queueQueryKeys.slots() })
  }

  // ── Skeleton de chargement ─────────────────────────────────────────────────
  if (isLoading) {
    return <QueueGridSkeleton />
  }

  // ── Comptage total des créneaux affichés ──────────────────────────────────
  const totalActive = days.reduce((acc, day) => acc + day.slots.length, 0)

  return (
    <>
      {/* ── Filtre par plateforme (onglets) ────────────────────────────── */}
      {platforms.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-4">
          {/* Onglet "Toutes" */}
          <button
            type="button"
            onClick={() => setFilterPlatform(null)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
              filterPlatform === null
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80',
            )}
          >
            Toutes
          </button>

          {/* Un onglet par plateforme détectée */}
          {platforms.map((p) => {
            const config = PLATFORM_CONFIG[p as LatePlatform]
            const isActive = filterPlatform === p

            return (
              <button
                key={p}
                type="button"
                onClick={() => setFilterPlatform(isActive ? null : p)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
                  isActive
                    ? 'text-white'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80',
                )}
                style={isActive && config ? { backgroundColor: config.color } : undefined}
              >
                {config && (
                  <span
                    className="size-2 rounded-full"
                    style={{ backgroundColor: isActive ? '#fff' : config.color }}
                  />
                )}
                {config?.label ?? p}
              </button>
            )
          })}
        </div>
      )}

      {/* ── Info résumé ──────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
        <CalendarClock className="size-4" />
        <span>
          {totalActive === 0
            ? 'Aucun créneau actif — ajoutez des créneaux pour programmer vos posts automatiquement.'
            : `${totalActive} créneau${totalActive > 1 ? 'x' : ''} actif${totalActive > 1 ? 's' : ''} cette semaine${filterPlatform ? ` pour ${PLATFORM_CONFIG[filterPlatform as LatePlatform]?.label ?? filterPlatform}` : ''}.`}
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
 */
function QueueGridSkeleton(): React.JSX.Element {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-7">
      {Array.from({ length: 7 }).map((_, i) => (
        <div key={i} className="rounded-lg border bg-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="h-4 w-16 rounded bg-muted animate-pulse" />
            <div className="h-5 w-12 rounded-full bg-muted animate-pulse" />
          </div>
          <div className="space-y-2">
            <div className="h-9 w-full rounded-md bg-muted animate-pulse" />
            <div className="h-9 w-full rounded-md bg-muted animate-pulse" />
          </div>
          <div className="h-8 w-full rounded-md border border-dashed bg-muted/30 animate-pulse" />
        </div>
      ))}
    </div>
  )
}
