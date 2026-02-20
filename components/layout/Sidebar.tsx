/**
 * @file Sidebar.tsx
 * @module layout
 * @description Barre de navigation latérale du dashboard.
 *   - Affiche le logo rabb et les liens de navigation principaux
 *   - Gère l'état ouvert/réduit via useAppStore (Zustand)
 *   - Sur mobile : se ferme automatiquement après un clic (Sheet pattern à intégrer en phase 04)
 *
 * Navigation principale (MVP) :
 *   - Dashboard (/) → vue d'ensemble rapide
 *   - Compose (/compose) → créer un post
 *   - Calendar (/calendar) → calendrier de planification
 *   - Analytics (/analytics) → statistiques
 *   - Inbox (/inbox) → messages unifiés
 *   - Settings (/settings) → compte et réseaux
 *
 * @example
 *   // app/(dashboard)/layout.tsx
 *   <Sidebar />
 */

'use client'

import {
  BarChart2,
  Calendar,
  Inbox,
  LayoutDashboard,
  PenSquare,
  Settings,
} from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { cn } from '@/lib/utils'
import { useAppStore } from '@/store/app.store'

// ─── Configuration de la navigation ───────────────────────────────────────────

/** Définition d'un item de navigation */
interface NavItem {
  /** Libellé affiché dans la sidebar */
  label: string
  /** Route Next.js cible */
  href: string
  /** Icône Lucide React associée */
  icon: React.ComponentType<{ className?: string }>
}

/**
 * Liste des items de navigation du dashboard (MVP).
 * Ordre : du plus fréquent au moins fréquent selon les cas d'usage créateur.
 */
const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Composer', href: '/compose', icon: PenSquare },
  { label: 'Calendrier', href: '/calendar', icon: Calendar },
  { label: 'Analytics', href: '/analytics', icon: BarChart2 },
  { label: 'Inbox', href: '/inbox', icon: Inbox },
  { label: 'Paramètres', href: '/settings', icon: Settings },
]

// ─── Composant ────────────────────────────────────────────────────────────────

/**
 * Sidebar de navigation principale du dashboard.
 * S'adapte à l'état ouvert/réduit du store global (useAppStore).
 *
 * @returns Barre latérale avec logo, navigation et indicateur de route active
 */
export function Sidebar(): React.JSX.Element {
  // Pathname courant pour surligner le lien actif
  const pathname = usePathname()

  // État sidebar (ouvert/réduit) depuis le store global
  const isSidebarOpen = useAppStore((state) => state.isSidebarOpen)

  return (
    <aside
      className={cn(
        // Transition fluide lors du toggle
        'flex h-full flex-col border-r bg-sidebar transition-all duration-300',
        // Largeur adaptative : 240px ouverte, 64px réduite
        isSidebarOpen ? 'w-60' : 'w-16'
      )}
    >
      {/* ── Logo ─────────────────────────────────────────────────────── */}
      <div className="flex h-16 items-center border-b px-4">
        <Link href="/dashboard" className="flex items-center gap-2">
          {/* Placeholder logo — sera remplacé en phase 03 (branding) */}
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-sm">
            r
          </div>
          {/* Nom masqué quand la sidebar est réduite */}
          {isSidebarOpen && (
            <span className="font-semibold text-sidebar-foreground">rabb</span>
          )}
        </Link>
      </div>

      {/* ── Navigation ───────────────────────────────────────────────── */}
      <nav className="flex-1 space-y-1 p-2">
        {NAV_ITEMS.map(({ label, href, icon: Icon }) => {
          // Un lien est actif si le pathname commence par son href
          const isActive = pathname === href || pathname.startsWith(`${href}/`)

          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                // Actif : fond accentué + couleur primaire
                isActive
                  ? 'bg-sidebar-accent text-sidebar-primary'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground'
              )}
            >
              <Icon className="size-4 shrink-0" />
              {/* Libellé masqué quand la sidebar est réduite */}
              {isSidebarOpen && <span>{label}</span>}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
