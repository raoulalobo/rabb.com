/**
 * @file app/(dashboard)/settings/page.tsx
 * @description Page des paramètres utilisateur (/settings).
 *   Sections :
 *   - Réseaux sociaux connectés (PlatformList)
 *   - Dictée vocale (SpeechSettings)
 *
 *   Gère les query params success/error du callback OAuth pour afficher des toasts.
 *
 * @example
 *   // Après callback OAuth :
 *   /settings?success=platform_connected&platform=instagram → toast succès
 *   /settings?error=platform_oauth → toast erreur
 */

import { Suspense } from 'react'

import { PlatformCardSkeleton } from '@/modules/platforms/components/PlatformCardSkeleton'
import { PlatformList } from '@/modules/platforms/components/PlatformList'

import { SettingsToastHandler } from './SettingsToastHandler'
import { SpeechSettings } from './SpeechSettings'

/**
 * Page des paramètres.
 * Server Component pour le layout — PlatformList est un Client Component (TanStack Query).
 */
export default function SettingsPage(): React.JSX.Element {
  return (
    <div className="mx-auto max-w-2xl space-y-10 py-8">
      {/* Handler des toasts issus des query params OAuth (client-side) */}
      <Suspense>
        <SettingsToastHandler />
      </Suspense>

      {/* ── En-tête ── */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Paramètres</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Gère tes réseaux sociaux et les préférences de ton compte.
        </p>
      </div>

      {/* ── Section : Réseaux sociaux ── */}
      <section>
        <div className="mb-4">
          <h2 className="text-base font-semibold">Réseaux sociaux connectés</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Connecte tes comptes pour commencer à planifier et publier du contenu.
          </p>
        </div>

        {/* Suspense : skeleton pendant l'hydratation du Client Component */}
        <Suspense fallback={<PlatformCardSkeleton count={4} />}>
          <PlatformList />
        </Suspense>
      </section>

      {/* ── Section : Dictée vocale ── */}
      <section>
        <div className="mb-4">
          <h2 className="text-base font-semibold">Dictée vocale</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Règle le comportement du micro lors de la saisie vocale.
          </p>
        </div>
        {/* Client Component : lit/écrit speechSilenceTimeoutMs dans le store Zustand persisté */}
        <SpeechSettings />
      </section>
    </div>
  )
}
