/**
 * @file modules/signatures/components/SignatureForm.tsx
 * @module signatures
 * @description Formulaire inline de création ou d'édition d'une signature.
 *   Affiché directement sous la liste (pas de modal) pour une UX fluide.
 *   Gère les deux cas :
 *   - Création : `initialValues` absent, `platform` requis
 *   - Édition  : `initialValues` présent avec les valeurs actuelles de la signature
 *
 *   Validation : Zod (SignatureUpsertSchema) côté client via onChange.
 *   Soumission  : appelle `upsertSignature` (Server Action) via transition.
 *
 * @example
 *   // Formulaire de création
 *   <SignatureForm
 *     platform="instagram"
 *     onSuccess={() => setIsCreating(false)}
 *     onCancel={() => setIsCreating(false)}
 *   />
 *
 *   // Formulaire d'édition
 *   <SignatureForm
 *     platform="instagram"
 *     initialValues={{ id: 'clxxx', name: 'Hashtags', text: '#photo' }}
 *     onSuccess={() => setEditingId(null)}
 *     onCancel={() => setEditingId(null)}
 *   />
 */

'use client'

import { useTransition } from 'react'
import { useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { upsertSignature } from '@/modules/signatures/actions/signature.action'
import { SignatureUpsertSchema } from '@/modules/signatures/schemas/signature.schema'

// ─── Props ────────────────────────────────────────────────────────────────────

interface SignatureFormProps {
  /** Plateforme cible (non modifiable après création) */
  platform: string
  /** Valeurs initiales pour le mode édition (absent = mode création) */
  initialValues?: {
    id: string
    name: string
    text: string
  }
  /** Callback après sauvegarde réussie */
  onSuccess: () => void
  /** Callback sur annulation */
  onCancel: () => void
}

// ─── Composant ────────────────────────────────────────────────────────────────

/** Limite de caractères pour le champ `text` */
const TEXT_MAX = 500

/**
 * Formulaire inline de création ou d'édition d'une signature.
 * S'affiche directement dans la section de la plateforme (pas de modal).
 *
 * @param platform       - Plateforme cible de la signature
 * @param initialValues  - Valeurs initiales (mode édition uniquement)
 * @param onSuccess      - Appelé après sauvegarde réussie
 * @param onCancel       - Appelé sur clic Annuler
 */
export function SignatureForm({
  platform,
  initialValues,
  onSuccess,
  onCancel,
}: SignatureFormProps): React.JSX.Element {
  const isEditing = Boolean(initialValues)

  // ─── État local du formulaire ──────────────────────────────────────────────
  const [name, setName] = useState(initialValues?.name ?? '')
  const [text, setText] = useState(initialValues?.text ?? '')

  // ─── Erreurs de validation en temps réel ──────────────────────────────────
  const [errors, setErrors] = useState<{ name?: string; text?: string }>({})

  // ─── Transition pour l'état de soumission ─────────────────────────────────
  const [isPending, startTransition] = useTransition()

  /**
   * Valide les champs en temps réel (appelé à chaque changement).
   * Met à jour l'état `errors` avec les messages Zod.
   */
  function validateField(field: 'name' | 'text', value: string): void {
    const result = SignatureUpsertSchema.safeParse({ name, text, platform, [field]: value })
    if (!result.success) {
      // Zod v4 : `.issues` avec path de type PropertyKey[] (string | number | symbol)
      const fieldError = result.error.issues.find((issue) => String(issue.path[0]) === field)
      setErrors((prev) => ({ ...prev, [field]: fieldError?.message }))
    } else {
      setErrors((prev) => ({ ...prev, [field]: undefined }))
    }
  }

  /**
   * Gère la soumission du formulaire.
   * Valide via Zod, puis appelle `upsertSignature` (Server Action).
   * Affiche un toast de succès ou d'erreur.
   */
  function handleSubmit(e: React.FormEvent): void {
    e.preventDefault()

    // Validation finale complète avant envoi
    const result = SignatureUpsertSchema.safeParse({
      id: initialValues?.id,
      name,
      text,
      platform,
    })

    if (!result.success) {
      // Afficher toutes les erreurs de validation
      const fieldErrors: { name?: string; text?: string } = {}
      // Zod v4 : `.issues` avec path de type PropertyKey[] (string | number | symbol)
      for (const issue of result.error.issues) {
        const field = String(issue.path[0]) as 'name' | 'text'
        fieldErrors[field] = issue.message
      }
      setErrors(fieldErrors)
      return
    }

    startTransition(async () => {
      try {
        await upsertSignature(result.data)
        toast.success(isEditing ? 'Signature mise à jour' : 'Signature créée')
        onSuccess()
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Erreur lors de la sauvegarde')
      }
    })
  }

  // ─── Rendu ────────────────────────────────────────────────────────────────

  return (
    <form
      onSubmit={handleSubmit}
      // Fond légèrement distinct pour démarquer le formulaire inline
      className="rounded-lg border border-dashed bg-muted/30 p-4 space-y-3"
    >
      {/* Champ : nom de la signature */}
      <div className="space-y-1">
        <Label htmlFor="sig-name" className="text-xs font-medium">
          Nom de la signature
        </Label>
        <Input
          id="sig-name"
          value={name}
          onChange={(e) => {
            setName(e.target.value)
            validateField('name', e.target.value)
          }}
          placeholder='Ex: "Hashtags courts", "CTA pro"'
          maxLength={50}
          disabled={isPending}
          aria-invalid={Boolean(errors.name)}
          aria-describedby={errors.name ? 'sig-name-error' : undefined}
        />
        {errors.name && (
          <p id="sig-name-error" className="text-xs text-destructive">
            {errors.name}
          </p>
        )}
      </div>

      {/* Champ : contenu de la signature */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <Label htmlFor="sig-text" className="text-xs font-medium">
            Contenu
          </Label>
          {/* Compteur de caractères */}
          <span
            className={[
              'text-xs tabular-nums',
              text.length > TEXT_MAX ? 'text-destructive font-semibold' : 'text-muted-foreground',
            ].join(' ')}
          >
            {text.length}/{TEXT_MAX}
          </span>
        </div>
        <Textarea
          id="sig-text"
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            validateField('text', e.target.value)
          }}
          placeholder="#photo #lifestyle #reels 🔗 lien.bio"
          rows={3}
          maxLength={TEXT_MAX}
          disabled={isPending}
          className="resize-none text-sm"
          aria-invalid={Boolean(errors.text)}
          aria-describedby={errors.text ? 'sig-text-error' : undefined}
        />
        {errors.text && (
          <p id="sig-text-error" className="text-xs text-destructive">
            {errors.text}
          </p>
        )}
      </div>

      {/* Actions : Enregistrer / Annuler */}
      <div className="sticky bottom-0 z-10 flex items-center gap-2 justify-end bg-background pb-2 pt-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onCancel}
          disabled={isPending}
        >
          Annuler
        </Button>
        <Button
          type="submit"
          size="sm"
          disabled={isPending || Boolean(errors.name) || Boolean(errors.text)}
        >
          {isPending ? 'Enregistrement…' : isEditing ? 'Mettre à jour' : 'Créer'}
        </Button>
      </div>
    </form>
  )
}
