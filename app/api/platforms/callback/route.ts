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
 *   Filet de sécurité — lateWorkspaceId :
 *   Si connectPlatform.action.ts a créé le workspace Late mais échoué à persister
 *   son ID en DB (timeout réseau, crash serveur), ce callback reçoit quand même
 *   le profileId de getlate.dev et le sauvegarde automatiquement dans User.lateWorkspaceId
 *   si celui-ci est encore NULL. Opération idempotente : sans effet si l'ID est déjà renseigné.
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

  // Filet de sécurité : sync automatique du lateWorkspaceId si absent.
  // Scénario couvert : connectPlatform.action.ts a appelé late.profiles.create()
  // et obtenu le lateWorkspaceId, mais la sauvegarde Prisma (User.lateWorkspaceId)
  // a échoué avant de s'exécuter (erreur réseau, timeout DB, crash serveur).
  // Le workspace existe dans Late mais son ID est perdu en DB → lateWorkspaceId = NULL.
  // getlate.dev renvoie toujours le même profileId dans ce callback → on le récupère ici.
  // updateMany avec where: { lateWorkspaceId: null } est idempotent :
  // aucune mise à jour si l'ID est déjà présent (cas nominal ~100% du temps).
  await prisma.user.updateMany({
    where: {
      id: session.user.id,
      lateWorkspaceId: null, // uniquement si non encore enregistré
    },
    data: { lateWorkspaceId: lateProfileId },
  })

  // Redirection vers settings avec indicateur de succès (pour toast)
  return NextResponse.redirect(
    new URL(`/settings?success=platform_connected&platform=${platform}`, origin),
  )
}
