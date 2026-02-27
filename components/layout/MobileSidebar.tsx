/**
 * @file MobileSidebar.tsx
 * @module layout
 * @description Navigation mobile du dashboard — panneau latéral (Sheet) glissant
 *   depuis la gauche, contrôlé par `useAppStore.isSidebarOpen`.
 *
 *   Visible uniquement sur mobile (< md). Sur desktop, la `<Sidebar>` classique
 *   prend le relais (`hidden md:flex`).
 *
 *   Partage les mêmes `NAV_ITEMS` que `Sidebar.tsx` pour éviter toute duplication.
 *   Se ferme automatiquement après chaque navigation (clic sur un lien).
 *
 * @example
 *   // components/layout/Header.tsx
 *   <MobileSidebar />  // rendu dans le Header, portal Radix gère le positionnement
 */

'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { cn } from '@/lib/utils'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { NAV_ITEMS } from '@/components/layout/Sidebar'
import { useAppStore } from '@/store/app.store'

// ─── Composant ────────────────────────────────────────────────────────────────

/**
 * Menu de navigation mobile sous forme de Sheet (drawer latéral gauche).
 * Contrôlé par le store global `isSidebarOpen` / `setSidebarOpen`.
 *
 * @returns Sheet accessible avec navigation complète, invisible sur desktop (md+)
 */
export function MobileSidebar(): React.JSX.Element {
  const pathname = usePathname()
  const { isSidebarOpen, setSidebarOpen } = useAppStore()

  return (
    /*
     * Le Sheet est un portal Radix : il se rend en dehors du DOM courant.
     * `open` et `onOpenChange` synchronisent l'état avec le store Zustand.
     */
    <Sheet open={isSidebarOpen} onOpenChange={setSidebarOpen}>
      {/*
       * SheetContent côté "left" : le drawer glisse depuis la gauche,
       * cohérent avec la position de la sidebar desktop.
       * w-60 : même largeur que la sidebar desktop (240px).
       * p-0 : on gère le padding en interne pour reproduire l'UI sidebar.
       */}
      <SheetContent side="left" className="w-60 p-0 bg-sidebar">

        {/* ── En-tête du Sheet — logo ogolong ──────────────────────────── */}
        <SheetHeader className="flex h-16 flex-row items-center border-b px-4">
          {/*
           * SheetTitle : requis par Radix pour l'accessibilité (aria-labelledby).
           * Contient le logo + nom de l'app, identique à la sidebar desktop.
           */}
          <SheetTitle className="flex items-center gap-2 font-semibold text-sidebar-foreground">
            {/* Logo ogolong — identique à Sidebar.tsx */}
            <div
              className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-sm"
              aria-label="Logo ogolong"
            >
              o
            </div>
            ogolong
          </SheetTitle>
        </SheetHeader>

        {/* ── Navigation ─────────────────────────────────────────────── */}
        <nav className="flex-1 space-y-1 p-2" aria-label="Navigation mobile">
          {NAV_ITEMS.map(({ label, href, icon: Icon }) => {
            // Même logique d'activation que dans Sidebar.tsx
            const isActive = pathname === href || pathname.startsWith(`${href}/`)

            return (
              <Link
                key={href}
                href={href}
                // Fermer le Sheet après navigation (UX standard mobile)
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-sidebar-accent text-sidebar-primary'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground'
                )}
              >
                <Icon className="size-4 shrink-0" />
                <span>{label}</span>
              </Link>
            )
          })}
        </nav>
      </SheetContent>
    </Sheet>
  )
}
