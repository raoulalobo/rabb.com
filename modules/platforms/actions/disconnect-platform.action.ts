/**
 * @file modules/platforms/actions/disconnect-platform.action.ts
 * @module platforms
 * @description Server Action : déconnecte un réseau social.
 *   Supprime le profil getlate.dev (révoque les tokens OAuth) et la ligne en DB.
 *
 *   Flux :
 *   1. Validation Zod de l'ID reçu
 *   2. Vérification de la session better-auth
 *   3. Récupération du lateProfileId depuis la DB
 *   4. Suppression du profil getlate.dev
 *   5. Suppression de la ligne ConnectedPlatform en DB
 *
 * @example
 *   // Dans un Client Component
 *   const result = await disconnectPlatform('connected_platform_id')
 *   if (result.success) toast.success('Plateforme déconnectée')
 */

'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'

import { auth } from '@/lib/auth'
import { LateApiError, late } from '@/lib/late'
import { prisma } from '@/lib/prisma'
import { DisconnectPlatformSchema } from '@/modules/platforms/schemas/platform.schema'
import type { PlatformActionResult } from '@/modules/platforms/types'

/**
 * Déconnecte une plateforme sociale.
 * Supprime à la fois le profil getlate.dev et l'entrée en base de données.
 *
 * @param connectedPlatformId - ID de la ligne ConnectedPlatform en DB
 * @returns { success } ou { success: false, error }
 *
 * @example
 *   const result = await disconnectPlatform('cpl_abc123')
 *   if (!result.success) toast.error(result.error)
 */
export async function disconnectPlatform(connectedPlatformId: unknown): Promise<PlatformActionResult> {
  // 1. Validation Zod
  const parseResult = DisconnectPlatformSchema.safeParse({ connectedPlatformId })
  if (!parseResult.success) {
    return { success: false, error: 'ID de plateforme invalide.' }
  }
  const { connectedPlatformId: validId } = parseResult.data

  // 2. Vérification de la session
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return { success: false, error: 'Non authentifié. Reconnecte-toi.' }
  }

  // 3. Récupérer la plateforme et vérifier qu'elle appartient à l'utilisateur
  const connectedPlatform = await prisma.connectedPlatform.findFirst({
    where: {
      id: validId,
      userId: session.user.id,
    },
    select: { id: true, lateProfileId: true, platform: true },
  })

  if (!connectedPlatform) {
    return { success: false, error: 'Plateforme non trouvée.' }
  }

  // 4. Supprimer le profil getlate.dev (révoque les tokens OAuth)
  try {
    await late.profiles.delete(connectedPlatform.lateProfileId)
  } catch (error) {
    // Si getlate.dev retourne 404, le profil n'existe déjà plus → continuer
    if (!(error instanceof LateApiError && error.status === 404)) {
      return { success: false, error: 'Impossible de révoquer l\'accès. Réessaie.' }
    }
  }

  // 5. Supprimer la ligne en DB
  await prisma.connectedPlatform.delete({ where: { id: validId } })

  // Invalider le cache de la page settings pour refléter les changements
  revalidatePath('/settings')

  return { success: true }
}
