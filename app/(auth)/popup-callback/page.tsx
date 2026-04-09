/**
 * @file app/(auth)/popup-callback/page.tsx
 * @module auth
 * @description Page relais pour le flux OAuth Google en mode popup.
 *
 *   Après que better-auth a traité le callback Google, il redirige vers cette page
 *   (passée comme `callbackURL` dans signIn.social()). Cette page :
 *
 *   1. Détecte qu'elle s'exécute dans une popup via window.name === 'google-oauth'
 *   2. Envoie { type: 'oauth-success' } sur un BroadcastChannel partagé avec le parent
 *   3. Se ferme elle-même (window.close())
 *
 *   POURQUOI BroadcastChannel ET PAS postMessage ?
 *   Google envoie l'en-tête `Cross-Origin-Opener-Policy: same-origin` sur ses pages
 *   d'authentification. Quand la popup passe par les serveurs Google, le navigateur
 *   effectue un Browsing Context Group (BCG) switch qui détruit DÉFINITIVEMENT
 *   window.opener — même après que la popup revient sur notre domaine.
 *   BroadcastChannel n'est pas affecté par ce switch : il fonctionne entre tous les
 *   contextes de navigation du même origin (support universel depuis 2022).
 *
 *   Fallback : si window.name n'indique pas une popup (ex : ouverture directe de
 *   l'URL), on redirige vers /dashboard en pleine page.
 *
 * @example
 *   // Déclenchement depuis LoginForm.tsx / RegisterForm.tsx
 *   // Note : le groupe (auth) ne préfixe pas l'URL → l'URL réelle est /popup-callback
 *   signIn.social({ provider: 'google', callbackURL: '/popup-callback', disableRedirect: true })
 *   window.open(url, 'google-oauth', '...')
 */

'use client'

import React, { useEffect } from 'react'

import { useRouter } from 'next/navigation'

import { OAUTH_BROADCAST_CHANNEL, OAUTH_POPUP_NAME } from '@/modules/auth/constants'

// ─── Composant ────────────────────────────────────────────────────────────────

/**
 * Page relais OAuth — s'exécute dans la popup après authentification Google.
 * Notifie la fenêtre parente via BroadcastChannel puis se ferme.
 */
export default function PopupCallbackPage(): React.JSX.Element {
  const router = useRouter()

  useEffect(() => {
    // Détecter le contexte popup via le nom de fenêtre défini lors de window.open().
    // On ne peut PAS utiliser window.opener car Google (COOP: same-origin) le détruit.
    const isPopup = window.name === OAUTH_POPUP_NAME

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
