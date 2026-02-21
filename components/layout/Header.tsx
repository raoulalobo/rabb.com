/**
 * @file Header.tsx
 * @module layout
 * @description Barre supérieure du dashboard.
 *   - Menu utilisateur (avatar + dropdown déconnexion/paramètres via better-auth)
 *   - Pas de bouton toggle sidebar (sidebar toujours visible à largeur fixe)
 *
 * @example
 *   // app/(dashboard)/layout.tsx
 *   <Header />
 */

'use client'

import { UserMenu } from '@/modules/auth/components/UserMenu'

// ─── Composant ────────────────────────────────────────────────────────────────

/**
 * Barre supérieure du dashboard.
 * Contient uniquement le menu utilisateur (avatar + dropdown).
 *
 * @returns Header avec zone utilisateur à droite
 */
export function Header(): React.JSX.Element {
  return (
    <header className="flex h-16 items-center justify-end border-b bg-background px-4">
      {/* ── Droite : menu utilisateur (avatar + dropdown) ───────────── */}
      <div className="flex items-center gap-3">
        {/* Avatar cliquable → dropdown avec infos, paramètres, déconnexion */}
        <UserMenu />
      </div>
    </header>
  )
}
