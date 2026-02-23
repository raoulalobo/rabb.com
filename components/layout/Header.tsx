/**
 * @file Header.tsx
 * @module layout
 * @description Barre supérieure du dashboard.
 *   - Menu utilisateur (avatar + dropdown déconnexion/paramètres via better-auth)
 *   - Bouton hamburger (mobile uniquement, md:hidden) → ouvre MobileSidebar
 *
 *   Responsive :
 *   - Mobile (< md) : hamburger à gauche, menu utilisateur à droite
 *   - Desktop (md+) : menu utilisateur à droite uniquement (sidebar toujours visible)
 *
 * @example
 *   // app/(dashboard)/layout.tsx
 *   <Header />
 */

'use client'

import { Menu } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { MobileSidebar } from '@/components/layout/MobileSidebar'
import { UserMenu } from '@/modules/auth/components/UserMenu'
import { useAppStore } from '@/store/app.store'

// ─── Composant ────────────────────────────────────────────────────────────────

/**
 * Barre supérieure du dashboard.
 *
 * Sur mobile : affiche un bouton hamburger à gauche qui déclenche
 * l'ouverture de `MobileSidebar` (Sheet depuis la gauche).
 * Sur desktop : seul le menu utilisateur est visible (sidebar fixe).
 *
 * @returns Header avec hamburger mobile + MobileSidebar + menu utilisateur
 */
export function Header(): React.JSX.Element {
  const { setSidebarOpen } = useAppStore()

  return (
    <header className="flex h-16 items-center justify-between border-b bg-background px-4">

      {/* ── Gauche : hamburger menu (mobile uniquement) ──────────────────── */}
      {/*
       * md:hidden : invisible sur desktop (la sidebar est déjà visible).
       * Ouvre le MobileSidebar via setSidebarOpen(true).
       */}
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden"
        onClick={() => setSidebarOpen(true)}
        aria-label="Ouvrir le menu de navigation"
      >
        <Menu className="size-5" />
      </Button>

      {/*
       * Spacer desktop : sur md+, le bouton hamburger est caché (md:hidden),
       * ce bloc vide maintient le menu utilisateur à droite via justify-between.
       * Sur mobile, le spacer n'est pas nécessaire (hamburger prend la place).
       */}
      <div className="hidden md:block" aria-hidden="true" />

      {/* ── Droite : menu utilisateur (avatar + dropdown) ───────────────── */}
      <div className="flex items-center gap-3">
        {/* Avatar cliquable → dropdown avec infos, paramètres, déconnexion */}
        <UserMenu />
      </div>

      {/*
       * MobileSidebar : Sheet portal Radix, rendu en dehors du DOM du Header.
       * Placé ici pour colocater la logique de navigation mobile avec son déclencheur.
       * Invisible sur desktop (le Sheet ne s'ouvre que si isSidebarOpen = true).
       */}
      <MobileSidebar />
    </header>
  )
}
