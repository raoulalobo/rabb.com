/**
 * @file app/api/platforms/route.ts
 * @description Route Handler GET : liste les plateformes connectées de l'utilisateur,
 *   enrichies avec les avatars frais récupérés depuis Late API (GET /v1/accounts).
 *   Utilisé par le hook usePlatforms (TanStack Query) côté client.
 *
 *   Logique de sync avatar :
 *   1. Récupère les plateformes en DB (Prisma)
 *   2. Appelle Late API pour obtenir les comptes frais (incluant profileImage)
 *   3. Croise par (platform + lateProfileId) pour trouver l'avatar correspondant
 *   4. Met à jour la DB en fire-and-forget si l'avatar a changé
 *   5. Retourne les plateformes enrichies immédiatement (pas d'attente de la mise à jour DB)
 *
 *   GET /api/platforms
 *   → Response : PlatformListItem[] (avec avatarUrl enrichi)
 *
 * @example
 *   const res = await fetch('/api/platforms')
 *   const platforms = await res.json()
 *   // [{ id: '...', platform: 'instagram', accountName: '@marie', avatarUrl: 'https://...', ... }]
 */

import { headers } from 'next/headers'
import { NextResponse } from 'next/server'

import { auth } from '@/lib/auth'
import { late } from '@/lib/late'
import { prisma } from '@/lib/prisma'
import type { LateAccount } from '@/lib/late'

/**
 * Extrait l'URL d'avatar depuis un objet LateAccount brut.
 * Late API peut retourner le champ avatar sous différents noms selon la plateforme.
 * On essaie les noms connus dans l'ordre de priorité.
 *
 * @param account - L'objet LateAccount (avec champs avatar optionnels)
 * @returns L'URL de l'avatar ou null si aucun champ trouvé
 *
 * @example
 *   extractAvatar({ profileImage: 'https://cdn.tiktok.com/avatar.jpg', ... })
 *   // → 'https://cdn.tiktok.com/avatar.jpg'
 */
function extractAvatar(account: LateAccount): string | null {
  // `profilePicture` est le champ réel retourné par Late API sur toutes les plateformes
  // (confirmé par debug sur Facebook, TikTok, Twitter, YouTube, Instagram).
  // Les autres noms sont conservés comme fallback au cas où Late changerait son API.
  return (
    account.profilePicture ??
    account.profileImage ??
    account.avatarUrl ??
    account.picture ??
    account.thumbnailUrl ??
    null
  )
}

/**
 * GET /api/platforms
 * Liste les plateformes connectées de l'utilisateur authentifié,
 * enrichies avec les avatars récupérés depuis Late API.
 *
 * @returns 200 avec la liste des plateformes connectées (avatarUrl enrichi si disponible)
 * @returns 401 si non authentifié
 */
export async function GET(): Promise<NextResponse> {
  // Vérification de la session
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  // 1. Récupération des plateformes de l'utilisateur depuis la DB
  const dbPlatforms = await prisma.connectedPlatform.findMany({
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

  // 2. Appel Late API pour récupérer les comptes frais (avec avatar)
  //    On n'échoue pas si Late est indisponible — on retourne les données DB
  let lateAccounts: LateAccount[] = []
  try {
    lateAccounts = await late.accounts.list()
  } catch {
    // Late API indisponible — on continue avec les données DB existantes
    console.warn('[GET /api/platforms] Late API indisponible, avatars non rafraîchis')
  }

  // 3. Enrichissement de chaque plateforme avec l'avatar Late
  const enriched = dbPlatforms.map((p) => {
    // Chercher le compte Late correspondant par (platform + lateProfileId)
    const match = lateAccounts.find((la) => {
      // profileId peut être un objet { _id, name } ou une string directe
      const pid = typeof la.profileId === 'string' ? la.profileId : la.profileId._id
      return la.platform === p.platform && pid === p.lateProfileId
    })

    // Extraire l'avatar depuis le compte Late trouvé (essaie plusieurs noms de champs)
    const freshAvatar = match ? extractAvatar(match) : null

    // 4. Mise à jour DB en fire-and-forget si l'avatar a changé
    //    On ne bloque pas la réponse pour ça — c'est un enrichissement asynchrone
    if (freshAvatar && freshAvatar !== p.avatarUrl) {
      prisma.connectedPlatform
        .update({
          where: { id: p.id },
          data: { avatarUrl: freshAvatar },
        })
        .catch((err: unknown) => {
          console.error(`[GET /api/platforms] Échec mise à jour avatar pour ${p.id}:`, err)
        })
    }

    // 5. Retourner la plateforme avec l'avatar frais (ou l'avatar DB si pas de mise à jour)
    return {
      ...p,
      avatarUrl: freshAvatar ?? p.avatarUrl,
    }
  })

  return NextResponse.json(enriched)
}
