/**
 * @file proxy.ts
 * @description Proxy Next.js 16 (ancien middleware.ts) pour la protection des routes du dashboard.
 *   Vérifie la session better-auth en appelant l'endpoint /api/auth/get-session.
 *   Redirige vers /login si l'utilisateur n'est pas authentifié.
 *   Redirige vers / si un utilisateur connecté tente d'accéder à /login ou /register.
 *
 *   Routes protégées : tout ce qui n'est pas /login, /register, /reset-password ou /api
 *   Routes publiques : /login, /register, /reset-password, /api/*
 *
 *   Note : Next.js 16 a renommé le fichier `middleware.ts` en `proxy.ts`.
 *
 * @see https://better-auth.com/docs/integrations/next-js#middleware
 */

import { betterFetch } from '@better-fetch/fetch'
import { NextRequest, NextResponse } from 'next/server'

import type { Session } from '@/lib/auth'

// ─── Routes publiques (pas de vérification de session) ────────────────────────
// '/' = landing page publique (app/page.tsx) — accessible à tous
const PUBLIC_PATHS = ['/', '/login', '/register', '/reset-password']

/**
 * Proxy de protection des routes (Next.js 16 — remplace middleware).
 * Utilise betterFetch pour appeler l'endpoint de session better-auth.
 *
 * @param request - Requête Next.js entrante
 * @returns Redirection ou passage à la suite
 */
export async function proxy(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl

  // Les routes API gèrent leur propre authentification (auth, inngest, etc.)
  // On ne vérifie pas la session ici pour éviter de bloquer les webhooks externes.
  if (pathname.startsWith('/api/')) {
    return NextResponse.next()
  }

  const isPublicPath = PUBLIC_PATHS.some((path) => pathname.startsWith(path))

  // Récupérer la session via l'endpoint better-auth
  const { data: session } = await betterFetch<Session>('/api/auth/get-session', {
    baseURL: request.nextUrl.origin,
    headers: {
      // Transmettre les cookies de session pour que better-auth puisse les lire
      cookie: request.headers.get('cookie') ?? '',
    },
  })

  // Utilisateur non connecté sur une route protégée → redirection vers login
  if (!isPublicPath && !session) {
    const loginUrl = new URL('/login', request.url)
    // Conserver l'URL cible pour rediriger après connexion
    loginUrl.searchParams.set('callbackUrl', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Utilisateur connecté sur /login ou /register → redirection vers le dashboard
  // (on laisse passer les connectés sur '/' pour qu'ils voient la landing page)
  const isAuthPage = ['/login', '/register'].some((p) => pathname.startsWith(p))
  if (isAuthPage && session) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return NextResponse.next()
}

/**
 * Configuration du matcher du middleware.
 * Exclut les fichiers statiques Next.js (_next/static, _next/image, favicon)
 * pour éviter de vérifier la session sur chaque asset.
 */
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
