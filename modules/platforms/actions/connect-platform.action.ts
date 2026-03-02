/**
 * @file modules/platforms/actions/connect-platform.action.ts
 * @module platforms
 * @description Server Action : initie la connexion OAuth d'un réseau social.
 *
 *   Flux complet :
 *   1. Validation Zod de la plateforme demandée
 *   2. Vérification de la session better-auth
 *   3. Récupérer ou créer le workspace Late de l'utilisateur (POST /api/v1/profiles)
 *      → l'ID est stocké dans User.lateWorkspaceId pour les prochains connects
 *   4. Appel GET /api/v1/connect/get-connect-url?profileId=...&redirect_url=...
 *   5. Retour de authUrl au client pour redirection
 *
 *   Note : Late exige un "profileId" (workspace conteneur) avant tout connect OAuth.
 *   Ce workspace est créé une fois par utilisateur et réutilisé pour toutes les plateformes.
 *
 * @example
 *   // Dans un Client Component
 *   const result = await connectPlatform('instagram')
 *   if (result.redirectUrl) window.location.href = result.redirectUrl
 */

'use server'

import { headers } from 'next/headers'

import { auth } from '@/lib/auth'
import { LateApiError, late } from '@/lib/late'
import { prisma } from '@/lib/prisma'
import { ConnectPlatformSchema } from '@/modules/platforms/schemas/platform.schema'
import type { PlatformActionResult } from '@/modules/platforms/types'

/**
 * Initie la connexion OAuth d'une plateforme sociale.
 * Crée ou réutilise le workspace Late de l'utilisateur, puis retourne l'URL OAuth.
 *
 * @param platform - La plateforme à connecter (ex: 'instagram', 'tiktok')
 * @returns { success, redirectUrl } — URL OAuth Late si succès, message d'erreur sinon
 *
 * @example
 *   const result = await connectPlatform('tiktok')
 *   if (result.redirectUrl) router.push(result.redirectUrl)
 */
export async function connectPlatform(platform: unknown): Promise<PlatformActionResult> {
  // 1. Validation Zod (rejet des plateformes inconnues)
  const parseResult = ConnectPlatformSchema.safeParse({ platform })
  if (!parseResult.success) {
    return { success: false, error: 'Plateforme non supportée.' }
  }
  const { platform: validPlatform } = parseResult.data

  // 2. Vérification de la session (server-side via better-auth)
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return { success: false, error: 'Non authentifié. Reconnecte-toi.' }
  }

  const callbackUrl = `${process.env.BETTER_AUTH_URL}/api/platforms/callback`
  console.log('[connectPlatform] plateforme:', validPlatform)
  console.log('[connectPlatform] callbackUrl:', callbackUrl)

  try {
    // 3. Récupérer le workspace Late existant OU en créer un nouveau
    //    Le workspace est un conteneur Late qui regroupe les comptes sociaux de l'utilisateur.
    //    Il est créé une seule fois par utilisateur puis réutilisé pour tous les connects.
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { lateWorkspaceId: true, name: true },
    })

    let lateWorkspaceId = user?.lateWorkspaceId

    if (!lateWorkspaceId) {
      // lateWorkspaceId absent = premier connect de cet utilisateur (création lazy)
      // OU état incohérent : workspace créé chez Late lors d'une tentative précédente,
      // mais l'ID n'a jamais été persisté en DB (crash, timeout, erreur réseau).
      const profileName = user?.name ?? session.user.email ?? 'ogolong user'
      console.log('[connectPlatform] lateWorkspaceId absent → création workspace Late pour:', session.user.id)

      try {
        // Tentative principale : créer un nouveau workspace Late dédié à cet utilisateur
        const workspace = await late.profiles.create({ name: profileName })
        // Late utilise _id (ObjectId MongoDB) et non id
        lateWorkspaceId = workspace._id
        console.log('[connectPlatform] Workspace Late créé:', lateWorkspaceId)
      } catch (createError) {
        // 400 "already exists" = workspace déjà créé chez Late lors d'une tentative
        // précédente (ex: crash après create() mais avant prisma.update()).
        // → Récupérer l'ID depuis la liste Late plutôt que d'afficher une erreur générique.
        const isNameConflict =
          createError instanceof LateApiError &&
          createError.status === 400 &&
          createError.message.toLowerCase().includes('already exists')

        // Toute autre erreur (403, 500, réseau…) est propagée vers le catch externe
        if (!isNameConflict) throw createError

        console.warn('[connectPlatform] Workspace déjà existant chez Late → récupération par nom...')

        // ⚠️ late.profiles.list() retourne TOUS les workspaces du compte Late de ogolong.com.
        //    On cherche uniquement le profil portant le nom de CET utilisateur.
        //    Risque marginal (post-MVP) si deux utilisateurs ont le même nom : utiliser
        //    user.id comme suffixe dans le nom du profil pour garantir l'unicité.
        const profiles = await late.profiles.list()
        const existing = profiles.find((p: { name: string }) => p.name === profileName)

        if (!existing) {
          // Cas improbable : Late signale "already exists" mais ne liste pas le profil.
          // Peut survenir si le profil a été supprimé côté Late entre les deux appels.
          console.error('[connectPlatform] Profil introuvable dans la liste Late malgré le conflit de nom')
          return {
            success: false,
            error: 'Un conflit de profil est survenu. Contacte le support.',
          }
        }

        lateWorkspaceId = existing._id
        console.log('[connectPlatform] Profil Late récupéré avec succès:', lateWorkspaceId)
      }

      // Persister l'ID EN PRIORITÉ avant tout autre appel réseau.
      // ⚠️ Si cette sauvegarde échoue, le workspace Late existe mais son ID est perdu.
      // → Le log ci-dessous permet la récupération manuelle via Supabase SQL Editor :
      //   UPDATE "User" SET "lateWorkspaceId" = '<id>' WHERE id = '<userId>'
      try {
        await prisma.user.update({
          where: { id: session.user.id },
          data: { lateWorkspaceId },
        })
      } catch (prismaError) {
        // Log critique : le workspace Late existe mais n'est pas enregistré en DB.
        // → Récupérer manuellement via :
        //   UPDATE "User" SET "lateWorkspaceId" = '<lateWorkspaceId>' WHERE id = '<userId>'
        console.error(
          `[connectPlatform] ⚠️ CRITIQUE : workspace Late récupéré (${lateWorkspaceId}) mais` +
          ` NON SAUVEGARDÉ en DB pour userId=${session.user.id}. Erreur Prisma :`,
          prismaError,
        )
        throw prismaError
      }
    } else {
      console.log('[connectPlatform] Workspace Late existant (DB):', lateWorkspaceId)
    }

    // 4. Obtenir l'URL OAuth avec la plateforme + le profileId du workspace
    const { authUrl } = await late.connect.getUrl(validPlatform, lateWorkspaceId, callbackUrl)
    console.log('[connectPlatform] authUrl reçu:', authUrl)

    return { success: true, redirectUrl: authUrl }
  } catch (error) {
    // Log complet de l'erreur réelle pour diagnostiquer la cause exacte
    console.error('[connectPlatform] erreur:', error)

    // Plateforme encore en beta chez getlate.dev (ex: Snapchat).
    // → Informer l'utilisateur clairement plutôt que d'afficher un message générique.
    if (error instanceof LateApiError && error.code === 'PLATFORM_BETA_RESTRICTED') {
      return {
        success: false,
        error: `${validPlatform.charAt(0).toUpperCase() + validPlatform.slice(1)} n'est pas encore disponible. La connexion sera activée dès que getlate.dev ouvrira l'intégration au public.`,
      }
    }

    // Autre 403 (quota Late atteint, clé API invalide, etc.)
    if (error instanceof LateApiError && error.status === 403) {
      return {
        success: false,
        error: "Les connexions sont temporairement suspendues. Réessaie dans quelques heures.",
      }
    }

    if (error instanceof LateApiError) {
      return {
        success: false,
        error: `Erreur getlate.dev (${error.status}) : ${error.message}`,
      }
    }
    const message = error instanceof Error ? error.message : String(error)
    return { success: false, error: `Impossible de lancer la connexion : ${message}` }
  }
}
