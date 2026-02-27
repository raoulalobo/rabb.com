/**
 * @file Sidebar.tsx
 * @module layout
 * @description Barre de navigation latérale du dashboard.
 *   - Affiche le logo rabb et les liens de navigation principaux
 *   - Responsive : visible en desktop (md+), cachée sur mobile
 *   - Sur mobile, la navigation est assurée par MobileSidebar (Sheet)
 *
 * Navigation principale (MVP) :
 *   - Dashboard (/dashboard)  → vue d'ensemble rapide
 *   - Composer (/compose)     → créer / lister / éditer des posts
 *   - Analytics (/analytics)  → statistiques
 *   - Inbox (/inbox)          → messages unifiés
 *   - Settings (/settings)    → compte et réseaux
 *
 * @example
 *   // app/(dashboard)/layout.tsx
 *   <Sidebar />  // visible uniquement sur md+
 */

'use client'

import {
  BarChart2,
  FileSignature,
  Images,
  Inbox,
  LayoutDashboard,
  PenSquare,
  Settings,
  UserCircle,
} from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { cn } from '@/lib/utils'

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
 * Exportée pour être réutilisée par MobileSidebar sans duplication.
 * Ordre : du plus fréquent au moins fréquent selon les cas d'usage créateur.
 */
export const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard',   href: '/dashboard',   icon: LayoutDashboard },
  { label: 'Composer',    href: '/compose',     icon: PenSquare },
  // Galerie : bibliothèque de médias réutilisables dans les posts
  { label: 'Galerie',     href: '/gallery',     icon: Images },
  // Signatures : blocs de texte réutilisables (hashtags, CTA) par plateforme
  { label: 'Signatures',  href: '/signatures',  icon: FileSignature },
  { label: 'Analytics',   href: '/analytics',   icon: BarChart2 },
  { label: 'Inbox',       href: '/inbox',       icon: Inbox },
  { label: 'Profil',      href: '/profile',     icon: UserCircle },
  { label: 'Paramètres',  href: '/settings',    icon: Settings },
]

// ─── Composant ────────────────────────────────────────────────────────────────

/**
 * Sidebar de navigation principale du dashboard.
 * Visible uniquement en desktop (md+) via `hidden md:flex`.
 * Sur mobile, la navigation est gérée par MobileSidebar (Sheet).
 *
 * @returns Barre latérale avec logo, navigation et indicateur de route active
 */
export function Sidebar(): React.JSX.Element {
  // Pathname courant pour surligner le lien actif
  const pathname = usePathname()

  return (
    // hidden md:flex : invisible sur mobile, flex-col sur desktop (≥ 768px)
    <aside className="hidden md:flex h-full w-60 flex-col border-r bg-sidebar">
      {/* ── Logo ─────────────────────────────────────────────────────── */}
      <div className="flex h-16 items-center border-b px-4">
        <Link href="/dashboard" className="flex items-center gap-2">
          {/* Placeholder logo — sera remplacé en phase 03 (branding) */}
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-sm">
            r
          </div>
          <span className="font-semibold text-sidebar-foreground">rabb</span>
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
              <span>{label}</span>
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
