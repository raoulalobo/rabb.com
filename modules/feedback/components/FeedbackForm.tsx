/**
 * @file modules/feedback/components/FeedbackForm.tsx
 * @module feedback
 * @description Formulaire de feedback utilisateur.
 *   Permet de sélectionner une catégorie et rédiger un message.
 *   Valide côté client avec Zod, envoie via Server Action.
 *   Affiche un toast de succès/erreur et réinitialise le formulaire après envoi.
 *
 * @example
 *   <FeedbackForm />
 */

'use client'

import { useState } from 'react'

import { MessageSquarePlus } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { createFeedback } from '@/modules/feedback/actions/create-feedback.action'
import { FeedbackSchema } from '@/modules/feedback/schemas/feedback.schema'
import { FEEDBACK_CATEGORIES } from '@/modules/feedback/types'

import type { FeedbackCategory } from '@/modules/feedback/types'

// ─── Constantes ───────────────────────────────────────────────────────────────

/** Longueur maximale du message (cohérent avec le schéma Zod) */
const MAX_MESSAGE_LENGTH = 2000

// ─── Composant ────────────────────────────────────────────────────────────────

/**
 * Formulaire de feedback avec select catégorie + textarea message.
 * Gère la validation client, l'envoi serveur, et le reset après succès.
 *
 * @returns Formulaire de feedback complet
 */
export function FeedbackForm(): React.JSX.Element {
  // ── État local ───────────────────────────────────────────────────────────────
  const [category, setCategory] = useState<FeedbackCategory>('general')
  const [message, setMessage] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [validationError, setValidationError] = useState<string | null>(null)

  // ── Soumission ───────────────────────────────────────────────────────────────

  /**
   * Valide les données côté client puis appelle la Server Action.
   * En cas de succès : toast + reset du formulaire.
   * En cas d'erreur : affiche le message d'erreur.
   */
  async function handleSubmit(e: React.FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault()
    setValidationError(null)

    // Validation Zod côté client (feedback instantané)
    const parsed = FeedbackSchema.safeParse({ category, message })
    if (!parsed.success) {
      setValidationError(parsed.error.issues[0].message)
      return
    }

    setIsSending(true)
    try {
      const result = await createFeedback({ category, message })

      if (result.success) {
        toast.success('Merci pour votre retour !')
        // Reset du formulaire après envoi réussi
        setCategory('general')
        setMessage('')
      } else {
        toast.error(result.error ?? 'Une erreur est survenue')
      }
    } catch {
      toast.error('Erreur réseau — veuillez réessayer')
    } finally {
      setIsSending(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* ── Carte formulaire ───────────────────────────────────────────────── */}
      <div className="rounded-lg border bg-card p-6 shadow-sm">
        {/* Catégorie */}
        <div className="space-y-2">
          <Label htmlFor="feedback-category">Catégorie</Label>
          <Select
            value={category}
            onValueChange={(val) => setCategory(val as FeedbackCategory)}
          >
            <SelectTrigger id="feedback-category" className="w-full">
              <SelectValue placeholder="Sélectionnez une catégorie" />
            </SelectTrigger>
            <SelectContent>
              {(Object.entries(FEEDBACK_CATEGORIES) as [FeedbackCategory, string][]).map(
                ([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ),
              )}
            </SelectContent>
          </Select>
        </div>

        {/* Message */}
        <div className="mt-4 space-y-2">
          <Label htmlFor="feedback-message">Votre message</Label>
          <Textarea
            id="feedback-message"
            value={message}
            onChange={(e) => {
              setMessage(e.target.value)
              // Effacer l'erreur de validation quand l'utilisateur tape
              if (validationError) setValidationError(null)
            }}
            placeholder="Décrivez votre remarque, bug ou suggestion..."
            rows={6}
            maxLength={MAX_MESSAGE_LENGTH}
            className="resize-y"
          />
          {/* Compteur de caractères + erreur de validation */}
          <div className="flex items-center justify-between">
            <div>
              {validationError && (
                <p className="text-sm text-destructive">{validationError}</p>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {message.length}/{MAX_MESSAGE_LENGTH}
            </p>
          </div>
        </div>
      </div>

      {/* ── Bouton d'envoi ─────────────────────────────────────────────────── */}
      <Button type="submit" disabled={isSending} className="gap-2">
        <MessageSquarePlus className="size-4" />
        {isSending ? 'Envoi en cours…' : 'Envoyer mon feedback'}
      </Button>
    </form>
  )
}
