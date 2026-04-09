/**
 * @file app/(auth)/popup-callback/page.tsx
 * @module auth
 * @description Page relais pour le flux OAuth Google en mode popup.
 *
 *   Après que better-auth a traité le callback Google, il redirige vers cette page
 *   (passée comme `callbackURL` dans signIn.social()). Cette page :
 *
 *   1. Détecte qu'elle s'exécute dans une popup via le paramètre URL ?mode=popup
 *   2. Envoie { type: 'oauth-success' } sur un BroadcastChannel partagé avec le parent
 *   3. Se ferme elle-même (window.close())
 *
 *   POURQUOI UN PARAMÈTRE URL ET PAS window.name / window.opener ?
 *   Google envoie COOP: same-origin ET efface window.name lors des navigations cross-origin.
 *   Résultat : window.opener ET window.name sont tous les deux null/"" à l'arrivée sur cette page.
 *   Le paramètre URL (?mode=popup) est inclus dans callbackURL → better-auth le préserve
 *   dans la redirection finale → survit à toutes les redirections OAuth.
 *
 *   POURQUOI BroadcastChannel ET PAS postMessage ?
 *   window.opener est null (COOP Google) → impossible d'utiliser postMessage vers le parent.
 *   BroadcastChannel fonctionne entre tous les contextes du même origin sans opener.
 *
 *   Fallback : si ?mode=popup est absent (URL ouverte directement), on redirige vers /dashboard.
 *
 * @example
 *   // Déclenchement depuis LoginForm.tsx / RegisterForm.tsx
 *   // Note : le groupe (auth) ne préfixe pas l'URL → l'URL réelle est /popup-callback
 *   signIn.social({ provider: 'google', callbackURL: '/popup-callback?mode=popup', disableRedirect: true })
 *   window.open(url, 'google-oauth', '...')
 */

'use client'

import React, { useEffect } from 'react'

import { useRouter, useSearchParams } from 'next/navigation'

import { OAUTH_BROADCAST_CHANNEL } from '@/modules/auth/constants'

// ─── Composant ────────────────────────────────────────────────────────────────

/**
 * Page relais OAuth — s'exécute dans la popup après authentification Google.
 * Notifie la fenêtre parente via BroadcastChannel puis se ferme.
 */
export default function PopupCallbackPage(): React.JSX.Element {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    // Détecter le contexte popup via le paramètre URL ?mode=popup.
    // window.name et window.opener sont tous les deux effacés par le navigateur
    // lors du passage cross-origin sur les serveurs Google (COOP + sécurité navigateur).
    // Le paramètre URL est la seule valeur qui survit à travers toutes les redirections OAuth.
    const isPopup = searchParams.get('mode') === 'popup'

    if (isPopup) {
      // Envoyer le signal de succès via BroadcastChannel (même origin, pas d'opener requis)
      const channel = new BroadcastChannel(OAUTH_BROADCAST_CHANNEL)
      channel.postMessage({ type: 'oauth-success' })
      channel.close()
      // Fermer la popup — la fenêtre parente prend le relais
      window.close()
    } else {
      // Fallback : URL ouverte directement en pleine page (pas de popup)
      router.replace('/dashboard')
    }
  }, [router, searchParams])

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
