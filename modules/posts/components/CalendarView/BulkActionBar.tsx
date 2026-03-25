/**
 * @file modules/posts/components/CalendarView/BulkActionBar.tsx
 * @module posts
 * @description Barre d'actions groupées flottante, visible quand des posts sont sélectionnés.
 *   Positionnée en bas de l'écran (fixed bottom-6), centrée horizontalement.
 *
 *   Actions disponibles :
 *   - Modifier le contenu : ouvre un Sheet avec un éditeur texte + upload médias
 *   - Replanifier         : ouvre un Sheet avec DateTimePicker
 *   - Brouillon           : AlertDialog de confirmation → passe en DRAFT
 *   - Supprimer           : AlertDialog de confirmation → supprime
 *   - Annuler             : quitte le mode sélection (sans action)
 *
 *   Upload médias :
 *   Via /api/posts/upload-url (POST presigned URL) puis PUT vers Supabase Storage.
 *   Les URLs publiques résultantes sont passées à onEditContent.
 *
 * @example
 *   <BulkActionBar
 *     selectedCount={3}
 *     onEditContent={handleBulkEditContent}
 *     onReschedule={handleBulkReschedule}
 *     onMakeDraft={handleBulkMakeDraft}
 *     onDelete={handleBulkDelete}
 *     onCancel={exitSelectMode}
 *     isLoading={isBulkLoading}
 *   />
 */

'use client'

import { CalendarIcon, FileText, ListOrdered, Loader2, PenLine, Trash2, X } from 'lucide-react'
import { useRef, useState } from 'react'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import { DateTimePicker } from '@/modules/posts/components/PostComposer/DateTimePicker'

// ─── Props ────────────────────────────────────────────────────────────────────

interface BulkActionBarProps {
  /** Nombre de posts actuellement sélectionnés */
  selectedCount: number
  /**
   * Callback pour l'édition de contenu groupée.
   * Reçoit le texte (undefined si non modifié), le mode ('replace'|'append'),
   * et les URLs des médias uploadés.
   *
   * @param text      - Nouveau texte à appliquer (undefined = ne pas toucher au texte)
   * @param textMode  - Mode d'application du texte
   * @param mediaUrls - URLs des médias à appliquer (tableau vide = ne pas toucher)
   */
  onEditContent?: (
    text: string | undefined,
    textMode: 'replace' | 'append',
    mediaUrls: string[],
  ) => Promise<void>
  /**
   * Callback pour la replanification groupée.
   *
   * @param newDate - Nouvelle date de planification
   */
  onReschedule: (newDate: Date) => Promise<void>
  /** Callback pour ajouter les posts sélectionnés à la file d'attente */
  onEnqueue?: () => Promise<void>
  /** Callback pour passer tous les posts sélectionnés en DRAFT */
  onMakeDraft: () => Promise<void>
  /** Callback pour supprimer tous les posts sélectionnés */
  onDelete: () => Promise<void>
  /** Quitte le mode sélection sans effectuer d'action */
  onCancel: () => void
  /** true pendant une opération en cours — désactive tous les boutons */
  isLoading: boolean
}

// ─── Composant ────────────────────────────────────────────────────────────────

/**
 * Barre flottante d'actions groupées.
 * Visible uniquement quand selectedCount > 0.
 * Contient les Sheets "Modifier" et "Replanifier" + les AlertDialogs "Brouillon" et "Supprimer".
 *
 * @param selectedCount - Nombre de posts sélectionnés
 * @param onEditContent - Callback d'édition de contenu groupée
 * @param onReschedule  - Callback de replanification groupée
 * @param onMakeDraft   - Callback passage en brouillon groupé
 * @param onDelete      - Callback suppression groupée
 * @param onCancel      - Quitter le mode sélection
 * @param isLoading     - Opération en cours (désactive les boutons)
 */
export function BulkActionBar({
  selectedCount,
  onEditContent,
  onEnqueue,
  onReschedule,
  onMakeDraft,
  onDelete,
  onCancel,
  isLoading,
}: BulkActionBarProps): React.JSX.Element {
  // ── État du Sheet "Modifier le contenu" ───────────────────────────────────
  const [editSheetOpen, setEditSheetOpen] = useState(false)
  const [editText, setEditText] = useState('')
  /** Mode d'application du texte : 'replace' = remplace, 'append' = ajoute à la fin */
  const [textMode, setTextMode] = useState<'replace' | 'append'>('replace')
  const [uploadedUrls, setUploadedUrls] = useState<string[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── État du Sheet "Replanifier" ───────────────────────────────────────────
  const [rescheduleSheetOpen, setRescheduleSheetOpen] = useState(false)
  const [rescheduleDate, setRescheduleDate] = useState<Date | null>(null)

  // ─── Upload de fichiers médias ─────────────────────────────────────────────

  /**
   * Gère l'upload de fichiers sélectionnés via l'input file.
   * 1. Demande un presigned URL à /api/posts/upload-url
   * 2. Upload le fichier vers Supabase Storage via PUT
   * 3. Stocke les URLs publiques dans uploadedUrls
   *
   * @param files - Fichiers sélectionnés par l'utilisateur
   */
  async function handleFileUpload(files: FileList | null): Promise<void> {
    if (!files || files.length === 0) return

    setIsUploading(true)
    const newUrls: string[] = []

    for (const file of Array.from(files)) {
      try {
        // Étape 1 : obtenir le presigned URL depuis l'API
        const res = await fetch('/api/posts/upload-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filename: file.name,
            mimeType: file.type,
            size: file.size,
          }),
        })

        if (!res.ok) {
          console.error('[BulkActionBar] Erreur presigned URL:', file.name)
          continue
        }

        const { signedUrl, publicUrl } = await res.json() as { signedUrl: string; publicUrl: string }

        // Étape 2 : upload direct vers Supabase Storage
        const uploadRes = await fetch(signedUrl, {
          method: 'PUT',
          headers: { 'Content-Type': file.type },
          body: file,
        })

        if (uploadRes.ok) {
          newUrls.push(publicUrl)
        } else {
          console.error('[BulkActionBar] Erreur upload:', file.name)
        }
      } catch (err) {
        console.error('[BulkActionBar] Upload échoué pour', file.name, err)
      }
    }

    setUploadedUrls((prev) => [...prev, ...newUrls])
    setIsUploading(false)
  }

  // ─── Soumission "Modifier le contenu" ─────────────────────────────────────

  /**
   * Soumet l'édition de contenu groupée.
   * Ferme le Sheet et réinitialise le formulaire après succès.
   */
  async function handleEditSubmit(): Promise<void> {
    const text = editText.trim() || undefined
    await onEditContent?.(text, textMode, uploadedUrls)
    // Réinitialiser le formulaire
    setEditText('')
    setTextMode('replace')
    setUploadedUrls([])
    setEditSheetOpen(false)
  }

  // ─── Soumission "Replanifier" ──────────────────────────────────────────────

  /**
   * Soumet la replanification groupée.
   * Ferme le Sheet après succès.
   */
  async function handleRescheduleSubmit(): Promise<void> {
    if (!rescheduleDate) return
    await onReschedule(rescheduleDate)
    setRescheduleDate(null)
    setRescheduleSheetOpen(false)
  }

  // ─── Rendu ─────────────────────────────────────────────────────────────────

  return (
    <>
      {/* ── Barre flottante principale ─────────────────────────────────────── */}
      {/*
        Mobile (< sm) : pleine largeur avec marges latérales de 8px (left-2 right-2)
        Desktop (≥ sm) : centrée horizontalement, largeur auto
      */}
      <div
        className="fixed bottom-4 left-2 right-2 z-50 sm:bottom-6 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 flex items-center justify-between sm:justify-start gap-2 rounded-2xl border bg-background/95 px-3 sm:px-4 py-2.5 shadow-2xl backdrop-blur-sm"
        role="toolbar"
        aria-label={`${selectedCount} post${selectedCount > 1 ? 's' : ''} sélectionné${selectedCount > 1 ? 's' : ''}`}
      >
        {/* Bouton Annuler — icône seule sur mobile, icône + texte sur desktop */}
        <Button
          variant="ghost"
          size="sm"
          onClick={onCancel}
          disabled={isLoading}
          className="gap-1.5 px-2 sm:px-3 text-muted-foreground hover:text-foreground"
        >
          <X className="size-3.5" />
          <span className="hidden sm:inline">Annuler</span>
        </Button>

        {/* Séparateur vertical — masqué sur mobile */}
        <div className="hidden sm:block mx-1 h-6 w-px bg-border" />

        {/* Compteur — nombre seul sur mobile, phrase complète sur desktop */}
        <span className="text-sm font-medium tabular-nums">
          <span className="sm:hidden">{selectedCount}</span>
          <span className="hidden sm:inline">
            {selectedCount} sélectionné{selectedCount > 1 ? 's' : ''}
          </span>
        </span>

        {/* Séparateur vertical — masqué sur mobile */}
        <div className="hidden sm:block mx-1 h-6 w-px bg-border" />

        {/* ── Bouton Modifier le contenu ────────────────────────────────────── */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => setEditSheetOpen(true)}
          disabled={isLoading}
          className="gap-1.5 px-2 sm:px-3"
        >
          {isLoading ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <PenLine className="size-3.5" />
          )}
          <span className="hidden sm:inline">Modifier</span>
        </Button>

        {/* ── Bouton Replanifier ────────────────────────────────────────────── */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => setRescheduleSheetOpen(true)}
          disabled={isLoading}
          className="gap-1.5 px-2 sm:px-3"
        >
          <CalendarIcon className="size-3.5" />
          <span className="hidden sm:inline">Replanifier</span>
        </Button>

        {/* ── Bouton File d'attente ──────────────────────────────────────── */}
        {onEnqueue && (
          <Button
            variant="outline"
            size="sm"
            onClick={onEnqueue}
            disabled={isLoading}
            className="gap-1.5 px-2 sm:px-3"
          >
            {isLoading ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <ListOrdered className="size-3.5" />
            )}
            <span className="hidden sm:inline">File d&apos;attente</span>
          </Button>
        )}

        {/* ── Bouton Brouillon (AlertDialog) ───────────────────────────────── */}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              disabled={isLoading}
              className="gap-1.5 px-2 sm:px-3"
            >
              <FileText className="size-3.5" />
              <span className="hidden sm:inline">Brouillon</span>
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Passer en brouillon ?</AlertDialogTitle>
              <AlertDialogDescription>
                {selectedCount} post{selectedCount > 1 ? 's' : ''} seront repassés en brouillon.
                Les planifications seront annulées. Les posts déjà publiés ne seront pas affectés.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuler</AlertDialogCancel>
              <AlertDialogAction onClick={() => void onMakeDraft()}>
                Confirmer
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* ── Bouton Supprimer (AlertDialog) ───────────────────────────────── */}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="destructive"
              size="sm"
              disabled={isLoading}
              className="gap-1.5 px-2 sm:px-3"
            >
              <Trash2 className="size-3.5" />
              <span className="hidden sm:inline">Supprimer</span>
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                Supprimer {selectedCount} post{selectedCount > 1 ? 's' : ''} ?
              </AlertDialogTitle>
              <AlertDialogDescription>
                Cette action est irréversible. Les posts DRAFT, SCHEDULED et FAILED seront supprimés.
                Les posts déjà publiés (PUBLISHED) ne seront pas affectés.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuler</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => void onDelete()}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Supprimer
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {/* ── Sheet "Modifier le contenu" ────────────────────────────────────── */}
      <Sheet open={editSheetOpen} onOpenChange={setEditSheetOpen}>
        <SheetContent side="right" className="w-full max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>
              Modifier {selectedCount} post{selectedCount > 1 ? 's' : ''} sélectionné{selectedCount > 1 ? 's' : ''}
            </SheetTitle>
            <SheetDescription>
              Appliquez un texte ou des médias communs aux posts sélectionnés.
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-6">
            {/* Zone de texte */}
            <div className="space-y-2">
              <Label htmlFor="bulk-edit-text">Nouveau texte commun</Label>
              <Textarea
                id="bulk-edit-text"
                placeholder="Texte à appliquer à tous les posts sélectionnés…"
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                className="min-h-[120px] resize-y"
              />
            </div>

            {/* Mode d'application du texte — boutons toggle (pas de radio-group Radix) */}
            <div className="space-y-3">
              <Label>Mode d&apos;application</Label>
              <div className="flex gap-2">
                {/* Bouton "Remplacer" */}
                <button
                  type="button"
                  onClick={() => setTextMode('replace')}
                  aria-pressed={textMode === 'replace'}
                  className={[
                    'flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition-all cursor-pointer',
                    textMode === 'replace'
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border bg-background text-muted-foreground hover:bg-accent/50',
                  ].join(' ')}
                >
                  Remplacer le texte
                </button>
                {/* Bouton "Ajouter à la fin" */}
                <button
                  type="button"
                  onClick={() => setTextMode('append')}
                  aria-pressed={textMode === 'append'}
                  className={[
                    'flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition-all cursor-pointer',
                    textMode === 'append'
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border bg-background text-muted-foreground hover:bg-accent/50',
                  ].join(' ')}
                >
                  Ajouter à la fin
                </button>
              </div>
            </div>

            {/* Séparateur */}
            <div className="border-t" />

            {/* Upload médias */}
            <div className="space-y-2">
              <Label>Médias (remplace les médias existants)</Label>
              <p className="text-xs text-muted-foreground">
                Les médias choisis remplaceront les médias actuels de chaque post sélectionné.
              </p>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,video/*"
                className="hidden"
                onChange={(e) => void handleFileUpload(e.target.files)}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="w-full gap-2"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    Upload en cours…
                  </>
                ) : (
                  'Choisir des fichiers…'
                )}
              </Button>

              {/* Nombre de fichiers prêts à uploader */}
              {uploadedUrls.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {uploadedUrls.length} fichier{uploadedUrls.length > 1 ? 's' : ''} prêt{uploadedUrls.length > 1 ? 's' : ''}
                </p>
              )}
            </div>

            {/* Séparateur */}
            <div className="border-t" />

            {/* Boutons d'action */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setEditSheetOpen(false)}
                disabled={isLoading}
              >
                Annuler
              </Button>
              <Button
                className="flex-1"
                onClick={() => void handleEditSubmit()}
                disabled={isLoading || isUploading || (!editText.trim() && uploadedUrls.length === 0)}
              >
                {isLoading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  `Appliquer à ${selectedCount} post${selectedCount > 1 ? 's' : ''}`
                )}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* ── Sheet "Replanifier" ────────────────────────────────────────────── */}
      <Sheet open={rescheduleSheetOpen} onOpenChange={setRescheduleSheetOpen}>
        <SheetContent side="right" className="w-full max-w-md">
          <SheetHeader>
            <SheetTitle>
              Replanifier {selectedCount} post{selectedCount > 1 ? 's' : ''}
            </SheetTitle>
            <SheetDescription>
              Choisissez une nouvelle date et heure de publication pour les posts sélectionnés.
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-6">
            <div className="space-y-2">
              <Label>Nouvelle date de publication</Label>
              <DateTimePicker
                value={rescheduleDate}
                onChange={setRescheduleDate}
                minDate={new Date()}
                placeholder="Choisir une nouvelle date…"
              />
            </div>

            <p className="text-xs text-muted-foreground">
              La date choisie sera appliquée à tous les {selectedCount} posts sélectionnés.
              Les posts déjà publiés ne seront pas affectés.
            </p>

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setRescheduleSheetOpen(false)}
                disabled={isLoading}
              >
                Annuler
              </Button>
              <Button
                className="flex-1"
                onClick={() => void handleRescheduleSubmit()}
                disabled={isLoading || !rescheduleDate}
              >
                {isLoading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  `Appliquer à ${selectedCount} post${selectedCount > 1 ? 's' : ''}`
                )}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
