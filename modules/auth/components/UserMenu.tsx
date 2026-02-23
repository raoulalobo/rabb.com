/**
 * @file modules/auth/components/UserMenu.tsx
 * @module auth
 * @description Menu utilisateur affiché dans le Header du dashboard.
 *   Affiche l'avatar de l'utilisateur comme déclencheur d'un menu déroulant
 *   contenant ses informations (nom, email), un lien vers les paramètres
 *   et un bouton de déconnexion.
 *
 *   États gérés :
 *   - Chargement → Skeleton rond identique à l'avatar
 *   - Non connecté → null (ne devrait pas arriver dans le dashboard)
 *   - Connecté (email) → initiale du nom en fallback
 *   - Connecté (Google OAuth) → photo de profil Google
 *   - Connecté + avatar uploadé → photo Supabase Storage (avatarUrl)
 *
 *   Priorité d'affichage de l'avatar :
 *   1. avatarUrl (upload manuel via /profile) — lu depuis /api/user/me via TanStack Query
 *   2. user.image (photo Google OAuth) — lu depuis la session better-auth
 *   3. Initiale du nom ou de l'email (fallback)
 *
 *   L'appel à /api/user/me est nécessaire car better-auth ne stocke pas avatarUrl
 *   dans le cookie de session (champ Prisma custom non inclus dans le token).
 *
 * @example
 *   // components/layout/Header.tsx
 *   import { UserMenu } from '@/modules/auth/components/UserMenu'
 *   <UserMenu />
 */

'use client'

import { useQuery } from '@tanstack/react-query'
import { LogOut, Settings, UserCircle } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import { signOut } from '@/lib/auth-client'
import type { UserMeResponse } from '@/app/api/user/me/route'
import { useSession } from '@/modules/auth/hooks/useSession'

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Calcule les initiales à afficher dans le fallback de l'avatar.
 * Priorité : première lettre du nom → première lettre de l'email.
 *
 * @param name  - Nom complet de l'utilisateur (peut être null)
 * @param email - Email de l'utilisateur (toujours présent)
 * @returns Initiale en majuscule, ex. "A" pour "Alice Dupont"
 *
 * @example
 *   getInitials("Alice Dupont", "alice@example.com") // → "A"
 *   getInitials(null, "alice@example.com")           // → "A"
 */
function getInitials(name: string | null | undefined, email: string): string {
  if (name && name.trim().length > 0) {
    return name.trim()[0].toUpperCase()
  }
  return email[0].toUpperCase()
}

// ─── Composant ────────────────────────────────────────────────────────────────

/**
 * Menu déroulant utilisateur pour le Header du dashboard.
 * Affiche un skeleton pendant le chargement, puis l'avatar cliquable.
 *
 * @returns Menu utilisateur ou Skeleton selon l'état de session
 */
export function UserMenu(): React.JSX.Element | null {
  const router = useRouter()
  const { user, isLoading } = useSession()

  // ── Fetch du profil complet depuis /api/user/me ────────────────────────────
  // Nécessaire pour récupérer avatarUrl (champ Prisma custom non inclus dans
  // le cookie de session better-auth). La query est activée uniquement si
  // l'utilisateur est connecté (enabled: !!user).
  // staleTime court (30s) pour refléter rapidement les changements d'avatar.
  const { data: profile } = useQuery<UserMeResponse>({
    queryKey: ['user', 'me'],
    queryFn: async () => {
      const res = await fetch('/api/user/me')
      if (!res.ok) throw new Error('Erreur lors du chargement du profil')
      return res.json() as Promise<UserMeResponse>
    },
    enabled: !!user,
    staleTime: 30 * 1000, // 30s — délai court pour refléter les mises à jour d'avatar
  })

  // ── Source de l'avatar : avatarUrl (upload) > image (OAuth) > fallback ─────
  // Priorité : 1. avatarUrl uploadé manuellement via /profile
  //            2. user.image fourni par Google OAuth
  //            3. Initiale du nom/email (AvatarFallback)
  const avatarSrc = profile?.avatarUrl ?? user?.image ?? null

  // ── État de chargement : skeleton rond identique en taille à l'avatar ──────
  if (isLoading) {
    return <Skeleton className="size-8 rounded-full" />
  }

  // ── Pas d'utilisateur (ne devrait pas arriver dans une route protégée) ─────
  if (!user) {
    return null
  }

  // ── Déconnexion : appel better-auth puis redirection vers /login ──────────
  async function handleSignOut(): Promise<void> {
    await signOut()
    router.push('/login')
  }

  // ── Rendu du menu déroulant ───────────────────────────────────────────────
  return (
    <DropdownMenu>
      {/* Déclencheur : avatar cliquable */}
      <DropdownMenuTrigger asChild>
        <button
          className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          aria-label="Menu utilisateur"
        >
          <Avatar className="size-8 cursor-pointer">
            {/* Photo de profil — avatarUrl uploadé ou image OAuth Google */}
            {avatarSrc && (
              <AvatarImage
                src={avatarSrc}
                alt={user.name ?? user.email}
              />
            )}
            {/* Fallback : initiale du nom ou de l'email */}
            <AvatarFallback className="text-xs font-medium">
              {getInitials(user.name, user.email)}
            </AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>

      {/* Contenu du menu déroulant */}
      <DropdownMenuContent align="end" className="w-56">
        {/* Informations de l'utilisateur (non cliquable) */}
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            {user.name && (
              <p className="text-sm font-medium leading-none">{user.name}</p>
            )}
            <p className="text-xs leading-none text-muted-foreground">
              {user.email}
            </p>
          </div>
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        {/* Lien vers le profil */}
        <DropdownMenuItem asChild>
          <Link href="/profile" className="flex w-full items-center gap-2">
            <UserCircle className="size-4" />
            <span>Mon profil</span>
          </Link>
        </DropdownMenuItem>

        {/* Lien vers les paramètres */}
        <DropdownMenuItem asChild>
          <Link href="/settings" className="flex w-full items-center gap-2">
            <Settings className="size-4" />
            <span>Paramètres</span>
          </Link>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        {/* Bouton de déconnexion — variant destructif */}
        <DropdownMenuItem
          onClick={handleSignOut}
          className="flex items-center gap-2 text-destructive focus:text-destructive"
        >
          <LogOut className="size-4" />
          <span>Se déconnecter</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
