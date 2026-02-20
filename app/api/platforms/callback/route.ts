/**
 * @file app/api/platforms/callback/route.ts
 * @description Callback OAuth après autorisation sur le réseau social.
 *   getlate.dev redirige ici avec les paramètres du compte connecté.
 *   Sauvegarde le profil en DB (ConnectedPlatform) puis redirige vers /settings.
 *
 *   URL appelée : GET /api/platforms/callback?connected=...&profileId=...&username=...
 *
 *   Paramètres getlate.dev (noms réels constatés sur le terrain) :
 *   - connected  : Nom de la plateforme connectée (ex: 'tiktok', 'instagram')
 *   - profileId  : ID du workspace Late (MongoDB ObjectId)
 *   - username   : Handle / nom d'affichage du compte social
 *   - error      : (optionnel) Code d'erreur si l'OAuth a échoué
 *
 * @example
 *   // URL de callback réelle reçue après OAuth TikTok :
 *   GET /api/platforms/callback?connected=tiktok&profileId=69985455009128c947b08ca5&username=raoulalobo
 */

import { headers } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PlatformEnum } from '@/modules/platforms/schemas/platform.schema'

/**
 * Handler GET du callback OAuth getlate.dev.
 * Valide les paramètres, sauvegarde la plateforme et redirige.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams, origin } = new URL(request.url)

  // Log de diagnostic : affiche tous les params reçus pour identifier le vrai schéma
  // de réponse de getlate.dev (utile lors des premiers tests OAuth)
  console.log('[callback] params reçus de getlate.dev :', Object.fromEntries(searchParams))

  // Vérifier si getlate.dev a retourné une erreur OAuth
  const oauthError = searchParams.get('error')
  if (oauthError) {
    return NextResponse.redirect(
      new URL(`/settings?error=platform_oauth&reason=${encodeURIComponent(oauthError)}`, origin),
    )
  }

  // Extraire les paramètres du callback
  // Noms réels constatés (getlate.dev) : connected, profileId, username
  const platformRaw = searchParams.get('connected')
  const lateProfileId = searchParams.get('profileId')
  const accountName = searchParams.get('username')
  const avatarUrl = searchParams.get('avatarUrl') ?? undefined

  // Valider les paramètres obligatoires
  if (!lateProfileId || !platformRaw || !accountName) {
    return NextResponse.redirect(
      new URL('/settings?error=platform_callback_invalid', origin),
    )
  }

  // Valider la plateforme via Zod
  const platformParse = PlatformEnum.safeParse(platformRaw)
  if (!platformParse.success) {
    return NextResponse.redirect(
      new URL('/settings?error=platform_unknown', origin),
    )
  }
  const platform = platformParse.data

  // Vérifier la session de l'utilisateur
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return NextResponse.redirect(new URL('/login', origin))
  }

  // Upsert : créer ou mettre à jour la plateforme connectée
  // (permet la reconnexion après déconnexion ou changement de compte)
  await prisma.connectedPlatform.upsert({
    where: {
      // Contrainte unique composite définie dans schema.prisma
      userId_platform_lateProfileId: {
        userId: session.user.id,
        platform,
        lateProfileId,
      },
    },
    create: {
      userId: session.user.id,
      platform,
      lateProfileId,
      accountName,
      avatarUrl,
      isActive: true,
    },
    update: {
      accountName,
      avatarUrl,
      isActive: true,
    },
  })

  // Redirection vers settings avec indicateur de succès (pour toast)
  return NextResponse.redirect(
    new URL(`/settings?success=platform_connected&platform=${platform}`, origin),
  )
}
