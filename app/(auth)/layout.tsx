/**
 * @file app/(auth)/layout.tsx
 * @description Layout pour les pages d'authentification (login, register, reset-password).
 *   Centrage vertical et horizontal de la carte de formulaire.
 *   Pas de sidebar ni de header — UI épurée pour l'onboarding.
 *
 *   Protection côté serveur : si l'utilisateur a déjà une session valide,
 *   il est redirigé vers /dashboard pour éviter de se re-connecter inutilement.
 *
 *   Footer : liens vers les pages légales (politique de confidentialité, CGU, mentions légales).
 */

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

import { auth } from '@/lib/auth'
import { SiteFooter } from '@/components/shared/SiteFooter'

interface AuthLayoutProps {
  children: React.ReactNode
}

/**
 * Layout centré pour les pages d'authentification.
 * Server Component async : redirige les utilisateurs déjà connectés.
 *
 * Flux :
 *   1. `auth.api.getSession()` valide le cookie de session dans les headers entrants
 *   2. Si session valide → redirect('/dashboard') — l'utilisateur est déjà connecté
 *   3. Sinon → rendu normal du formulaire d'auth + footer légal
 *
 * @param props.children - Page d'auth (login, register ou reset-password)
 * @returns Conteneur centré full-screen avec fond, footer légal, ou redirection vers /dashboard
 */
export default async function AuthLayout({ children }: AuthLayoutProps): Promise<React.JSX.Element> {
  // Si l'utilisateur a déjà une session valide, il n'a pas besoin de se reconnecter.
  // Redirection transparente vers le dashboard.
  const session = await auth.api.getSession({ headers: await headers() })
  if (session) redirect('/dashboard')

  return (
    // Conteneur colonne full-screen : flex-1 sur <main> pousse le footer au bas
    <div className="flex min-h-screen flex-col bg-muted/40">
      {/* Zone principale — flex-1 absorbe tout l'espace disponible et centre le formulaire */}
      <main className="flex flex-1 items-center justify-center px-4 py-12">
        {children}
      </main>

      {/* Footer épinglé en bas — poussé naturellement par flex-1 de <main> */}
      <SiteFooter />
    </div>
  )
}
