/**
 * @file modules/media/components/TagsDialog.tsx
 * @module media
 * @description Dialog de gestion des tags colorés de la galerie.
 *
 *   Affiche la liste des tags existants (badge coloré + bouton supprimer) et
 *   un formulaire inline pour créer un nouveau tag (nom + palette de couleurs prédéfinies).
 *
 *   Actions déclenchées :
 *   - `createTag(name, color)` → ajoute le tag à la liste
 *   - `deleteTag(id)`          → retire le tag de la liste
 *
 *   Utilisé dans : MediaLibraryContent (bouton header "Tags")
 *
 * @example
 *   <TagsDialog
 *     open={showTags}
 *     onOpenChange={setShowTags}
 *     tags={tags}
 *     onTagCreated={(tag) => setTags((prev) => [...prev, tag])}
 *     onTagDeleted={(id) => setTags((prev) => prev.filter((t) => t.id !== id))}
 *   />
 */

'use client'

import { useState } from 'react'
import { X } from 'lucide-react'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createTag, deleteTag } from '@/modules/media/actions/media.action'
import type { MediaTag } from '@/modules/media/types'

// ─── Couleurs prédéfinies ─────────────────────────────────────────────────────

/**
 * Palette de couleurs proposée pour les tags.
 * Chaque couleur a un label accessible pour le title de la pastille.
 */
const PRESET_COLORS: { color: string; label: string }[] = [
  { color: '#6366f1', label: 'Indigo' },
  { color: '#22c55e', label: 'Vert' },
  { color: '#f59e0b', label: 'Ambre' },
  { color: '#ef4444', label: 'Rouge' },
  { color: '#3b82f6', label: 'Bleu' },
  { color: '#ec4899', label: 'Rose' },
  { color: '#8b5cf6', label: 'Violet' },
  { color: '#14b8a6', label: 'Teal' },
]

// ─── Props ────────────────────────────────────────────────────────────────────

interface TagsDialogProps {
  /** Contrôle l'affichage du dialog */
  open: boolean
  /** Callback de fermeture/ouverture du dialog */
  onOpenChange: (open: boolean) => void
  /** Liste actuelle des tags à afficher */
  tags: MediaTag[]
  /**
   * Callback appelé après la création réussie d'un tag.
   * @param tag - Le tag nouvellement créé
   */
  onTagCreated: (tag: MediaTag) => void
  /**
   * Callback appelé après la suppression réussie d'un tag.
   * @param id - L'ID du tag supprimé
   */
  onTagDeleted: (id: string) => void
}

// ─── Composant ────────────────────────────────────────────────────────────────

/**
 * Dialog de gestion des tags : liste + création + suppression.
 */
export function TagsDialog({
  open,
  onOpenChange,
  tags,
  onTagCreated,
  onTagDeleted,
}: TagsDialogProps): React.JSX.Element {
  /** Valeur du champ nom du nouveau tag */
  const [newName, setNewName] = useState('')
  /** Couleur sélectionnée pour le nouveau tag */
  const [selectedColor, setSelectedColor] = useState(PRESET_COLORS[0]!.color)
  /** Message d'erreur pour le formulaire de création */
  const [createError, setCreateError] = useState<string | null>(null)
  /** Indique si la création est en cours */
  const [isCreating, setIsCreating] = useState(false)
  /** IDs des tags en cours de suppression */
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set())

  /**
   * Soumet la création d'un nouveau tag.
   */
  const handleCreate = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (!newName.trim()) {
      setCreateError('Le nom du tag est requis')
      return
    }

    setIsCreating(true)
    setCreateError(null)

    const { data, error } = await createTag(newName.trim(), selectedColor)

    setIsCreating(false)

    if (error || !data) {
      setCreateError(error ?? 'Une erreur est survenue')
      return
    }

    // Réinitialiser le formulaire de création
    setNewName('')
    setSelectedColor(PRESET_COLORS[0]!.color)
    onTagCreated(data)
  }

  /**
   * Supprime un tag après confirmation (pas de confirm inline ici — action directe).
   *
   * @param id - Identifiant du tag à supprimer
   */
  const handleDelete = async (id: string): Promise<void> => {
    setDeletingIds((prev) => new Set(prev).add(id))

    const { error } = await deleteTag(id)

    setDeletingIds((prev) => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })

    if (!error) {
      onTagDeleted(id)
    }
  }

  /**
   * Réinitialise l'état interne à la fermeture.
   */
  const handleOpenChange = (nextOpen: boolean): void => {
    if (!nextOpen) {
      setNewName('')
      setCreateError(null)
    }
    onOpenChange(nextOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Gérer les tags</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* ── Liste des tags existants ─────────────────────────────────── */}
          <div className="space-y-2">
            {tags.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aucun tag créé pour l'instant.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <div
                    key={tag.id}
                    className="flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-sm"
                    style={{ borderColor: tag.color, color: tag.color }}
                  >
                    {/* Pastille de couleur */}
                    <span
                      className="size-2 rounded-full"
                      style={{ backgroundColor: tag.color }}
                    />
                    <span className="font-medium">{tag.name}</span>
                    {/* Bouton suppression */}
                    <button
                      type="button"
                      onClick={() => handleDelete(tag.id)}
                      disabled={deletingIds.has(tag.id)}
                      aria-label={`Supprimer le tag ${tag.name}`}
                      className="ml-0.5 rounded-full text-muted-foreground transition-colors hover:text-destructive disabled:opacity-50"
                    >
                      <X className="size-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Séparateur ───────────────────────────────────────────────── */}
          <hr className="border-border" />

          {/* ── Formulaire de création ───────────────────────────────────── */}
          <form onSubmit={handleCreate} className="space-y-3">
            <Label className="text-sm font-medium">Nouveau tag</Label>

            {/* Nom du tag */}
            <Input
              type="text"
              placeholder="ex: Été, Promo, Urgent…"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              maxLength={30}
              disabled={isCreating}
            />

            {/* Palette de couleurs prédéfinies */}
            <div className="flex flex-wrap gap-2">
              {PRESET_COLORS.map(({ color, label }) => (
                <button
                  key={color}
                  type="button"
                  title={label}
                  onClick={() => setSelectedColor(color)}
                  aria-label={`Couleur ${label}`}
                  aria-pressed={selectedColor === color}
                  className="size-6 rounded-full border-2 transition-transform hover:scale-110"
                  style={{
                    backgroundColor: color,
                    // Bordure blanche + ombre si sélectionné
                    borderColor: selectedColor === color ? 'white' : 'transparent',
                    boxShadow: selectedColor === color ? `0 0 0 2px ${color}` : 'none',
                  }}
                />
              ))}
            </div>

            {/* Prévisualisation du badge */}
            {newName.trim() && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Aperçu :</span>
                <span
                  className="rounded-full border px-2.5 py-0.5 text-xs font-medium"
                  style={{ borderColor: selectedColor, color: selectedColor }}
                >
                  <span
                    className="mr-1 inline-block size-1.5 rounded-full"
                    style={{ backgroundColor: selectedColor }}
                  />
                  {newName.trim()}
                </span>
              </div>
            )}

            {/* Message d'erreur */}
            {createError && (
              <p className="text-xs text-destructive">{createError}</p>
            )}

            <Button
              type="submit"
              size="sm"
              disabled={isCreating || !newName.trim()}
              className="w-full"
            >
              {isCreating ? 'Création…' : 'Ajouter ce tag'}
            </Button>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  )
}
