/**
 * @file modules/onboarding/types.ts
 * @module onboarding
 * @description Types du module onboarding.
 *   L'onboarding guide les nouveaux utilisateurs en 2 étapes obligatoires
 *   avant d'accéder au dashboard principal.
 */

/** Étapes de l'onboarding (stockées dans User.onboardingStep) */
export const ONBOARDING_STEPS = {
  /** Étape 0 : l'utilisateur doit connecter son premier réseau social */
  CONNECT_PLATFORM: 0,
  /** Étape 1 : l'utilisateur doit créer et planifier son premier post */
  FIRST_POST: 1,
  /** Étape 2 : onboarding terminé → afficher le dashboard normal */
  COMPLETED: 2,
} as const

export type OnboardingStep = (typeof ONBOARDING_STEPS)[keyof typeof ONBOARDING_STEPS]
