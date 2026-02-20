/**
 * @file app/api/platforms/route.ts
 * @description Route Handler GET : liste les plateformes connectées de l'utilisateur.
 *   Utilisé par le hook usePlatforms (TanStack Query) côté client.
 *   Retourne uniquement les plateformes de l'utilisateur connecté.
 *
 *   GET /api/platforms
 *   → Response : PlatformListItem[]
 *
 * @example
 *   const res = await fetch('/api/platforms')
 *   const platforms = await res.json()
 *   // [{ id: '...', platform: 'instagram', accountName: '@marie', ... }]
 */

import { headers } from 'next/headers'
import { NextResponse } from 'next/server'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/platforms
 * Liste les plateformes connectées de l'utilisateur authentifié.
 *
 * @returns 200 avec la liste des plateformes connectées
 * @returns 401 si non authentifié
 */
export async function GET(): Promise<NextResponse> {
  // Vérification de la session
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  // Récupération des plateformes de l'utilisateur (sans userId — inutile côté client)
  const platforms = await prisma.connectedPlatform.findMany({
    where: { userId: session.user.id, isActive: true },
    select: {
      id: true,
      platform: true,
      lateProfileId: true,
      accountName: true,
      avatarUrl: true,
      isActive: true,
      connectedAt: true,
    },
    orderBy: { connectedAt: 'asc' },
  })

  return NextResponse.json(platforms)
}
