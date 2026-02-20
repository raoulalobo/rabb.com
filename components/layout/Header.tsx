/**
 * @file Header.tsx
 * @module layout
 * @description Barre supérieure du dashboard.
 *   - Bouton toggle pour ouvrir/fermer la sidebar (via useAppStore)
 *   - Titre de la page courante (injecté via props)
 *   - Menu utilisateur (avatar + dropdown déconnexion/paramètres via better-auth)
 *
 * @example
 *   // app/(dashboard)/layout.tsx
 *   <Header />
 */

'use client'

import { Menu } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { UserMenu } from '@/modules/auth/components/UserMenu'
import { useAppStore } from '@/store/app.store'

// ─── Composant ────────────────────────────────────────────────────────────────

/**
 * Barre supérieure du dashboard.
 * Contient le bouton toggle de la sidebar et le menu utilisateur.
 *
 * @returns Header avec toggle sidebar et zone utilisateur
 */
export function Header(): React.JSX.Element {
  // Action toggle du store global
  const toggleSidebar = useAppStore((state) => state.toggleSidebar)

  return (
    <header className="flex h-16 items-center justify-between border-b bg-background px-4">
      {/* ── Gauche : toggle sidebar ──────────────────────────────────── */}
      <Button
        variant="ghost"
        size="icon"
        onClick={toggleSidebar}
        aria-label="Ouvrir ou fermer la navigation latérale"
      >
        <Menu className="size-5" />
      </Button>

      {/* ── Droite : menu utilisateur (avatar + dropdown) ───────────── */}
      <div className="flex items-center gap-3">
        {/* Avatar cliquable → dropdown avec infos, paramètres, déconnexion */}
        <UserMenu />
      </div>
    </header>
  )
}
