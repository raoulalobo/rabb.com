/**
 * @file app/(dashboard)/layout.tsx
 * @description Layout partagé pour toutes les pages du dashboard (routes protégées).
 *   Structure : Sidebar à gauche + Header en haut + contenu à droite.
 *
 *   Ce layout sera enrichi en phase 02 avec :
 *   - AuthGuard (vérification de session better-auth côté serveur)
 *   - Redirection vers /login si non connecté
 *
 * Arborescence des routes protégées :
 *   /dashboard   → Vue d'ensemble (stats rapides)
 *   /compose     → Composer un post
 *   /calendar    → Calendrier de planification
 *   /analytics   → Statistiques détaillées
 *   /inbox       → Messages et commentaires unifiés
 *   /settings    → Compte, réseaux connectés, facturation
 */

import { Header } from '@/components/layout/Header'
import { Sidebar } from '@/components/layout/Sidebar'

interface DashboardLayoutProps {
  children: React.ReactNode
}

/**
 * Layout du dashboard — Sidebar + Header + zone de contenu.
 * Server Component : pas de 'use client', le data fetching peut se faire ici.
 *
 * @param props.children - Page courante injectée par Next.js App Router
 * @returns Shell du dashboard avec navigation et header
 */
export default function DashboardLayout({
  children,
}: DashboardLayoutProps): React.JSX.Element {
  return (
    // Conteneur full-screen en flex row
    <div className="flex h-screen overflow-hidden">
      {/* ── Sidebar — navigation latérale (hauteur full, fixe à gauche) ── */}
      <Sidebar />

      {/* ── Zone principale — flex col : Header en haut, contenu en bas ── */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header : toggle sidebar + menu utilisateur */}
        <Header />

        {/* Contenu de la page avec scroll vertical si nécessaire.
            p-4 sur mobile (16px), p-6 sur desktop (24px) — plus aéré sans gaspiller d'espace.
            bg-background : fond explicite pour que la zone de padding de <main> ait la même
            couleur que les toolbars sticky (bg-background). Sans ça, les éléments collants
            à top: 0 peuvent laisser apparaître du contenu dans le gap entre y=0 et le fond
            de la toolbar. */}
        <main className="flex-1 overflow-y-auto bg-background p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
