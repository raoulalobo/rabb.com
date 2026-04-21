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
import type { BioLinkInput } from '@/modules/biolink/schemas/biopage.schema'

import type { BioLink } from '@prisma/client'

// ─── Types ───────────────────────────────────────────────────────────────────

interface LinkRowProps {
  /** Lien à afficher (donnée Prisma complète) */
  link: BioLink
  /** Callback post-mutation — typiquement router.refresh() */
  onMutation: () => void
  /**
   * Indique que ce lien vient d'être créé — déclenche un focus automatique
   * sur l'input URL + un scrollIntoView centré au mount. Le parent
   * (`LinksSection`) passe `true` uniquement pour le lien fraîchement
   * créé, et reset à `false` ~500ms plus tard pour éviter un refocus
   * lors d'un re-render ultérieur.
   */
  isNew?: boolean
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
export function LinkRow({
  link,
  onMutation,
  isNew = false,
}: LinkRowProps): React.JSX.Element {
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
  // ou lors d'un saveNow (toggle, select) pour éviter un double update.
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  /**
   * Ref sur l'input URL — utilisée quand `isNew=true` pour focus/scroll/select-all
   * automatiques au mount (UX : l'user tape directement l'URL après avoir cliqué
   * sur "Ajouter un lien", sans avoir à scroller ou cliquer dans le champ).
   */
  const urlInputRef = useRef<HTMLInputElement | null>(null)

  /**
   * Accumulateur des champs modifiés mais pas encore persistés.
   * Chaque `scheduleSave(patch)` fusionne dans ce ref, et le flush envoie
   * l'ensemble en UN SEUL appel `updateBioLink`. Ça corrige le bug où taper
   * dans `title` puis `url` écrasait le premier champ (seul le dernier patch
   * était envoyé).
   *
   * Typé en `Partial<BioLinkInput>` pour matcher exactement le payload attendu
   * par la Server Action (qui valide ensuite via BioLinkSchema.partial()).
   */
  const dirtyRef = useRef<Partial<BioLinkInput>>({})

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

  // ── Save coalescé ──────────────────────────────────────────────────────
  /**
   * Flushe tous les champs accumulés dans `dirtyRef` en UN SEUL appel
   * `updateBioLink`. Appelé soit par le timer debounce (`scheduleSave`),
   * soit directement par `saveNow` (toggle/select).
   *
   * - Si le ref est vide → no-op (évite un round-trip inutile).
   * - Reset du ref AVANT l'appel serveur pour que de nouvelles frappes
   *   pendant la requête ne soient pas effacées par le prochain flush.
   */
  const flush = (): void => {
    // Toujours couper le timer en cours — flush peut être appelé hors timer.
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
      saveTimeoutRef.current = null
    }
    const patch = dirtyRef.current
    // Reset : une frappe pendant le save n'est pas écrasée par le prochain flush.
    dirtyRef.current = {}
    if (Object.keys(patch).length === 0) return

    startSaving(async () => {
      // Payload coalescé envoyé tel quel — la Server Action valide via
      // BioLinkSchema.partial() côté serveur (source de vérité de la forme).
      const res = await updateBioLink(link.id, patch)
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
  }

  /**
   * Planifie un save debounced. Accumule le patch dans `dirtyRef` puis (re)arme
   * le timer. Si l'user tape dans plusieurs champs successifs, tous les champs
   * seront présents dans le patch final — aucun n'est écrasé.
   */
  const scheduleSave = (patch: Partial<BioLinkInput>): void => {
    Object.assign(dirtyRef.current, patch)
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    saveTimeoutRef.current = setTimeout(flush, AUTO_SAVE_DEBOUNCE_MS)
  }

  // Nettoyage du timeout quand la row est démontée
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    }
  }, [])

  /**
   * Focus + scroll + select-all sur l'input URL au mount si la row est marquée
   * `isNew` (lien fraîchement créé via le bouton "Ajouter"). Ne s'exécute qu'une
   * seule fois — le parent reset `isNew` à false ~500ms plus tard, mais cet
   * effet a déjà tourné avec la valeur initiale.
   */
  useEffect(() => {
    if (!isNew) return
    const input = urlInputRef.current
    if (!input) return
    input.focus()
    input.select()
    input.scrollIntoView({ behavior: 'smooth', block: 'center' })
    // Tableau de dépendances vide volontaire : focus au mount uniquement.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /**
   * Save immédiat (sans debounce) pour les toggles et selects — ces actions
   * sont intentionnelles et on veut un feedback immédiat.
   * Fusionne le patch dans `dirtyRef` et déclenche flush — ça annule aussi
   * le debounce d'une frappe en cours (ex: user tape dans `title` puis
   * toggle `isActive` → on envoie un seul update avec les deux champs).
   */
  const saveNow = (patch: Partial<BioLinkInput>): void => {
    Object.assign(dirtyRef.current, patch)
    flush()
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
          ref={urlInputRef}
          value={url}
          onChange={(e) => {
            setUrl(e.target.value)
            scheduleSave({ url: e.target.value })
          }}
          // Sélectionne tout le texte au focus → l'user tape par-dessus la
          // valeur par défaut (https://example.com) sans devoir effacer.
          onFocus={(e) => e.target.select()}
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
                saveNow({ kind: next })
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
                saveNow({ isActive: checked })
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
