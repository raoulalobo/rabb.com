/**
 * @file app/(dashboard)/settings/SettingsToastHandler.tsx
 * @description Client Component qui lit les query params après le callback OAuth
 *   et affiche le toast de succès ou d'erreur correspondant.
 *   Doit être dans un <Suspense> car il utilise useSearchParams.
 *
 *   Query params attendus (injectés par /api/platforms/callback) :
 *   - ?success=platform_connected&platform=instagram → toast succès
 *   - ?error=platform_oauth → toast erreur OAuth
 *   - ?error=platform_callback_invalid → toast erreur paramètres invalides
 *
 * @example
 *   // Wrappé dans Suspense dans settings/page.tsx
 *   <Suspense>
 *     <SettingsToastHandler />
 *   </Suspense>
 */

'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect } from 'react'
import { toast } from 'sonner'

import type { LatePlatform } from '@/lib/late'
import { PLATFORM_CONFIG } from '@/modules/platforms/constants'

/**
 * Lit les query params et affiche les toasts de feedback OAuth.
 * Se nettoie automatiquement après affichage (retire les params de l'URL).
 * Rendu côté client uniquement — ne retourne rien de visible.
 */
export function SettingsToastHandler(): null {
  const searchParams = useSearchParams()
  const router = useRouter()

  useEffect(() => {
    const success = searchParams.get('success')
    const error = searchParams.get('error')
    const platform = searchParams.get('platform') as LatePlatform | null

    if (success === 'platform_connected' && platform) {
      const label = PLATFORM_CONFIG[platform]?.label ?? platform
      toast.success(`${label} connecté avec succès !`)
    }

    if (error) {
      const messages: Record<string, string> = {
        platform_oauth: "L'autorisation OAuth a échoué. Réessaie.",
        platform_callback_invalid: 'Paramètres de callback invalides.',
        platform_unknown: 'Plateforme non reconnue.',
        platform_connect: 'Erreur lors de la connexion.',
      }
      toast.error(messages[error] ?? 'Une erreur est survenue.')
    }

    // Nettoyer l'URL après affichage du toast (évite de re-afficher au refresh)
    if (success ?? error) {
      router.replace('/settings', { scroll: false })
    }
  }, [searchParams, router])

  return null
}
