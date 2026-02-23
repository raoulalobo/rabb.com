/**
 * @file app/(dashboard)/profile/page.tsx
 * @description Page de profil utilisateur (/profile).
 *   Charge les données complètes de l'utilisateur depuis la DB (Server Component)
 *   et les passe à ProfileForm (Client Component) pour l'édition.
 *
 *   Données disponibles :
 *   - name, email, avatarUrl, image (OAuth), description
 *
 *   La session better-auth est vérifiée côté serveur.
 *   Si l'utilisateur n'est pas authentifié, redirect vers /login.
 */

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

import type { Metadata } from 'next'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ProfileForm } from '@/modules/auth/components/ProfileForm'

// ─── Métadonnées ──────────────────────────────────────────────────────────────

export const metadata: Metadata = {
  title: 'Mon profil — rabb',
}

// ─── Page ─────────────────────────────────────────────────────────────────────

/**
 * Page profil — Server Component.
 * Récupère le profil complet depuis la DB et le transmet à ProfileForm.
 */
export default async function ProfilePage(): Promise<React.JSX.Element> {
  // ── Vérification de la session ─────────────────────────────────────────────
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect('/login')

  // ── Récupération du profil complet (champs non exposés dans la session) ────
  // better-auth n'expose pas avatarUrl et description dans le cookie de session.
  // On interroge Prisma directement pour avoir tous les champs.
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      avatarUrl: true,
      image: true,
      description: true,
    },
  })

  // Ne devrait jamais arriver (session valide = user en DB), mais protection défensive
  if (!user) redirect('/login')

  return (
    <div className="mx-auto max-w-2xl space-y-6 py-8">

      {/* ── En-tête de page ─────────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Mon profil</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Gérez vos informations personnelles et votre photo de profil.
        </p>
      </div>

      {/* ── Formulaire d'édition ─────────────────────────────────────────── */}
      {/*
       * ProfileForm est un Client Component qui reçoit les données initiales.
       * Il gère l'upload avatar (via /api/user/avatar) et la sauvegarde
       * (via Server Actions updateProfile + updateAvatarUrl).
       */}
      <ProfileForm profile={user} />

    </div>
  )
}
