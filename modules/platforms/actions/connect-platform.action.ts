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
 *   4. Guard doublon : vérifier qu'aucun compte de cette plateforme n'est déjà connecté
 *      sur ce profileId (contrainte métier : 1 seul compte par plateforme par profileId)
 *   5. Appel GET /api/v1/connect/get-connect-url?profileId=...&redirect_url=...
 *   6. Retour de authUrl au client pour redirection
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
import { isPgPoolSaturatedError, prisma } from '@/lib/prisma'
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
        // LateProfilesListResponse = { profiles: LateWorkspaceProfile[] } — pas un tableau direct
        const { profiles: profileList } = await late.profiles.list()
        const existing = profileList.find((p: { name: string }) => p.name === profileName)

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

      // ⚠️ On ne sauvegarde PAS encore lateWorkspaceId en DB ici.
      // L'ID sera persisté uniquement dans le callback OAuth (/api/platforms/callback),
      // c'est-à-dire uniquement si l'utilisateur complète le flux OAuth avec succès.
      //
      // Pourquoi : si l'utilisateur abandonne ou si l'OAuth échoue, aucun workspace
      // ne sera stocké en DB → onboardingStep reste à 0 → l'onboarding s'affiche correctement.
      //
      // Si l'utilisateur réessaie plus tard, connectPlatform() retombera dans ce bloc
      // (lateWorkspaceId absent de la DB), tentera une création → Zernio répondra
      // "already exists" → le bloc de récupération ci-dessus retrouvera le workspace existant.
      console.log('[connectPlatform] Workspace Late créé/récupéré, sauvegarde différée au callback:', lateWorkspaceId)
    } else {
      console.log('[connectPlatform] Workspace Late existant (DB):', lateWorkspaceId)
    }

    // 4. Guard doublon : vérifier qu'aucun compte de cette plateforme n'est déjà actif
    //    sur ce profileId. Règle métier : un seul Instagram (ou autre) par profileId.
    //    → Évite de lancer le flux OAuth pour un compte déjà connecté sur le même workspace.
    //    Exemple interdit : profileId A → Instagram 1 ET Instagram 2 (→ erreur retournée)
    //    Exemple valide   : profileId A → Instagram 1, profileId B → Instagram 2 (→ OK)
    const existingAccount = await prisma.connectedPlatform.findUnique({
      where: {
        userId_platform_lateProfileId: {
          userId: session.user.id,
          platform: validPlatform,
          lateProfileId: lateWorkspaceId!,
        },
      },
      // On ne récupère que accountName pour construire le message d'erreur
      select: { accountName: true },
    })

    if (existingAccount) {
      // Capitalise la première lettre du nom de la plateforme pour le message utilisateur
      // ex: 'instagram' → 'Instagram'
      const platformLabel = validPlatform.charAt(0).toUpperCase() + validPlatform.slice(1)
      return {
        success: false,
        error: `${platformLabel} est déjà connecté sur ce profil (${existingAccount.accountName}). Déconnecte-le d'abord.`,
      }
    }

    // 5. Obtenir l'URL OAuth avec la plateforme + le profileId du workspace
    //    lateWorkspaceId est garanti non-null ici (assigné dans le bloc if ou en DB).
    //    Si Zernio retourne 404 "Profile not found", le workspace est périmé
    //    (supprimé côté Zernio mais l'ID reste en DB) → auto-recovery : on recrée.
    let authUrl: string
    try {
      const result = await late.connect.getUrl(validPlatform, lateWorkspaceId!, callbackUrl)
      authUrl = result.authUrl
    } catch (getUrlError) {
      // 404 = workspace périmé (supprimé côté Zernio mais l'ID reste en DB)
      // → Auto-recovery sécurisée : on vérifie d'abord qu'aucun compte social
      //   n'est lié à l'ancien workspace avant de le recréer.
      if (getUrlError instanceof LateApiError && getUrlError.status === 404) {
        console.warn('[connectPlatform] Workspace périmé (404) — tentative de recovery...')

        // Garde de sécurité : vérifier s'il y a des comptes connectés liés à l'ancien workspace.
        // Si oui → recréer le workspace casserait les liens existants (posts, accounts Zernio).
        // → On refuse et on demande une intervention manuelle.
        const existingPlatforms = await prisma.connectedPlatform.count({
          where: { userId: session.user.id, lateProfileId: lateWorkspaceId! },
        })

        if (existingPlatforms > 0) {
          console.error('[connectPlatform] Workspace périmé AVEC comptes connectés — recovery impossible')
          return {
            success: false,
            error: `Ton profil Zernio a expiré mais ${existingPlatforms} réseau${existingPlatforms > 1 ? 'x' : ''} y ${existingPlatforms > 1 ? 'sont' : 'est'} encore lié${existingPlatforms > 1 ? 's' : ''}. Contacte le support (privacy@ogolong.com) pour récupérer tes données.`,
          }
        }

        // Aucun compte lié → recréation sûre
        console.log('[connectPlatform] Aucun compte lié → recréation du workspace...')

        // Supprimer l'ancien ID périmé en DB
        await prisma.user.update({
          where: { id: session.user.id },
          data: { lateWorkspaceId: null },
        })

        // Recréer un workspace chez Zernio
        const profileName = user?.name ?? session.user.email ?? 'ogolong user'
        const newWorkspace = await late.profiles.create({ name: profileName })
        lateWorkspaceId = newWorkspace._id
        console.log('[connectPlatform] Nouveau workspace créé:', lateWorkspaceId)

        // Sauvegarder le nouveau ID en DB
        await prisma.user.update({
          where: { id: session.user.id },
          data: { lateWorkspaceId },
        })

        // Réessayer avec le nouveau workspace
        const retryResult = await late.connect.getUrl(validPlatform, lateWorkspaceId, callbackUrl)
        authUrl = retryResult.authUrl
      } else {
        throw getUrlError
      }
    }

    console.log('[connectPlatform] authUrl reçu:', authUrl)

    return { success: true, redirectUrl: authUrl }
  } catch (error) {
    // Log complet de l'erreur réelle pour diagnostiquer la cause exacte
    console.error('[connectPlatform] erreur:', error)

    // Plateforme encore en beta chez Zernio (ex: Snapchat).
    // → Informer l'utilisateur clairement plutôt que d'afficher un message générique.
    if (error instanceof LateApiError && error.code === 'PLATFORM_BETA_RESTRICTED') {
      return {
        success: false,
        error: `${validPlatform.charAt(0).toUpperCase() + validPlatform.slice(1)} n'est pas encore disponible. La connexion sera activée dès que Zernio ouvrira l'intégration au public.`,
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
        error: `Erreur Zernio (${error.status}) : ${error.message}`,
      }
    }
    // Pool PgBouncer saturé (MaxClientsInSessionMode) : erreur transitoire,
    // le retry automatique de l'extension Prisma a échoué deux fois de suite.
    // → message friendly sans exposer le détail technique.
    if (isPgPoolSaturatedError(error)) {
      return {
        success: false,
        error: 'Le service est momentanément surchargé. Réessaie dans quelques secondes.',
      }
    }
    const message = error instanceof Error ? error.message : String(error)
    return { success: false, error: `Impossible de lancer la connexion : ${message}` }
  }
}
