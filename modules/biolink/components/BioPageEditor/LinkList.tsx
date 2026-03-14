/**
 * @file modules/biolink/components/BioPageEditor/LinkList.tsx
 * @module biolink
 * @description Liste des liens de la BioPage avec drag & drop (dnd-kit).
 *   Utilise DndContext + SortableContext pour permettre le réordonnement
 *   des liens par glisser-déposer. Après un drop, appelle le callback
 *   onReorder avec les nouvelles positions.
 *
 * @example
 *   <LinkList
 *     links={links}
 *     onEdit={(id) => openLinkDialog(id)}
 *     onDelete={(id) => handleDeleteLink(id)}
 *     onToggle={(id) => handleToggleLink(id)}
 *     onAdd={() => openLinkDialog()}
 *     onReorder={(reordered) => handleReorder(reordered)}
 *   />
 */

'use client'

import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { Plus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import type { BioLink } from '@/modules/biolink/types'

import { LinkItem } from './LinkItem'

// ─── Props ────────────────────────────────────────────────────────────────────

interface LinkListProps {
  /** Liste des liens triés par position */
  links: BioLink[]
  /** Callback d'édition d'un lien (ouvre le dialog) */
  onEdit: (linkId: string) => void
  /** Callback de suppression d'un lien */
  onDelete: (linkId: string) => void
  /** Callback de toggle visibilité d'un lien */
  onToggle: (linkId: string) => void
  /** Callback d'ajout d'un nouveau lien (ouvre le dialog vide) */
  onAdd: () => void
  /** Callback de réordonnement après drag & drop (nouveau tableau ordonné) */
  onReorder: (reorderedLinks: BioLink[]) => void
}

// ─── Composant ────────────────────────────────────────────────────────────────

/**
 * Liste ordonnée des liens avec drag & drop via dnd-kit.
 * DndContext gère les événements de drag, SortableContext fournit le contexte
 * de tri aux composants enfants (LinkItem via useSortable).
 *
 * Après un drop, les items sont réordonnés localement via arrayMove
 * puis le callback onReorder est appelé avec le nouveau tableau.
 *
 * @param links     - Tableau de BioLink triés par position
 * @param onEdit    - Ouvre le dialog d'édition pour un lien
 * @param onDelete  - Supprime un lien
 * @param onToggle  - Bascule la visibilité d'un lien
 * @param onAdd     - Ouvre le dialog de création
 * @param onReorder - Callback avec le nouveau tableau après drag & drop
 * @returns Liste sortable de LinkItem + bouton d'ajout
 */
export function LinkList({
  links,
  onEdit,
  onDelete,
  onToggle,
  onAdd,
  onReorder,
}: LinkListProps): React.JSX.Element {
  // Capteurs dnd-kit : pointeur (souris/touch) + clavier (accessibilité)
  const sensors = useSensors(
    useSensor(PointerSensor, {
      // Distance minimale avant activation du drag (évite les clics accidentels)
      activationConstraint: { distance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  /**
   * Gère la fin du drag & drop.
   * Calcule le nouveau tableau via arrayMove et appelle onReorder.
   *
   * @param event - Événement DragEnd de dnd-kit (active = élément déplacé, over = destination)
   */
  function handleDragEnd(event: DragEndEvent): void {
    const { active, over } = event
    if (!over || active.id === over.id) return

    // Trouver les index source et destination
    const oldIndex = links.findIndex((l) => l.id === active.id)
    const newIndex = links.findIndex((l) => l.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return

    // Réordonner le tableau localement
    const reordered = arrayMove(links, oldIndex, newIndex)
    onReorder(reordered)
  }

  // Tableau d'IDs pour SortableContext
  const linkIds = links.map((l) => l.id)

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-foreground">
        Liens ({links.length})
      </h3>

      {/* ── Liste des liens avec drag & drop ────────────────────────── */}
      {links.length > 0 ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={linkIds}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2">
              {links.map((link) => (
                <LinkItem
                  key={link.id}
                  link={link}
                  onEdit={() => onEdit(link.id)}
                  onDelete={() => onDelete(link.id)}
                  onToggle={() => onToggle(link.id)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      ) : (
        <div className="rounded-lg border border-dashed p-6 text-center">
          <p className="text-sm text-muted-foreground">
            Aucun lien pour le moment. Ajoutez votre premier lien !
          </p>
        </div>
      )}

      {/* ── Bouton ajouter ───────────────────────────────────────────── */}
      <Button
        type="button"
        variant="outline"
        onClick={onAdd}
        className="w-full"
      >
        <Plus className="size-4 mr-2" />
        Ajouter un lien
      </Button>
    </div>
  )
}
