/**
 * @file app/(auth)/layout.tsx
 * @description Layout pour les pages d'authentification (login, register, reset-password).
 *   Centrage vertical et horizontal de la carte de formulaire.
 *   Pas de sidebar ni de header — UI épurée pour l'onboarding.
 */

interface AuthLayoutProps {
  children: React.ReactNode
}

/**
 * Layout centré pour les pages d'authentification.
 * Fond légèrement grisé pour distinguer la zone de la carte.
 *
 * @param props.children - Page d'auth (login, register ou reset-password)
 * @returns Conteneur centré full-screen avec fond
 */
export default function AuthLayout({ children }: AuthLayoutProps): React.JSX.Element {
  return (
    // Conteneur full-screen avec fond muted et centrage parfait
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4 py-12">
      {children}
    </div>
  )
}
