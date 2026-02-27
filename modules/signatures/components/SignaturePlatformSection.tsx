/**
 * @file modules/signatures/components/SignaturePlatformSection.tsx
 * @module signatures
 * @description Section de la page /signatures pour UNE plateforme.
 *   Affiche l'icône + label de la plateforme, la liste de ses signatures
 *   (via SignatureCard) et le formulaire inline de création/édition.
 *
 *   État local géré ici :
 *   - `isCreating`  : affichage du formulaire de création
 *   - `editingId`   : ID de la signature en cours d'édition (null = aucune)
 *   - `deletingId`  : ID de la signature en cours de suppression (null = aucune)
 *   - `signatures`  : état local (initialé depuis props, mis à jour via revalidatePath)
 *
 *   Les mutations appellent les Server Actions et déclenchent revalidatePath('/signatures')
 *   côté serveur, ce qui rafraîchit les données au prochain rendu de la page.
 *
 * @example
 *   <SignaturePlatformSection
 *     platform="instagram"
 *     initialSignatures={[sig1, sig2]}
 *   />
 */

'use client'

import { PlusCircle } from 'lucide-react'
import Image from 'next/image'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { PLATFORM_CONFIG } from '@/modules/platforms/constants'
import {
  deleteSignature,
  setDefaultSignature,
} from '@/modules/signatures/actions/signature.action'
import type { Signature } from '@/modules/signatures/types'

import { SignatureCard } from './SignatureCard'
import { SignatureForm } from './SignatureForm'

// ─── Props ────────────────────────────────────────────────────────────────────

interface SignaturePlatformSectionProps {
  /** Identifiant de la plateforme (ex: "instagram") */
  platform: string
  /** Signatures initiales chargées par le Server Component parent */
  initialSignatures: Signature[]
}

// ─── Composant ────────────────────────────────────────────────────────────────

/**
 * Section d'une plateforme sur la page /signatures.
 * Gère la liste des signatures + formulaire inline de création/édition.
 *
 * @param platform            - Identifiant de la plateforme
 * @param initialSignatures   - Signatures initiales depuis le serveur
 */
export function SignaturePlatformSection({
  platform,
  initialSignatures,
}: SignaturePlatformSectionProps): React.JSX.Element {
  // ─── État local ─────────────────────────────────────────────────────────
  const [isCreating, setIsCreating] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const [isPending, startTransition] = useTransition()

  // Configuration visuelle de la plateforme (label, icône)
  const config = PLATFORM_CONFIG[platform as keyof typeof PLATFORM_CONFIG]
  const label = config?.label ?? platform

  /**
   * Supprime une signature via la Server Action.
   * Marque la carte comme "en cours de suppression" pendant l'opération.
   *
   * @param id - ID de la signature à supprimer
   */
  function handleDelete(id: string): void {
    setDeletingId(id)
    startTransition(async () => {
      try {
        await deleteSignature(id)
        toast.success('Signature supprimée')
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Erreur lors de la suppression')
      } finally {
        setDeletingId(null)
      }
    })
  }

  /**
   * Définit une signature comme défaut via la Server Action.
   *
   * @param id - ID de la signature à promouvoir
   */
  function handleSetDefault(id: string): void {
    startTransition(async () => {
      try {
        await setDefaultSignature(id)
        toast.success('Signature définie par défaut')
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Erreur')
      }
    })
  }

  // ─── Rendu ───────────────────────────────────────────────────────────────

  return (
    <section aria-labelledby={`platform-${platform}`} className="space-y-3">
      {/* ── En-tête de la section plateforme ─────────────────────────────── */}
      <div className="flex items-center gap-2">
        {/* Icône de la plateforme */}
        {config?.iconPath && (
          <div className="size-6 relative shrink-0">
            <Image
              src={config.iconPath}
              alt={label}
              width={24}
              height={24}
              className="rounded-sm object-contain"
            />
          </div>
        )}
        <h2
          id={`platform-${platform}`}
          className="text-base font-semibold"
        >
          {label}
        </h2>
        {/* Compteur de signatures */}
        <span className="text-xs text-muted-foreground">
          ({initialSignatures.length})
        </span>
      </div>

      {/* ── Liste des signatures ──────────────────────────────────────────── */}
      {initialSignatures.length === 0 && !isCreating ? (
        <p className="text-sm text-muted-foreground italic py-2">
          Aucune signature pour {label}. Créez-en une pour l&apos;insérer en un clic dans vos posts.
        </p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {initialSignatures.map((sig) =>
            editingId === sig.id ? (
              // Formulaire d'édition inline (remplace la carte)
              <SignatureForm
                key={sig.id}
                platform={platform}
                initialValues={{ id: sig.id, name: sig.name, text: sig.text }}
                onSuccess={() => setEditingId(null)}
                onCancel={() => setEditingId(null)}
              />
            ) : (
              <SignatureCard
                key={sig.id}
                signature={sig}
                onEdit={() => {
                  setIsCreating(false)   // Fermer le formulaire de création si ouvert
                  setEditingId(sig.id)
                }}
                onDelete={() => handleDelete(sig.id)}
                onSetDefault={() => handleSetDefault(sig.id)}
                isDeleting={deletingId === sig.id}
              />
            ),
          )}
        </div>
      )}

      {/* ── Formulaire de création inline ────────────────────────────────── */}
      {isCreating && (
        <SignatureForm
          platform={platform}
          onSuccess={() => setIsCreating(false)}
          onCancel={() => setIsCreating(false)}
        />
      )}

      {/* ── Bouton d'ajout ───────────────────────────────────────────────── */}
      {!isCreating && (
        <Button
          variant="ghost"
          size="sm"
          className="gap-2 text-muted-foreground hover:text-foreground"
          onClick={() => {
            setEditingId(null)    // Fermer l'édition si ouverte
            setIsCreating(true)
          }}
          disabled={isPending}
        >
          <PlusCircle className="size-4" />
          Ajouter une signature
        </Button>
      )}
    </section>
  )
}
