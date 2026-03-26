/**
 * @file modules/onboarding/components/OnboardingStepFirstPost.tsx
 * @module onboarding
 * @description Étape 2 de l'onboarding : créer et planifier un premier post.
 *   Réutilise PostComposer (compound component) avec les sous-composants essentiels.
 *   Après la soumission réussie, marque l'onboarding comme terminé (step = 2).
 *
 * @example
 *   <OnboardingStepFirstPost />
 */

'use client'

import { useRouter } from 'next/navigation'
import { PenLine } from 'lucide-react'
import { Separator } from '@/components/ui/separator'

import { PostComposer } from '@/modules/posts/components/PostComposer'
import { updateOnboardingStep } from '@/modules/onboarding/actions/update-onboarding.action'
import { ONBOARDING_STEPS } from '@/modules/onboarding/types'

/**
 * Contenu de l'étape 2 : créer un premier post.
 * Utilise PostComposer en mode simplifié.
 * onSuccess marque l'onboarding comme terminé et rafraîchit la page.
 */
export function OnboardingStepFirstPost(): React.JSX.Element {
  const router = useRouter()

  /**
   * Callback après soumission réussie du premier post.
   * Marque l'onboarding comme terminé → le dashboard normal s'affiche.
   */
  async function handlePostSuccess(): Promise<void> {
    await updateOnboardingStep(ONBOARDING_STEPS.COMPLETED)
    router.refresh()
  }

  return (
    <div className="space-y-6">
      {/* ── En-tête ───────────────────────────────────────────────────────── */}
      <div className="flex items-start gap-4">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <PenLine className="size-6" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">Crée ton premier post</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Écris quelque chose, choisis une date et planifie-le. Tu peux aussi le publier directement.
          </p>
        </div>
      </div>

      {/* ── PostComposer simplifié ────────────────────────────────────────── */}
      <div className="rounded-xl border bg-card p-4">
        <PostComposer onSuccess={handlePostSuccess}>
          <PostComposer.Platforms />
          <Separator className="my-3" />
          <PostComposer.Editor />
          <PostComposer.MediaUpload />
          <PostComposer.Schedule />
          <PostComposer.Footer />
        </PostComposer>
      </div>
    </div>
  )
}
