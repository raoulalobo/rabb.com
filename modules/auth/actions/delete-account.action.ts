/**
 * @file modules/auth/actions/delete-account.action.ts
 * @module auth
 * @description Server Action pour la suppression définitive du compte utilisateur.
 *   Conforme au droit à l'effacement (art. 17 RGPD).
 *
 *   Supprime en cascade toutes les données liées à l'utilisateur dans l'ordre
 *   correct des clés étrangères (FK), via une transaction Prisma atomique.
 *
 *   Ordre de suppression (des tables feuilles vers la racine) :
 *   1. NotificationPrefs (relation 1-1, FK vers User)
 *   2. Signature (FK vers User)
 *   3. Media (FK vers User)
 *   4. ConnectedPlatform (FK vers User — référencée par Post, donc avant Post)
 *   5. Post (FK vers User + ConnectedPlatform)
 *   6. Session (FK vers User — better-auth)
 *   7. Account (FK vers User — better-auth OAuth)
 *   8. User (racine — supprimé en dernier)
 *
 *   Note : Verification (better-auth) n'est pas liée à userId directement,
 *   pas de suppression nécessaire.
 *
 *   Après suppression : déconnexion via authClient (côté client) + redirection vers '/'.
 *   La Server Action ne peut pas appeler signOut() client directement —
 *   c'est le composant appelant qui gère la déconnexion.
 *
 * @example
 *   // Dans AccountDangerZone.tsx :
 *   const result = await deleteAccount()
 *   if (result.success) {
 *     await signOut()
 *     router.push('/')
 *   }
 */

'use server'

import { headers } from 'next/headers'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// ─── Types ────────────────────────────────────────────────────────────────────

/** Résultat de la Server Action deleteAccount */
interface DeleteAccountResult {
  /** `true` si la suppression s'est bien passée */
  success: boolean
  /** Message d'erreur lisible si `success` est `false` */
  error?: string
}

// ─── Action ───────────────────────────────────────────────────────────────────

/**
 * Supprime définitivement le compte de l'utilisateur connecté et toutes ses données.
 *
 * Cette action est irréversible. Elle est protégée par :
 * - Vérification de session (better-auth)
 * - Confirmation explicite de l'utilisateur côté client (input "supprimer")
 *
 * Flux :
 *   1. Récupère la session courante pour identifier l'utilisateur
 *   2. Lance une transaction Prisma atomique (tout réussit ou tout échoue)
 *   3. Supprime les données dans l'ordre des contraintes FK
 *   4. Retourne { success: true } → le client gère la déconnexion et le redirect
 *
 * @returns `{ success: true }` si suppression réussie
 * @returns `{ success: false, error: string }` si non authentifié ou erreur DB
 */
export async function deleteAccount(): Promise<DeleteAccountResult> {
  // ── 1. Vérification de session ─────────────────────────────────────────────
  const session = await auth.api.getSession({ headers: await headers() })

  if (!session?.user?.id) {
    return { success: false, error: 'Non authentifié. Veuillez vous reconnecter.' }
  }

  const userId = session.user.id

  try {
    // ── 2. Transaction atomique — suppression en cascade ───────────────────
    // Si l'une des opérations échoue, toutes sont annulées (rollback automatique).
    // L'ordre respecte les contraintes de clés étrangères définies dans schema.prisma.
    await prisma.$transaction([
      // Étape 1 : Préférences de notifications (1-1 avec User)
      prisma.notificationPrefs.deleteMany({ where: { userId } }),

      // Étape 2 : Signatures textuelles (FK → User)
      prisma.signature.deleteMany({ where: { userId } }),

      // Étape 3 : Médias de la galerie (FK → User)
      prisma.media.deleteMany({ where: { userId } }),

      // Étape 4 : Posts (FK → User + ConnectedPlatform)
      // Doit être supprimé avant ConnectedPlatform car Post.connectedPlatformId → ConnectedPlatform
      prisma.post.deleteMany({ where: { userId } }),

      // Étape 5 : Plateformes connectées (FK → User, référencée par Post — déjà supprimés)
      prisma.connectedPlatform.deleteMany({ where: { userId } }),

      // Étape 6 : Sessions better-auth (FK → User)
      prisma.session.deleteMany({ where: { userId } }),

      // Étape 7 : Comptes OAuth better-auth (FK → User)
      prisma.account.deleteMany({ where: { userId } }),

      // Étape 8 : Utilisateur lui-même (racine — toutes les FK supprimées)
      prisma.user.delete({ where: { id: userId } }),
    ])

    return { success: true }
  } catch (error) {
    console.error('[deleteAccount] Erreur lors de la suppression du compte :', error)
    return {
      success: false,
      error: 'Une erreur est survenue lors de la suppression. Contactez privacy@ogolong.com.',
    }
  }
}
