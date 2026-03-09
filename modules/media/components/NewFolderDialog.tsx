/**
 * @file modules/media/components/NewFolderDialog.tsx
 * @module media
 * @description Dialog de création d'un nouveau dossier de galerie.
 *
 *   Affiche un formulaire avec un champ Input (nom du dossier) et un bouton Créer.
 *   Appelle la Server Action `createFolder(name)` puis notifie le parent via `onCreated`.
 *
 *   Utilisé dans : MediaFolderTabs (bouton "+")
 *                  MediaLibraryContent (bouton header "New Folder")
 *
 * @example
 *   <NewFolderDialog
 *     open={showNewFolder}
 *     onOpenChange={setShowNewFolder}
 *     onCreated={(folder) => setFolders((prev) => [...prev, folder])}
 *   />
 */

'use client'

import { useState } from 'react'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createFolder } from '@/modules/media/actions/media.action'
import type { MediaFolder } from '@/modules/media/types'

// ─── Props ────────────────────────────────────────────────────────────────────

interface NewFolderDialogProps {
  /** Contrôle l'affichage du dialog */
  open: boolean
  /** Callback de fermeture/ouverture du dialog */
  onOpenChange: (open: boolean) => void
  /**
   * Callback appelé après la création réussie du dossier.
   * Permet au parent de mettre à jour sa liste de dossiers sans recharger la page.
   *
   * @param folder - Le dossier nouvellement créé
   */
  onCreated: (folder: MediaFolder) => void
}

// ─── Composant ────────────────────────────────────────────────────────────────

/**
 * Dialog de création d'un dossier de galerie.
 * Validation minimale côté client (non vide) + validation Zod dans la Server Action.
 */
export function NewFolderDialog({
  open,
  onOpenChange,
  onCreated,
}: NewFolderDialogProps): React.JSX.Element {
  /** Valeur du champ nom du dossier */
  const [name, setName] = useState('')
  /** Message d'erreur retourné par la Server Action */
  const [error, setError] = useState<string | null>(null)
  /** Indique si la création est en cours */
  const [isLoading, setIsLoading] = useState(false)

  /**
   * Soumet la création du dossier.
   * Réinitialise le formulaire en cas de succès.
   */
  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (!name.trim()) {
      setError('Le nom du dossier est requis')
      return
    }

    setIsLoading(true)
    setError(null)

    const { data, error: actionError } = await createFolder(name.trim())

    setIsLoading(false)

    if (actionError || !data) {
      setError(actionError ?? 'Une erreur est survenue')
      return
    }

    // Réinitialiser le formulaire + fermer le dialog
    setName('')
    onCreated(data)
    onOpenChange(false)
  }

  /**
   * Réinitialise l'état interne à la fermeture du dialog.
   */
  const handleOpenChange = (nextOpen: boolean): void => {
    if (!nextOpen) {
      setName('')
      setError(null)
    }
    onOpenChange(nextOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nouveau dossier</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* ── Champ nom ───────────────────────────────────────────────── */}
          <div className="space-y-1.5">
            <Label htmlFor="folder-name">Nom du dossier</Label>
            <Input
              id="folder-name"
              type="text"
              placeholder="ex: Campagne Printemps"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={50}
              autoFocus
              disabled={isLoading}
            />
            {/* Message d'erreur inline */}
            {error && (
              <p className="text-xs text-destructive">{error}</p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => handleOpenChange(false)}
              disabled={isLoading}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={isLoading || !name.trim()}>
              {isLoading ? 'Création…' : 'Créer'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
