/**
 * @file modules/biolink/components/BioPageEditor/AddLinkDialog.tsx
 * @module biolink
 * @description Dialog modal pour ajouter ou éditer un lien sur la BioPage.
 *   Utilise le store Zustand (isLinkDialogOpen, editingLinkId) pour contrôler
 *   l'ouverture et savoir si on est en mode création ou édition.
 *
 *   Supporte 5 types de liens :
 *   - link      : bouton cliquable classique (URL obligatoire)
 *   - header    : titre de section (pas d'URL)
 *   - separator : ligne horizontale (pas d'URL, pas de titre éditable)
 *   - video     : embed YouTube/TikTok (URL obligatoire)
 *   - music     : embed Spotify (URL obligatoire)
 *
 *   Section pliable "Planification" avec 2 champs date (activeFrom, activeUntil)
 *   pour rendre un lien visible uniquement pendant une fenêtre temporelle.
 *
 * @example
 *   <AddLinkDialog links={currentLinks} onSave={handleSaveLink} />
 */

'use client'

import { useEffect, useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { BIO_LINK_TYPES, BioLinkUpsertSchema } from '@/modules/biolink/schemas/biolink.schema'
import { useBioLinkStore } from '@/modules/biolink/store/biolink.store'
import type { BioLink, BioLinkType } from '@/modules/biolink/types'

// ─── Props ────────────────────────────────────────────────────────────────────

interface AddLinkDialogProps {
  /** Liste actuelle des liens (pour pré-remplir en mode édition) */
  links: BioLink[]
  /** Callback appelé après validation : crée ou met à jour le lien */
  onSave: (data: {
    id?: string
    type: BioLinkType
    title: string
    url?: string | null
    icon?: string | null
    isActive: boolean
    activeFrom?: Date | null
    activeUntil?: Date | null
  }) => Promise<void>
}

// ─── Labels français pour chaque type de lien ────────────────────────────────

const LINK_TYPE_LABELS: Record<string, string> = {
  link: 'Lien',
  header: 'Titre de section',
  separator: 'Séparateur',
  video: 'Vidéo (YouTube/TikTok)',
  music: 'Musique (Spotify)',
}

// ─── Composant ────────────────────────────────────────────────────────────────

/**
 * Dialog d'ajout/édition de lien Bio Link.
 * - Mode création (editingLinkId = null) : champs vides
 * - Mode édition (editingLinkId = id) : champs pré-remplis
 *
 * @param links  - Liste des liens pour trouver celui en édition
 * @param onSave - Callback de sauvegarde (Server Action wrapper)
 * @returns Dialog avec formulaire type + titre + URL + icône + planification + toggle actif
 */
export function AddLinkDialog({ links, onSave }: AddLinkDialogProps): React.JSX.Element {
  // État du dialog depuis le store Zustand
  const { isLinkDialogOpen, editingLinkId, closeLinkDialog } = useBioLinkStore()

  // État local du formulaire
  const [type, setType] = useState<BioLinkType>('link')
  const [title, setTitle] = useState('')
  const [url, setUrl] = useState('')
  const [icon, setIcon] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [activeFrom, setActiveFrom] = useState('')
  const [activeUntil, setActiveUntil] = useState('')
  const [showScheduling, setShowScheduling] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Pré-remplir les champs en mode édition
  const editingLink = editingLinkId ? links.find((l) => l.id === editingLinkId) : null

  // Déterminer si l'URL est requise selon le type
  const urlRequired = ['link', 'video', 'music'].includes(type)
  // Déterminer si le titre est éditable (le séparateur n'a pas besoin de titre visible)
  const showTitle = type !== 'separator'
  // Déterminer si l'URL est affichée
  const showUrl = type !== 'header' && type !== 'separator'

  useEffect(() => {
    if (editingLink) {
      // Mode édition : pré-remplir depuis le lien existant
      setType((editingLink.type as BioLinkType) ?? 'link')
      setTitle(editingLink.title)
      setUrl(editingLink.url ?? '')
      setIcon(editingLink.icon ?? '')
      setIsActive(editingLink.isActive)
      // Convertir les dates en format input datetime-local (YYYY-MM-DDTHH:MM)
      setActiveFrom(editingLink.activeFrom ? formatDateForInput(editingLink.activeFrom) : '')
      setActiveUntil(editingLink.activeUntil ? formatDateForInput(editingLink.activeUntil) : '')
      setShowScheduling(!!(editingLink.activeFrom || editingLink.activeUntil))
    } else {
      // Mode création : réinitialiser tous les champs
      setType('link')
      setTitle('')
      setUrl('')
      setIcon('')
      setIsActive(true)
      setActiveFrom('')
      setActiveUntil('')
      setShowScheduling(false)
    }
    setError(null)
  }, [editingLink, isLinkDialogOpen])

  /**
   * Formate une Date en string compatible avec input datetime-local.
   * @param date - Date à formater
   * @returns String au format "YYYY-MM-DDTHH:MM"
   */
  function formatDateForInput(date: Date): string {
    const d = new Date(date)
    // Ajuster au fuseau local
    const offset = d.getTimezoneOffset()
    const local = new Date(d.getTime() - offset * 60000)
    return local.toISOString().slice(0, 16)
  }

  /**
   * Valide les données via Zod et appelle le callback onSave.
   * Affiche l'erreur de validation si présente.
   */
  async function handleSubmit(): Promise<void> {
    setError(null)

    // Préparer les données selon le type de lien
    const dataToValidate = {
      id: editingLinkId ?? undefined,
      type,
      // Le séparateur utilise un titre par défaut (requis par Zod min(1))
      title: type === 'separator' ? '—' : title,
      url: showUrl ? (url || null) : null,
      icon: icon || null,
      isActive,
      activeFrom: activeFrom ? new Date(activeFrom) : null,
      activeUntil: activeUntil ? new Date(activeUntil) : null,
    }

    // Validation Zod côté client
    const parsed = BioLinkUpsertSchema.safeParse(dataToValidate)

    if (!parsed.success) {
      // Afficher la première erreur de validation
      setError(parsed.error.issues[0]?.message ?? 'Données invalides')
      return
    }

    setSaving(true)
    try {
      await onSave({
        id: editingLinkId ?? undefined,
        type: parsed.data.type as BioLinkType,
        title: parsed.data.title,
        url: parsed.data.url,
        icon: parsed.data.icon,
        isActive: parsed.data.isActive,
        activeFrom: parsed.data.activeFrom ?? null,
        activeUntil: parsed.data.activeUntil ?? null,
      })
      closeLinkDialog()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la sauvegarde')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={isLinkDialogOpen} onOpenChange={(open) => { if (!open) closeLinkDialog() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {editingLinkId ? 'Modifier le lien' : 'Ajouter un lien'}
          </DialogTitle>
          <DialogDescription>
            {editingLinkId ? 'Modifiez les propriétés du lien.' : 'Configurez le nouveau lien à ajouter à votre page.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* ── Type de lien ───────────────────────────────────────────── */}
          <div className="space-y-2">
            <Label htmlFor="link-type">Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as BioLinkType)}>
              <SelectTrigger id="link-type">
                <SelectValue placeholder="Type de lien" />
              </SelectTrigger>
              <SelectContent>
                {BIO_LINK_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {LINK_TYPE_LABELS[t] ?? t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* ── Titre du lien (masqué pour separator) ─────────────────── */}
          {showTitle && (
            <div className="space-y-2">
              <Label htmlFor="link-title">Titre</Label>
              <Input
                id="link-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={type === 'header' ? 'Titre de la section' : 'Ma dernière vidéo'}
                maxLength={100}
              />
            </div>
          )}

          {/* ── URL de destination (masqué pour header/separator) ──────── */}
          {showUrl && (
            <div className="space-y-2">
              <Label htmlFor="link-url">
                URL {urlRequired && <span className="text-destructive">*</span>}
              </Label>
              <Input
                id="link-url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder={
                  type === 'video'
                    ? 'https://youtube.com/watch?v=...'
                    : type === 'music'
                      ? 'https://open.spotify.com/track/...'
                      : 'https://...'
                }
                type="url"
              />
            </div>
          )}

          {/* ── Icône (emoji) — uniquement pour link ──────────────────── */}
          {type === 'link' && (
            <div className="space-y-2">
              <Label htmlFor="link-icon">Icône (emoji, optionnel)</Label>
              <Input
                id="link-icon"
                value={icon}
                onChange={(e) => setIcon(e.target.value)}
                placeholder="🎥"
                maxLength={10}
                className="w-20"
              />
            </div>
          )}

          {/* ── Planification (section pliable) ───────────────────────── */}
          <div className="border rounded-lg">
            <button
              type="button"
              onClick={() => setShowScheduling(!showScheduling)}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              {showScheduling ? (
                <ChevronDown className="size-4" />
              ) : (
                <ChevronRight className="size-4" />
              )}
              Planification
            </button>

            {showScheduling && (
              <div className="px-3 pb-3 space-y-3">
                <p className="text-xs text-muted-foreground">
                  Rendez ce lien visible uniquement pendant une période définie.
                </p>

                {/* Date de début */}
                <div className="space-y-1">
                  <Label htmlFor="link-from" className="text-xs">
                    Visible à partir du
                  </Label>
                  <Input
                    id="link-from"
                    type="datetime-local"
                    value={activeFrom}
                    onChange={(e) => setActiveFrom(e.target.value)}
                    className="text-sm"
                  />
                </div>

                {/* Date de fin */}
                <div className="space-y-1">
                  <Label htmlFor="link-until" className="text-xs">
                    Visible jusqu'au
                  </Label>
                  <Input
                    id="link-until"
                    type="datetime-local"
                    value={activeUntil}
                    onChange={(e) => setActiveUntil(e.target.value)}
                    className="text-sm"
                  />
                </div>
              </div>
            )}
          </div>

          {/* ── Toggle actif ─────────────────────────────────────────── */}
          <div className="flex items-center gap-2">
            <Checkbox
              id="link-active"
              checked={isActive}
              onCheckedChange={(checked) => setIsActive(checked === true)}
            />
            <Label htmlFor="link-active" className="text-sm font-normal">
              Visible sur la page publique
            </Label>
          </div>

          {/* ── Erreur de validation ─────────────────────────────────── */}
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={closeLinkDialog}
            disabled={saving}
          >
            Annuler
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
          >
            {saving ? 'Enregistrement...' : editingLinkId ? 'Modifier' : 'Ajouter'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
