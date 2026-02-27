/**
 * @file app/(dashboard)/layout.tsx
 * @description Layout partagé pour toutes les pages du dashboard (routes protégées).
 *   Structure : Sidebar à gauche + Header en haut + contenu à droite.
 *
 *   Protection côté serveur via auth.api.getSession() (better-auth) :
 *   si aucune session valide n'est trouvée dans les headers HTTP entrants,
 *   l'utilisateur est redirigé vers /login avant tout rendu DOM.
 *
 * Arborescence des routes protégées :
 *   /dashboard   → Vue d'ensemble (stats rapides)
 *   /compose     → Composer un post
 *   /calendar    → Calendrier de planification
 *   /analytics   → Statistiques détaillées
 *   /inbox       → Messages et commentaires unifiés
 *   /settings    → Compte, réseaux connectés, facturation
 */

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

import { Header } from '@/components/layout/Header'
import { Sidebar } from '@/components/layout/Sidebar'
import { auth } from '@/lib/auth'

interface DashboardLayoutProps {
  children: React.ReactNode
}

/**
 * Layout du dashboard — Sidebar + Header + zone de contenu.
 * Server Component async : vérifie la session avant tout rendu.
 *
 * Flux d'authentification :
 *   1. `headers()` récupère les headers HTTP de la requête entrante (Next.js 15 : async)
 *   2. `auth.api.getSession()` lit le cookie `better-auth.session_token` et valide
 *      la session en base (Prisma/Supabase) — retourne null si invalide ou absente
 *   3. Si null → `redirect('/login')` coupe le rendu et renvoie un 307
 *
 * @param props.children - Page courante injectée par Next.js App Router
 * @returns Shell du dashboard avec navigation et header, ou redirection vers /login
 */
export default async function DashboardLayout({
  children,
}: DashboardLayoutProps): Promise<React.JSX.Element> {
  // Vérification de session côté serveur — auth.api.getSession lit le cookie de session
  // transmis dans les headers HTTP entrants.
  // Si aucune session valide → redirection vers /login avant tout rendu DOM.
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) redirect('/login')

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
