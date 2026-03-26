/**
 * @file modules/onboarding/components/OnboardingBanner.tsx
 * @module onboarding
 * @description Orchestrateur de l'onboarding inline dans le dashboard.
 *   Affiche une barre de progression (2 étapes) + le contenu de l'étape courante.
 *   Remplace le contenu normal du dashboard tant que l'onboarding n'est pas terminé.
 *
 * @example
 *   <OnboardingBanner step={0} firstName="Raoul" />
 */

'use client'

import { Check } from 'lucide-react'

import { cn } from '@/lib/utils'
import { ONBOARDING_STEPS } from '@/modules/onboarding/types'

import { OnboardingStepConnect } from './OnboardingStepConnect'
import { OnboardingStepFirstPost } from './OnboardingStepFirstPost'

// ─── Types ───────────────────────────────────────────────────────────────────

interface OnboardingBannerProps {
  /** Étape courante de l'onboarding (0 ou 1) */
  step: number
  /** Prénom de l'utilisateur pour la salutation */
  firstName?: string | null
}

/** Définition d'une étape pour la barre de progression */
const STEPS = [
  { label: 'Connecter un réseau', stepIndex: ONBOARDING_STEPS.CONNECT_PLATFORM },
  { label: 'Créer un post', stepIndex: ONBOARDING_STEPS.FIRST_POST },
]

// ─── Composant ───────────────────────────────────────────────────────────────

/**
 * Bandeau d'onboarding affiché en lieu et place du dashboard pour les nouveaux utilisateurs.
 * Affiche une barre de progression + le contenu de l'étape courante.
 *
 * @param step - Étape courante (0 = connecter réseau, 1 = premier post)
 * @param firstName - Prénom pour la salutation personnalisée
 */
export function OnboardingBanner({ step, firstName }: OnboardingBannerProps): React.JSX.Element {
  return (
    <div className="space-y-8">
      {/* ── Salutation ─────────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Bienvenue{firstName ? ` ${firstName}` : ''} !
        </h1>
        <p className="mt-1 text-muted-foreground">
          Configurons ton compte en 2 étapes rapides.
        </p>
      </div>

      {/* ── Barre de progression ───────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        {STEPS.map(({ label, stepIndex }, i) => {
          const isCompleted = step > stepIndex
          const isCurrent = step === stepIndex

          return (
            <div key={stepIndex} className="flex items-center gap-3">
              {/* Cercle numéroté ou check */}
              <div className="flex items-center gap-2">
                <div
                  className={cn(
                    'flex size-8 items-center justify-center rounded-full text-sm font-semibold transition-colors',
                    isCompleted && 'bg-primary text-primary-foreground',
                    isCurrent && 'bg-primary text-primary-foreground ring-4 ring-primary/20',
                    !isCompleted && !isCurrent && 'bg-muted text-muted-foreground',
                  )}
                >
                  {isCompleted ? <Check className="size-4" /> : i + 1}
                </div>
                <span
                  className={cn(
                    'text-sm font-medium',
                    isCurrent ? 'text-foreground' : 'text-muted-foreground',
                  )}
                >
                  {label}
                </span>
              </div>

              {/* Trait de connexion entre les étapes (sauf après la dernière) */}
              {i < STEPS.length - 1 && (
                <div
                  className={cn(
                    'h-0.5 w-12 rounded-full transition-colors',
                    step > stepIndex ? 'bg-primary' : 'bg-muted',
                  )}
                />
              )}
            </div>
          )
        })}
      </div>

      {/* ── Contenu de l'étape courante ────────────────────────────────────── */}
      {step === ONBOARDING_STEPS.CONNECT_PLATFORM && <OnboardingStepConnect />}
      {step === ONBOARDING_STEPS.FIRST_POST && <OnboardingStepFirstPost />}
    </div>
  )
}
