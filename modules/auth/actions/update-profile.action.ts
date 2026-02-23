/**
 * @file modules/auth/actions/update-profile.action.ts
 * @module auth
 * @description Server Actions pour la gestion du profil utilisateur.
 *
 *   - `updateProfile`    : met à jour le nom et la description via Prisma
 *   - `updateAvatarUrl`  : enregistre l'URL publique de l'avatar après upload Supabase
 *
 *   Les deux actions :
 *   1. Vérifient la session better-auth (non authentifié → erreur)
 *   2. Mettent à jour uniquement l'utilisateur courant (pas d'accès cross-user)
 *   3. Revalidate `/profile` pour rafraîchir le Server Component
 *
 * @example
 *   // Depuis ProfileForm.tsx
 *   const result = await updateProfile({ name: 'Alice', description: 'Créatrice de contenu' })
 *   if (!result.success) toast.error(result.error)
 */

'use server'

import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ProfileUpdateSchema } from '@/modules/auth/schemas/profile.schema'
import type { ProfileUpdateData } from '@/modules/auth/schemas/profile.schema'

// ─── Types ────────────────────────────────────────────────────────────────────

/** Résultat standard d'une Server Action de profil */
interface ActionResult {
  success: boolean
  error?: string
}

// ─── Actions ──────────────────────────────────────────────────────────────────

/**
 * Met à jour le nom et la description du profil de l'utilisateur courant.
 * Valide les données avec Zod avant toute modification en base.
 *
 * @param data - Données du formulaire (nom + description optionnelle)
 * @returns `{ success: true }` ou `{ success: false, error: string }`
 *
 * @example
 *   const result = await updateProfile({ name: 'Alice Martin', description: 'Designer UI' })
 */
export async function updateProfile(data: ProfileUpdateData): Promise<ActionResult> {
  // ── Vérification de la session ─────────────────────────────────────────────
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return { success: false, error: 'Non authentifié' }

  // ── Validation Zod ─────────────────────────────────────────────────────────
  const result = ProfileUpdateSchema.safeParse(data)
  if (!result.success) {
    return { success: false, error: result.error.issues[0].message }
  }

  // ── Mise à jour en base ────────────────────────────────────────────────────
  try {
    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        name: result.data.name,
        // null si description vide ou absente (nettoie la valeur précédente)
        description: result.data.description ?? null,
      },
    })
  } catch (err) {
    console.error('[updateProfile] Erreur Prisma :', err)
    return { success: false, error: 'Erreur lors de la mise à jour du profil' }
  }

  // Revalider la page profil pour que le Server Component reflète les nouvelles données
  revalidatePath('/profile')
  return { success: true }
}

/**
 * Enregistre l'URL publique de l'avatar après un upload réussi vers Supabase Storage.
 * Cette action est appelée par le client une fois l'upload terminé.
 *
 * @param avatarUrl - URL publique permanente du fichier uploadé
 * @returns `{ success: true }` ou `{ success: false, error: string }`
 *
 * @example
 *   // Après upload via /api/user/avatar
 *   const result = await updateAvatarUrl('https://...supabase.co/storage/v1/object/public/...')
 */
export async function updateAvatarUrl(avatarUrl: string): Promise<ActionResult> {
  // ── Vérification de la session ─────────────────────────────────────────────
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return { success: false, error: 'Non authentifié' }

  // ── Validation basique de l'URL ────────────────────────────────────────────
  if (!avatarUrl.startsWith('https://')) {
    return { success: false, error: 'URL d\'avatar invalide' }
  }

  // ── Mise à jour en base ────────────────────────────────────────────────────
  try {
    await prisma.user.update({
      where: { id: session.user.id },
      data: { avatarUrl },
    })
  } catch (err) {
    console.error('[updateAvatarUrl] Erreur Prisma :', err)
    return { success: false, error: 'Erreur lors de la mise à jour de l\'avatar' }
  }

  revalidatePath('/profile')
  return { success: true }
}
