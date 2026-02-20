/**
 * @file modules/posts/components/AgentComposer/AgentPlan.tsx
 * @module posts
 * @description Affichage et édition du plan généré par l'agent Claude.
 *
 *   Affiche le plan complet sous forme de cards éditables, une par plateforme.
 *   L'utilisateur peut modifier chaque carte avant de confirmer.
 *
 *   Structure de l'écran :
 *   - Bandeau résumé optionnel (si l'agent a fourni un summary)
 *   - Une PlanPlatformCard par plateforme du plan
 *   - Boutons : "Modifier l'instruction" (retour) + "Confirmer et publier"
 *
 * @example
 *   <AgentPlan
 *     plan={agentPlan}
 *     onPlanChange={setAgentPlan}
 *     onConfirm={handleConfirmPlan}
 *     onBack={() => setStep('input')}
 *     isSubmitting={isSubmitting}
 *   />
 */

'use client'

import { CheckCircle, Loader2, Sparkles } from 'lucide-react'

import type { AgentPlan as AgentPlanType, PlatformPlan } from '@/modules/posts/types'

import { PlanPlatformCard } from './PlanPlatformCard'

// ─── Props ────────────────────────────────────────────────────────────────────

interface AgentPlanProps {
  /** Plan complet généré par Claude (potentiellement modifié par l'utilisateur) */
  plan: AgentPlanType
  /** Callback déclenché à chaque modification d'une plateforme dans le plan */
  onPlanChange: (updatedPlan: AgentPlanType) => void
  /** Callback déclenché quand l'utilisateur confirme le plan → execute-plan */
  onConfirm: () => void
  /** Vrai pendant la soumission du plan (désactive les modifications + boutons) */
  isSubmitting: boolean
}

// ─── Composant ────────────────────────────────────────────────────────────────

/**
 * Affichage du plan agent avec édition par plateforme et confirmation.
 * Chaque PlanPlatformCard est éditable indépendamment.
 */
export function AgentPlan({
  plan,
  onPlanChange,
  onConfirm,
  isSubmitting,
}: AgentPlanProps): React.JSX.Element {
  // Normalisation de `platforms` à la lecture (rendu).
  //
  // Claude peut retourner `platforms` sous trois formes :
  //   1. Tableau parsé  → cas nominal, utilisé tel quel
  //   2. String JSON    → double-encodage Claude (ex: "[{\"platform\":\"tiktok\"...}]")
  //                       → on parse et on obtient le vrai tableau
  //   3. Autre (null, objet, undefined) → tableau vide
  //
  // Cette normalisation est effectuée ici (rendu) et non uniquement via un useEffect
  // pour garantir l'affichage correct même si le state n'a pas encore été corrigé.
  const platforms: PlatformPlan[] = (() => {
    const raw = plan.platforms as unknown
    if (Array.isArray(raw)) return raw as PlatformPlan[]
    if (typeof raw === 'string') {
      try {
        const parsed: unknown = JSON.parse(raw)
        return Array.isArray(parsed) ? (parsed as PlatformPlan[]) : []
      } catch {
        return []
      }
    }
    return []
  })()

  // Compte les plateformes planifiées vs immédiates pour l'affichage du bouton
  const scheduledCount = platforms.filter((p) => p.scheduledFor !== null).length
  const immediateCount = platforms.length - scheduledCount

  /**
   * Met à jour une plateforme individuelle dans le plan.
   * Trouve l'entrée par son index et la remplace.
   *
   * @param index - Index de la plateforme dans plan.platforms
   * @param updated - Nouvelle version de la carte plateforme
   */
  const handlePlatformChange = (index: number, updated: PlatformPlan): void => {
    const updatedPlatforms = platforms.map((p, i) => (i === index ? updated : p))
    onPlanChange({ ...plan, platforms: updatedPlatforms })
  }

  /**
   * Retire une plateforme du plan sans toucher au fil de conversation.
   * Filtre simplement le tableau platforms — chatHistory et sessionId restent intacts.
   *
   * @param index - Index de la plateforme à retirer
   */
  const handlePlatformRemove = (index: number): void => {
    const updatedPlatforms = platforms.filter((_, i) => i !== index)
    onPlanChange({ ...plan, platforms: updatedPlatforms })
  }

  return (
    <div className="space-y-4">
      {/* ── En-tête du plan ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2">
        <Sparkles className="size-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">
          Plan généré par l&apos;agent
        </h3>
        <span className="ml-auto rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
          {platforms.length} plateforme{platforms.length > 1 ? 's' : ''}
        </span>
      </div>

      {/* ── Résumé global de l'agent (optionnel) ────────────────────────────── */}
      {plan.summary && (
        <div className="flex gap-2.5 rounded-lg bg-blue-50 px-3.5 py-3">
          <Sparkles className="mt-0.5 size-3.5 shrink-0 text-blue-500" />
          <p className="text-xs leading-relaxed text-blue-700">{plan.summary}</p>
        </div>
      )}

      {/* ── Cards par plateforme ─────────────────────────────────────────────── */}
      <div className="space-y-3">
        {platforms.map((platformPlan, index) => (
          <PlanPlatformCard
            key={`${platformPlan.platform}-${index}`}
            platformPlan={platformPlan}
            onChange={(updated) => handlePlatformChange(index, updated)}
            onRemove={() => handlePlatformRemove(index)}
            disabled={isSubmitting}
          />
        ))}
      </div>

      {/* ── Récapitulatif des publications ───────────────────────────────────── */}
      <div className="rounded-lg bg-muted/50 px-4 py-3">
        <p className="text-xs text-muted-foreground">
          {scheduledCount > 0 && (
            <span>
              <strong className="text-foreground">{scheduledCount}</strong> publication
              {scheduledCount > 1 ? 's' : ''} planifiée{scheduledCount > 1 ? 's' : ''}
            </span>
          )}
          {scheduledCount > 0 && immediateCount > 0 && ' · '}
          {immediateCount > 0 && (
            <span>
              <strong className="text-foreground">{immediateCount}</strong> publication
              {immediateCount > 1 ? 's' : ''} immédiate{immediateCount > 1 ? 's' : ''}
            </span>
          )}
        </p>
      </div>

      {/* ── Bouton d'action ──────────────────────────────────────────────────── */}
      <div className="flex gap-3 pt-1">
        {/* Bouton de confirmation → execute-plan */}
        <button
          type="button"
          onClick={onConfirm}
          disabled={isSubmitting || platforms.length === 0}
          className={[
            'flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5',
            'text-sm font-semibold text-primary-foreground shadow-sm transition-all',
            'hover:bg-primary/90 active:scale-[0.98]',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            'disabled:cursor-not-allowed disabled:opacity-50',
          ].join(' ')}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Enregistrement...
            </>
          ) : (
            <>
              <CheckCircle className="size-4" />
              {scheduledCount > 0 ? 'Confirmer et planifier' : 'Confirmer et publier'}
            </>
          )}
        </button>
      </div>
    </div>
  )
}
