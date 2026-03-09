/**
 * @file modules/media/components/MediaFolderTabs.tsx
 * @module media
 * @description Tabs horizontaux de navigation par dossier dans la Media Library.
 *
 *   Affiche :
 *   - Tab "Tous" (selectedFolderId = undefined)
 *   - Un tab par dossier avec badge du nombre de médias
 *   - Bouton "+" pour ouvrir NewFolderDialog
 *
 *   Le tab actif est contrôlé par selectedFolderId venant du composant parent.
 *   La sélection d'un tab appelle onSelect pour mettre à jour l'état parent.
 *
 *   Utilisé dans : MediaLibraryContent
 *
 * @example
 *   <MediaFolderTabs
 *     folders={folders}
 *     selectedFolderId={selectedFolderId}
 *     onSelect={setSelectedFolderId}
 *     onFolderCreated={(f) => setFolders((prev) => [...prev, f])}
 *   />
 */

'use client'

import { useState } from 'react'
import { FolderOpen, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

import { Button } from '@/components/ui/button'
import { NewFolderDialog } from './NewFolderDialog'
import type { MediaFolder } from '@/modules/media/types'

// ─── Props ────────────────────────────────────────────────────────────────────

interface MediaFolderTabsProps {
  /** Liste des dossiers à afficher */
  folders: MediaFolder[]
  /**
   * ID du dossier sélectionné.
   * - undefined : tab "Tous" actif
   * - string    : dossier spécifique actif
   */
  selectedFolderId: string | undefined
  /**
   * Callback de sélection de tab.
   * @param folderId - ID du dossier sélectionné, ou undefined pour "Tous"
   */
  onSelect: (folderId: string | undefined) => void
  /**
   * Callback après création d'un nouveau dossier.
   * Permet au parent de mettre à jour sa liste sans recharger.
   *
   * @param folder - Le dossier nouvellement créé
   */
  onFolderCreated: (folder: MediaFolder) => void
}

// ─── Composant ────────────────────────────────────────────────────────────────

/**
 * Bande de tabs dossiers + bouton création.
 */
export function MediaFolderTabs({
  folders,
  selectedFolderId,
  onSelect,
  onFolderCreated,
}: MediaFolderTabsProps): React.JSX.Element {
  /** Contrôle l'affichage du dialog de création de dossier */
  const [showNewFolder, setShowNewFolder] = useState(false)

  return (
    <>
      {/* ── Bande de tabs ────────────────────────────────────────────────── */}
      <div className="flex items-center gap-1 overflow-x-auto border-b border-border pb-0 scrollbar-thin">
        {/* Tab "Tous" */}
        <TabButton
          label="Tous"
          isActive={selectedFolderId === undefined}
          onClick={() => onSelect(undefined)}
        />

        {/* Tab par dossier */}
        {folders.map((folder) => (
          <TabButton
            key={folder.id}
            label={folder.name}
            count={folder._count?.media}
            isActive={selectedFolderId === folder.id}
            onClick={() => onSelect(folder.id)}
            icon={<FolderOpen className="size-3.5" />}
          />
        ))}

        {/* Bouton "+" pour créer un dossier */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setShowNewFolder(true)}
          aria-label="Créer un nouveau dossier"
          className="ml-1 shrink-0 gap-1 px-2 text-muted-foreground"
        >
          <Plus className="size-3.5" />
          <span className="text-xs">Nouveau dossier</span>
        </Button>
      </div>

      {/* ── Dialog de création de dossier ────────────────────────────────── */}
      <NewFolderDialog
        open={showNewFolder}
        onOpenChange={setShowNewFolder}
        onCreated={(folder) => {
          onFolderCreated(folder)
          // Sélectionner automatiquement le nouveau dossier
          onSelect(folder.id)
        }}
      />
    </>
  )
}

// ─── Sous-composant TabButton ─────────────────────────────────────────────────

interface TabButtonProps {
  /** Libellé du tab */
  label: string
  /** Nombre de médias dans ce dossier (optionnel) */
  count?: number
  /** Icône à afficher avant le label (optionnel) */
  icon?: React.ReactNode
  /** Indique si ce tab est actif */
  isActive: boolean
  /** Callback de clic sur le tab */
  onClick: () => void
}

/**
 * Bouton de tab stylé pour la navigation entre dossiers.
 * Utilise un border-bottom pour indiquer l'état actif (style classique d'onglets).
 */
function TabButton({
  label,
  count,
  icon,
  isActive,
  onClick,
}: TabButtonProps): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors',
        isActive
          ? 'border-foreground text-foreground'
          : 'border-transparent text-muted-foreground hover:text-foreground',
      )}
    >
      {icon}
      <span>{label}</span>
      {/* Badge compteur de médias */}
      {count !== undefined && (
        <span
          className={cn(
            'rounded-full px-1.5 py-0 text-xs',
            isActive
              ? 'bg-foreground text-background'
              : 'bg-muted text-muted-foreground',
          )}
        >
          {count}
        </span>
      )}
    </button>
  )
}
