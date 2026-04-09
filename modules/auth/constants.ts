/**
 * @file modules/auth/constants.ts
 * @module auth
 * @description Constantes partagées pour le flux OAuth Google en mode popup.
 *
 * Ces constantes sont utilisées conjointement par :
 * - app/(auth)/popup-callback/page.tsx  → émet le signal sur le canal
 * - modules/auth/components/LoginForm.tsx  → écoute le canal
 * - modules/auth/components/RegisterForm.tsx → écoute le canal
 */

/**
 * Nom du BroadcastChannel partagé entre la popup OAuth et la fenêtre parente.
 * BroadcastChannel contourne COOP (Cross-Origin-Opener-Policy: same-origin de Google)
 * qui détruit window.opener lors du passage par les serveurs Google.
 */
export const OAUTH_BROADCAST_CHANNEL = 'ogolong-oauth-callback'

/**
 * Nom donné à la popup lors de window.open().
 * Utilisé dans /popup-callback pour détecter le contexte popup via window.name,
 * car window.opener est null après navigation cross-origin (COOP Google).
 */
export const OAUTH_POPUP_NAME = 'google-oauth'
