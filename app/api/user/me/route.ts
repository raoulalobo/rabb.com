/**
 * @file app/api/user/me/route.ts
 * @description API Route — retourne le profil complet de l'utilisateur connecté,
 *   y compris les champs custom Prisma non inclus dans la session better-auth
 *   (avatarUrl, description).
 *
 *   Utilisée par UserMenu pour afficher l'avatar uploadé sans attendre
 *   l'expiration du cache de session better-auth (cookieCache.maxAge = 5min).
 *
 * @example
 *   const res = await fetch('/api/user/me')
 *   const { avatarUrl, name, email } = await res.json()
 */

import { headers } from 'next/headers'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// ─── Types ────────────────────────────────────────────────────────────────────

/** Réponse de l'endpoint GET /api/user/me */
export interface UserMeResponse {
  /** URL de l'avatar uploadé manuellement (Supabase Storage), null si non défini */
  avatarUrl: string | null
  /** Nom d'affichage de l'utilisateur */
  name: string | null
  /** Email de l'utilisateur */
  email: string
  /** Description / bio de l'utilisateur */
  description: string | null
}

// ─── Handler GET ──────────────────────────────────────────────────────────────

/**
 * Retourne le profil complet de l'utilisateur authentifié.
 * Lit directement depuis Prisma pour obtenir les champs non inclus
 * dans le cookie de session better-auth (avatarUrl, description).
 *
 * @returns 200 { avatarUrl, name, email, description } | 401 | 500
 */
export async function GET(): Promise<Response> {
  // ── Vérification de la session ─────────────────────────────────────────────
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) {
    return Response.json({ error: 'Non authentifié' }, { status: 401 })
  }

  // ── Lecture du profil complet depuis Prisma ────────────────────────────────
  // On sélectionne uniquement les champs nécessaires (pas de données sensibles)
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      avatarUrl: true,
      name: true,
      email: true,
      description: true,
    },
  })

  if (!user) {
    return Response.json({ error: 'Utilisateur introuvable' }, { status: 404 })
  }

  const response: UserMeResponse = {
    avatarUrl: user.avatarUrl,
    name: user.name,
    email: user.email,
    description: user.description,
  }

  return Response.json(response)
}
