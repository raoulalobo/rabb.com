/**
 * @file app/api/platforms/callback/route.ts
 * @description Callback OAuth après autorisation sur le réseau social.
 *   Zernio redirige ici avec les paramètres du compte connecté.
 *   Sauvegarde le profil en DB (ConnectedPlatform) puis redirige vers /settings.
 *
 *   URL appelée : GET /api/platforms/callback?connected=...&profileId=...&username=...
 *
 *   Paramètres Zernio (noms réels constatés sur le terrain) :
 *   - connected  : Nom de la plateforme connectée (ex: 'tiktok', 'instagram')
 *   - profileId  : ID du workspace Late (MongoDB ObjectId)
 *   - username   : Handle / nom d'affichage du compte social
 *   - error      : (optionnel) Code d'erreur si l'OAuth a échoué
 *
 *   Filet de sécurité — lateWorkspaceId :
 *   Si connectPlatform.action.ts a créé le workspace Late mais échoué à persister
 *   son ID en DB (timeout réseau, crash serveur), ce callback reçoit quand même
 *   le profileId de Zernio et le sauvegarde automatiquement dans User.lateWorkspaceId
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
 * Handler GET du callback OAuth Zernio.
 * Valide les paramètres, sauvegarde la plateforme et redirige.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams, origin } = new URL(request.url)

  // Log de diagnostic : affiche tous les params reçus pour identifier le vrai schéma
  // de réponse de Zernio (utile lors des premiers tests OAuth)
  console.log('[callback] params reçus de Zernio :', Object.fromEntries(searchParams))

  // Vérifier si Zernio a retourné une erreur OAuth
  const oauthError = searchParams.get('error')
  if (oauthError) {
    return NextResponse.redirect(
      new URL(`/settings?error=platform_oauth&reason=${encodeURIComponent(oauthError)}`, origin),
    )
  }

  // Extraire les paramètres du callback
  // Noms réels constatés (Zernio) : connected, profileId, username
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

  // Bloc DB : upsert plateforme + sauvegarde workspace + avancement onboarding.
  // Protégé dans un try/catch : une erreur DB (ex: pool PgBouncer saturé) causerait
  // sinon une réponse 500 non contrôlée au lieu d'une redirection propre.
  let onboardingStep: number | undefined
  try {
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

    // Sauvegarder le lateWorkspaceId en DB maintenant que l'OAuth est confirmé.
    // C'est ici (et uniquement ici) que l'ID est persisté, jamais dans connectPlatform().
    //
    // Pourquoi ici seulement : un utilisateur qui abandonne le flux OAuth ne génère
    // pas de callback → son lateWorkspaceId n'est jamais sauvegardé → onboardingStep
    // reste à 0 → l'onboarding s'affiche correctement à la prochaine visite.
    //
    // updateMany est idempotent : si le même profileId est déjà en DB (reconnexion
    // d'un réseau ou ajout d'une 2e plateforme), la mise à jour ne change rien.
    await prisma.user.updateMany({
      where: { id: session.user.id },
      data: { lateWorkspaceId: lateProfileId },
    })

    // Avancer l'onboarding de 0 → 1 si c'est le premier réseau connecté.
    // updateMany avec where: { onboardingStep: 0 } est idempotent : pas d'effet si déjà avancé.
    await prisma.user.updateMany({
      where: {
        id: session.user.id,
        onboardingStep: 0,
      },
      data: { onboardingStep: 1 },
    })

    // Récupérer l'étape d'onboarding pour choisir la redirection finale
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { onboardingStep: true },
    })
    onboardingStep = user?.onboardingStep
  } catch (dbError) {
    // Erreur DB (pool saturé, connexion morte, etc.) → redirection d'erreur propre.
    // On ne laisse pas remonter une 500 non contrôlée après un flux OAuth réussi.
    console.error('[callback] Erreur DB lors de la sauvegarde de la plateforme :', dbError)
    return NextResponse.redirect(
      new URL('/settings?error=platform_callback_db', origin),
    )
  }

  // Si l'utilisateur est en onboarding (étape 0 → 1), rediriger vers /dashboard
  // pour afficher l'étape 2 (créer un post). Sinon, rediriger vers /settings.
  const redirectPath = onboardingStep === 1
    ? `/dashboard`
    : `/settings?success=platform_connected&platform=${platform}`

  return NextResponse.redirect(new URL(redirectPath, origin))
}
