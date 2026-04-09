/**
 * @file app/(auth)/popup-callback/page.tsx
 * @module auth
 * @description Page relais pour le flux OAuth Google en mode popup.
 *
 *   Après que better-auth a traité le callback Google, il redirige vers cette page
 *   (qui est passée comme `callbackURL` dans signIn.social()). Cette page :
 *
 *   1. Détecte qu'elle s'exécute dans une popup (window.opener !== null)
 *   2. Envoie un postMessage({ type: 'oauth-success' }) à la fenêtre parente
 *   3. Se ferme elle-même (window.close())
 *
 *   La fenêtre parente (LoginForm ou RegisterForm) écoute ce message et déclenche
 *   la redirection finale vers /dashboard.
 *
 *   Fallback : si la popup est désactivée et que l'utilisateur arrive ici en pleine
 *   page (window.opener === null), on redirige directement vers /dashboard.
 *
 * @example
 *   // Déclenchement depuis LoginForm.tsx
 *   // Note : le groupe (auth) ne préfixe pas l'URL → l'URL réelle est /popup-callback
 *   signIn.social({ provider: 'google', callbackURL: '/popup-callback' })
 */

'use client'

import React, { useEffect } from 'react'

import { useRouter } from 'next/navigation'

// ─── Composant ────────────────────────────────────────────────────────────────

/**
 * Page relais OAuth — s'exécute dans la popup Google après authentification.
 * Notifie la fenêtre parente via postMessage puis se ferme.
 */
export default function PopupCallbackPage(): React.JSX.Element {
  const router = useRouter()

  useEffect(() => {
    if (window.opener) {
      // Cas nominal : on est dans une popup
      // Envoyer le signal de succès à la fenêtre parente (même origine uniquement)
      window.opener.postMessage({ type: 'oauth-success' }, window.location.origin)
      // Fermer la popup — la fenêtre parente prend le relais
      window.close()
    } else {
      // Fallback : pas de popup (popup bloquée → fallback pleine page déjà géré
      // dans les formulaires, mais au cas où on arrive ici sans opener)
      router.replace('/dashboard')
    }
  }, [router])

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3 text-muted-foreground">
        {/* Spinner minimaliste pendant la fermeture de la popup */}
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="text-sm">Connexion en cours…</p>
      </div>
    </div>
  )
}
