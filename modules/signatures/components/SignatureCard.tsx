/**
 * @file modules/signatures/components/SignatureCard.tsx
 * @module signatures
 * @description Carte d'affichage d'une signature avec ses actions CRUD.
 *   Affiche :
 *   - Badge étoile ⭐ si isDefault (signature par défaut)
 *   - Bouton "Définir par défaut" si !isDefault
 *   - Texte de la signature (tronqué à 2 lignes, expandable au clic)
 *   - Bouton ✏️ (ouvre le formulaire d'édition inline via callback)
 *   - Bouton 🗑️ (suppression avec confirmation inline)
 *
 *   Les mutations (setDefault, delete) sont déléguées au parent
 *   SignaturePlatformSection via des callbacks, qui gère l'état optimiste.
 *
 * @example
 *   <SignatureCard
 *     signature={sig}
 *     onEdit={() => setEditingId(sig.id)}
 *     onDelete={() => handleDelete(sig.id)}
 *     onSetDefault={() => handleSetDefault(sig.id)}
 *     isDeleting={deletingId === sig.id}
 *   />
 */

'use client'

import { Star, Pencil, Trash2 } from 'lucide-react'
import { useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { Signature } from '@/modules/signatures/types'

// ─── Props ────────────────────────────────────────────────────────────────────

interface SignatureCardProps {
  /** La signature à afficher */
  signature: Signature
  /** Appelé quand l'utilisateur clique "Éditer" */
  onEdit: () => void
  /** Appelé quand l'utilisateur confirme la suppression */
  onDelete: () => void
  /** Appelé quand l'utilisateur clique "Définir par défaut" */
  onSetDefault: () => void
  /** Vrai pendant la suppression (désactive les boutons) */
  isDeleting?: boolean
}

// ─── Composant ────────────────────────────────────────────────────────────────

/**
 * Carte d'une signature avec actions inline.
 * Gère localement l'état d'expansion du texte et la confirmation de suppression.
 *
 * @param signature   - Donnée de la signature
 * @param onEdit      - Callback d'édition
 * @param onDelete    - Callback de suppression confirmée
 * @param onSetDefault - Callback "Définir par défaut"
 * @param isDeleting  - Vrai si la suppression est en cours
 */
export function SignatureCard({
  signature,
  onEdit,
  onDelete,
  onSetDefault,
  isDeleting = false,
}: SignatureCardProps): React.JSX.Element {
  // État local : texte développé ou tronqué
  const [isExpanded, setIsExpanded] = useState(false)
  // État local : confirmation de suppression affichée
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  /**
   * Lance la suppression après confirmation.
   * Réinitialise aussi l'affichage de la confirmation.
   */
  function handleDeleteConfirm(): void {
    setShowDeleteConfirm(false)
    onDelete()
  }

  return (
    <div
      className={[
        'rounded-lg border bg-card p-4 transition-opacity',
        isDeleting ? 'opacity-50 pointer-events-none' : '',
      ].join(' ')}
    >
      {/* ── En-tête : nom + badge défaut + actions ─────────────────────── */}
      <div className="flex items-start gap-2">
        {/* Nom de la signature + badge défaut */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium truncate">{signature.name}</span>

            {/* Badge "par défaut" affiché si isDefault */}
            {signature.isDefault && (
              <Badge
                variant="secondary"
                className="gap-1 text-xs shrink-0 bg-amber-50 text-amber-700 border-amber-200"
              >
                <Star className="size-3 fill-amber-500 text-amber-500" />
                par défaut
              </Badge>
            )}
          </div>
        </div>

        {/* Actions : éditer + supprimer */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Bouton éditer */}
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={onEdit}
            title="Modifier la signature"
            aria-label={`Modifier la signature "${signature.name}"`}
          >
            <Pencil className="size-3.5" />
          </Button>

          {/* Bouton supprimer (avec confirmation inline) */}
          {showDeleteConfirm ? (
            // Zone de confirmation inline (remplace le bouton)
            <div className="flex items-center gap-1">
              <span className="text-xs text-muted-foreground whitespace-nowrap">Supprimer ?</span>
              <Button
                variant="destructive"
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={handleDeleteConfirm}
              >
                Oui
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={() => setShowDeleteConfirm(false)}
              >
                Non
              </Button>
            </div>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              className="size-7 text-muted-foreground hover:text-destructive"
              onClick={() => setShowDeleteConfirm(true)}
              title="Supprimer la signature"
              aria-label={`Supprimer la signature "${signature.name}"`}
            >
              <Trash2 className="size-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* ── Texte de la signature ───────────────────────────────────────── */}
      <div className="mt-2">
        <p
          className={[
            'text-sm text-muted-foreground whitespace-pre-wrap break-words cursor-pointer',
            // Tronqué à 2 lignes par défaut, expandable au clic
            isExpanded ? '' : 'line-clamp-2',
          ].join(' ')}
          onClick={() => setIsExpanded((prev) => !prev)}
          title={isExpanded ? 'Réduire' : 'Voir tout'}
        >
          {signature.text}
        </p>
      </div>

      {/* ── Bouton "Définir par défaut" si pas encore défaut ──────────── */}
      {!signature.isDefault && (
        <div className="mt-3 pt-3 border-t">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs gap-1.5 text-muted-foreground hover:text-foreground"
            onClick={onSetDefault}
          >
            <Star className="size-3" />
            Définir par défaut
          </Button>
        </div>
      )}
    </div>
  )
}
