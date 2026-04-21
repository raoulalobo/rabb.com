/**
 * @file modules/biolink/components/BioPageEditor/LinksSection.tsx
 * @module biolink/components/BioPageEditor
 * @description Section "Liens" de l'éditeur — liste triable de BioLinks.
 *
 *   Fonctionnalités :
 *   - Affiche tous les liens (actifs + inactifs) triés par position
 *   - Drag & drop via @dnd-kit/sortable → au drop, appelle `reorderBioLinks`
 *   - Bouton "+ Ajouter un lien" → `createBioLink` avec valeurs par défaut
 *   - Chaque row (LinkRow) gère ses propres mutations
 *
 *   Le composant maintient sa propre copie triée des liens pour permettre un
 *   re-render immédiat au drop sans attendre le round-trip serveur (UX).
 *   Après le round-trip, `onMutation` (→ router.refresh()) met à jour
 *   l'initialData du parent et donc la liste définitive.
 *
 * @example
 *   <LinksSection
 *     bioPageId={bioPage.id}
 *     initialLinks={bioPage.links}
 *     onMutation={() => router.refresh()}
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
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { Loader2, Plus } from 'lucide-react'
import { useEffect, useState, useTransition } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { createBioLink } from '@/modules/biolink/actions/create-biolink.action'
import { reorderBioLinks } from '@/modules/biolink/actions/reorder-biolinks.action'

import { LinkRow } from './LinkRow'

import type { BioLink } from '@prisma/client'

// ─── Types ───────────────────────────────────────────────────────────────────

interface LinksSectionProps {
  /** ID de la BioPage parente (requis par createBioLink) */
  bioPageId: string
  /** Liens initiaux (déjà triés par position ASC — garanti par le parent) */
  initialLinks: BioLink[]
  /** Callback post-mutation — typiquement router.refresh() */
  onMutation: () => void
}

// ─── Composant ───────────────────────────────────────────────────────────────

/**
 * Section Liens — orchestrateur du DnD et du bouton d'ajout.
 *
 * @returns Card avec liste triable + bouton "Ajouter un lien"
 */
export function LinksSection({
  bioPageId,
  initialLinks,
  onMutation,
}: LinksSectionProps): React.JSX.Element {
  // Copie locale triable — sync avec initialLinks quand le parent refresh
  const [links, setLinks] = useState<BioLink[]>(initialLinks)

  // Sync quand le Server Component parent re-render (router.refresh())
  useEffect(() => {
    setLinks(initialLinks)
  }, [initialLinks])

  const [isAdding, startAdding] = useTransition()

  /**
   * ID du lien fraîchement créé — passé en prop `isNew` au `LinkRow` correspondant
   * pour qu'il déclenche un focus + scroll sur son input URL au mount.
   * Reset après un court délai pour éviter un refocus lors de re-renders ultérieurs
   * (ex: `router.refresh()` déclenche un re-render — on ne veut pas refocus).
   */
  const [newLinkId, setNewLinkId] = useState<string | null>(null)

  // Configuration des sensors — Pointer pour souris/tactile, Keyboard pour a11y
  const sensors = useSensors(
    useSensor(PointerSensor, {
      // Seuil de 4px avant de démarrer le drag — évite les drags accidentels
      // quand l'user veut juste cliquer dans un input de la row.
      activationConstraint: { distance: 4 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  // ── Handler : fin de drag ──────────────────────────────────────────────
  /**
   * Appelé par DndContext quand l'user relâche une row déplacée.
   * - Si pas de changement de position → ignore.
   * - Sinon : reorder optimiste + appel Server Action `reorderBioLinks`.
   *   En cas d'erreur, on rollback visuellement.
   */
  const handleDragEnd = async (event: DragEndEvent): Promise<void> => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = links.findIndex((l) => l.id === active.id)
    const newIndex = links.findIndex((l) => l.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return

    // Optimistic update — réordonne localement avant le round-trip
    const reordered = arrayMove(links, oldIndex, newIndex)
    setLinks(reordered)

    const res = await reorderBioLinks({ ids: reordered.map((l) => l.id) })
    if (!res.success) {
      toast.error(res.error)
      // Rollback — remet l'ancien ordre
      setLinks(links)
      return
    }
    onMutation()
  }

  // ── Handler : ajout d'un nouveau lien ───────────────────────────────────
  /**
   * Crée un BioLink avec des valeurs par défaut. L'user peut ensuite
   * éditer les champs via le LinkRow directement.
   *
   * Note : l'URL par défaut est `https://example.com` car l'action serveur
   * (Zod) exige une URL valide — la chaîne vide serait refusée.
   */
  const handleAddLink = (): void => {
    startAdding(async () => {
      const res = await createBioLink({
        bioPageId,
        title: 'Nouveau lien',
        url: 'https://example.com',
        kind: 'glass',
        isActive: true,
      })
      if (!res.success) {
        toast.error(res.error)
        return
      }
      toast.success('Lien ajouté')
      // Mémorise l'ID pour déclencher le focus + scroll dans le LinkRow cible,
      // puis reset après 500ms pour ne pas refocus lors d'un re-render ultérieur.
      setNewLinkId(res.data.id)
      window.setTimeout(() => setNewLinkId(null), 500)
      onMutation()
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Liens</CardTitle>
        <CardDescription>
          Ajoutez les liens à afficher sur votre page. Glissez-déposez pour les réordonner.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {links.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            Aucun lien pour le moment. Ajoutez-en un pour commencer.
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={links.map((l) => l.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-2">
                {links.map((link) => (
                  <LinkRow
                    key={link.id}
                    link={link}
                    onMutation={onMutation}
                    isNew={link.id === newLinkId}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}

        <div className="flex justify-center pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleAddLink}
            disabled={isAdding}
          >
            {isAdding ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Ajout...
              </>
            ) : (
              <>
                <Plus className="size-4" />
                Ajouter un lien
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
