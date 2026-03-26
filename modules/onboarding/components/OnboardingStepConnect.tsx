/**
 * @file modules/onboarding/components/OnboardingStepConnect.tsx
 * @module onboarding
 * @description Étape 1 de l'onboarding : connecter un premier réseau social.
 *   Réutilise PlatformList (le même composant que /settings) pour afficher
 *   les réseaux disponibles avec les boutons "Connecter".
 *
 *   La transition vers l'étape 2 est automatique : le callback OAuth
 *   met à jour onboardingStep = 1 dans la DB, puis redirige vers /dashboard.
 *
 * @example
 *   <OnboardingStepConnect />
 */

'use client'

import { Plug } from 'lucide-react'

import { PlatformList } from '@/modules/platforms/components/PlatformList'

/**
 * Contenu de l'étape 1 : connecter un réseau social.
 * Affiche la liste des plateformes disponibles (PlatformList réutilisé).
 */
export function OnboardingStepConnect(): React.JSX.Element {
  return (
    <div className="space-y-6">
      {/* ── En-tête ───────────────────────────────────────────────────────── */}
      <div className="flex items-start gap-4">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Plug className="size-6" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">Connecte ton premier réseau social</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Choisis le réseau sur lequel tu veux publier. Tu pourras en ajouter d&apos;autres plus tard.
          </p>
        </div>
      </div>

      {/* ── Liste des plateformes (réutilisé depuis /settings) ────────────── */}
      <PlatformList />
    </div>
  )
}
