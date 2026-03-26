/**
 * @file modules/onboarding/actions/update-onboarding.action.ts
 * @module onboarding
 * @description Server Action pour avancer l'étape d'onboarding de l'utilisateur.
 *   Appelée automatiquement après chaque étape réussie (connexion réseau, premier post).
 *
 * @example
 *   await updateOnboardingStep(1)  // Passer à l'étape "premier post"
 *   await updateOnboardingStep(2)  // Marquer l'onboarding comme terminé
 */

'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ONBOARDING_STEPS } from '@/modules/onboarding/types'

/**
 * Met à jour l'étape d'onboarding de l'utilisateur connecté.
 * Ne permet pas de revenir en arrière (l'étape doit être >= actuelle).
 *
 * @param step - Nouvelle étape (0, 1, ou 2)
 * @returns { success } ou { success: false, error }
 */
export async function updateOnboardingStep(
  step: number,
): Promise<{ success: boolean; error?: string }> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return { success: false, error: 'Non authentifié' }

  // Validation : l'étape doit être entre 0 et 2
  if (step < ONBOARDING_STEPS.CONNECT_PLATFORM || step > ONBOARDING_STEPS.COMPLETED) {
    return { success: false, error: 'Étape invalide' }
  }

  try {
    await prisma.user.update({
      where: { id: session.user.id },
      data: { onboardingStep: step },
    })

    revalidatePath('/dashboard')
    return { success: true }
  } catch (error) {
    console.error('[updateOnboardingStep] Erreur :', error)
    return { success: false, error: 'Erreur lors de la mise à jour' }
  }
}
