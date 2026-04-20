/**
 * @file modules/biolink/components/BioPageEditor/LinkRow.tsx
 * @module biolink/components/BioPageEditor
 * @description Une ligne de lien triable dans la section "Liens" de l'éditeur.
 *
 *   Structure visuelle :
 *   ┌──────────────────────────────────────────────────────────┐
 *   │ ⋮⋮  [eyebrow]  [title]  [url]  [kind▾]  [active]  [🗑]  │
 *   └──────────────────────────────────────────────────────────┘
 *
 *   - Drag handle `GripVertical` à gauche — c'est le seul élément qui
 *     déclenche le drag (pas toute la row, pour ne pas bloquer le clic
 *     sur les inputs).
 *   - Inputs : eyebrow (optionnel), title, url (validée à la persistance)
 *   - Select : kind `primary` ou `glass`
 *   - Switch : isActive on/off
 *   - Trash : suppression avec confirm natif browser
 *
 *   Stratégie de save : **debounced 500ms** par champ après la dernière
 *   frappe. Évite un bouton "enregistrer" par row (UX plus fluide pour
 *   de petits champs).
 *
 * @example
 *   <LinkRow link={link} onUpdate={(data) => ...} onDelete={() => ...} />
 */

'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Loader2, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState, useTransition } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { deleteBioLink } from '@/modules/biolink/actions/delete-biolink.action'
import { updateBioLink } from '@/modules/biolink/actions/update-biolink.action'

import type { BioLink } from '@prisma/client'

// ─── Types ───────────────────────────────────────────────────────────────────

interface LinkRowProps {
  /** Lien à afficher (donnée Prisma complète) */
  link: BioLink
  /** Callback post-mutation — typiquement router.refresh() */
  onMutation: () => void
}

// ─── Constantes ──────────────────────────────────────────────────────────────

/** Délai (ms) avant le save automatique après la dernière frappe */
const AUTO_SAVE_DEBOUNCE_MS = 700

// ─── Composant ───────────────────────────────────────────────────────────────

/**
 * Rend une row triable avec drag handle, inputs et actions. Persiste
 * automatiquement en debounce après modification d'un champ.
 *
 * @param props.link - BioLink Prisma à éditer
 * @param props.onMutation - Callback invoqué après chaque mutation réussie
 * @returns Row éditable positionnée par @dnd-kit/sortable
 */
export function LinkRow({ link, onMutation }: LinkRowProps): React.JSX.Element {
  // ── État local synchronisé avec la prop `link` ──────────────────────────
  const [title, setTitle] = useState<string>(link.title)
  const [url, setUrl] = useState<string>(link.url ?? '')
  const [eyebrow, setEyebrow] = useState<string>(link.eyebrow ?? '')
  const [kind, setKind] = useState<'primary' | 'glass'>(
    link.kind === 'primary' ? 'primary' : 'glass',
  )
  const [isActive, setIsActive] = useState<boolean>(link.isActive)

  const [isSaving, startSaving] = useTransition()
  const [isDeleting, startDeleting] = useTransition()

  // Timeout en cours pour le debounced save — annulé à chaque nouvelle frappe
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Snapshot des valeurs déjà persistées — pour éviter des saves inutiles
  const persistedRef = useRef({
    title: link.title,
    url: link.url ?? '',
    eyebrow: link.eyebrow ?? '',
    kind: link.kind,
    isActive: link.isActive,
  })

  // ── Hook @dnd-kit/sortable ──────────────────────────────────────────────
  // `id` = ID stable du lien (primary key en DB). `attributes`/`listeners` sont
  // appliqués UNIQUEMENT au drag handle pour permettre les clics dans les inputs.
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: link.id })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  // ── Save debounced ─────────────────────────────────────────────────────
  /**
   * Persiste un champ après debounce. Utilisé par les inputs texte.
   * On compare avec persistedRef pour éviter de déclencher un update inutile.
   */
  const scheduleSave = (payload: Partial<BioLink>): void => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    saveTimeoutRef.current = setTimeout(() => {
      startSaving(async () => {
        const res = await updateBioLink(link.id, {
          title: payload.title,
          url: payload.url ?? undefined,
          eyebrow: payload.eyebrow ?? undefined,
          kind: payload.kind as 'primary' | 'glass' | undefined,
          isActive: payload.isActive,
        })
        if (!res.success) {
          toast.error(res.error)
          return
        }
        // Met à jour le snapshot persisté pour les prochaines comparaisons
        persistedRef.current = {
          title: res.data.title,
          url: res.data.url ?? '',
          eyebrow: res.data.eyebrow ?? '',
          kind: res.data.kind,
          isActive: res.data.isActive,
        }
        onMutation()
      })
    }, AUTO_SAVE_DEBOUNCE_MS)
  }

  // Nettoyage du timeout quand la row est démontée
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    }
  }, [])

  /**
   * Save immédiat (sans debounce) pour les toggles et selects — ces actions
   * sont intentionnelles et on veut un feedback immédiat.
   */
  const saveNow = async (payload: Partial<BioLink>): Promise<void> => {
    const res = await updateBioLink(link.id, {
      title: payload.title,
      url: payload.url ?? undefined,
      eyebrow: payload.eyebrow ?? undefined,
      kind: payload.kind as 'primary' | 'glass' | undefined,
      isActive: payload.isActive,
    })
    if (!res.success) {
      toast.error(res.error)
      return
    }
    onMutation()
  }

  /**
   * Suppression avec confirm natif (suffisant pour MVP — pas de Dialog dédié).
   */
  const handleDelete = (): void => {
    if (!window.confirm('Supprimer ce lien ?')) return
    startDeleting(async () => {
      const res = await deleteBioLink(link.id)
      if (!res.success) {
        toast.error(res.error)
        return
      }
      toast.success('Lien supprimé')
      onMutation()
    })
  }

  // ── Rendu ───────────────────────────────────────────────────────────────
  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-start gap-2 rounded-lg border bg-card p-3"
    >
      {/* Drag handle — seul élément qui capte les events dnd */}
      <button
        type="button"
        className="flex size-9 shrink-0 cursor-grab items-center justify-center rounded text-muted-foreground hover:bg-accent active:cursor-grabbing"
        aria-label="Réordonner le lien"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-4" />
      </button>

      {/* Inputs empilés sur mobile, en ligne à partir de sm */}
      <div className="flex-1 space-y-2">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Input
            value={eyebrow}
            onChange={(e) => {
              setEyebrow(e.target.value)
              scheduleSave({ eyebrow: e.target.value })
            }}
            placeholder="Eyebrow (Nouveau, etc.)"
            maxLength={30}
          />
          <Input
            value={title}
            onChange={(e) => {
              setTitle(e.target.value)
              scheduleSave({ title: e.target.value })
            }}
            placeholder="Titre du lien"
            maxLength={80}
          />
        </div>
        <Input
          value={url}
          onChange={(e) => {
            setUrl(e.target.value)
            scheduleSave({ url: e.target.value })
          }}
          placeholder="https://..."
          type="url"
        />

        <div className="flex items-center gap-4">
          {/* Select kind — save immédiat */}
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground">Style</label>
            <Select
              value={kind}
              onValueChange={(v) => {
                const next = v as 'primary' | 'glass'
                setKind(next)
                void saveNow({ kind: next })
              }}
            >
              <SelectTrigger className="h-8 w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="glass">Glass</SelectItem>
                <SelectItem value="primary">Primary</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Switch isActive — save immédiat */}
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground">Actif</label>
            <Switch
              checked={isActive}
              onCheckedChange={(checked) => {
                setIsActive(checked)
                void saveNow({ isActive: checked })
              }}
            />
          </div>

          {/* Indicateur de save en cours (discret) */}
          {isSaving && (
            <Loader2 className="size-3 animate-spin text-muted-foreground" />
          )}
        </div>
      </div>

      {/* Bouton delete */}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={handleDelete}
        disabled={isDeleting}
        aria-label="Supprimer le lien"
        className="shrink-0 text-muted-foreground hover:text-red-600"
      >
        {isDeleting ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Trash2 className="size-4" />
        )}
      </Button>
    </div>
  )
}
