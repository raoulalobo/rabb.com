/**
 * @file app/(dashboard)/settings/page.tsx
 * @description Page des paramètres utilisateur (/settings).
 *   Sections (organisées en onglets via SettingsTabs) :
 *   - Réseaux sociaux connectés (PlatformList)
 *   - Préférences : dictée vocale (SpeechSettings)
 *   - Compte : export RGPD + suppression (AccountDangerZone)
 *
 *   Gère les query params success/error du callback OAuth pour afficher des toasts.
 *
 * @example
 *   // Après callback OAuth :
 *   /settings?success=platform_connected&platform=instagram → toast succès
 *   /settings?error=platform_oauth → toast erreur
 */

import { Suspense } from 'react'

import { SettingsToastHandler } from './SettingsToastHandler'
import { SettingsTabs } from './SettingsTabs'

/**
 * Page des paramètres — Server Component.
 * Délègue la navigation en onglets à SettingsTabs (Client Component).
 */
export default function SettingsPage(): React.JSX.Element {
  return (
    <div className="space-y-6">
      {/* Handler silencieux des toasts OAuth (query params success/error) */}
      <Suspense>
        <SettingsToastHandler />
      </Suspense>

      {/* ── En-tête ───────────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Paramètres</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Gère tes réseaux sociaux et les préférences de ton compte.
        </p>
      </div>

      {/* ── Navigation en onglets (Client Component) ──────────────────────── */}
      {/*
       * SettingsTabs organise les 3 sections en onglets distincts :
       * "Réseaux sociaux" / "Préférences" / "Compte"
       */}
      <SettingsTabs />
    </div>
  )
}
