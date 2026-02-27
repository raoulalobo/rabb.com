# Phase 03 — Connexion des réseaux sociaux

> **Skills à activer** : `next-best-practices`, `vercel-react-best-practices`, `frontend-design`
> **Prérequis** : Phase 02 complétée (auth + DB opérationnels)

---

## Objectif

Permettre à l'utilisateur de connecter ses comptes sociaux (Instagram, TikTok,
YouTube, Facebook) via getlate.dev. L'OAuth est délégué entièrement à getlate.dev —
ogolong ne gère pas les tokens OAuth directement.

---

## Flux de connexion d'un réseau

```
User clique "Connecter Instagram"
  → API ogolong : GET /api/platforms/connect?platform=instagram
    → getlate.dev : POST /api/v1/profiles (crée un profil)
      → getlate.dev retourne une URL OAuth
        → Redirect vers l'URL OAuth getlate.dev
          → User autorise sur Instagram
            → Callback getlate.dev → ogolong /api/platforms/callback
              → Sauvegarde ConnectedPlatform en DB
                → Redirect vers /settings/platforms
```

---

## Étapes

### 3.1 — Client getlate.dev

```typescript
// lib/late.ts
/**
 * @file late.ts
 * @description Client singleton pour l'API getlate.dev.
 *   Toutes les interactions avec getlate.dev passent par ce fichier.
 *   Ne jamais instancier Late directement dans les composants.
 *
 * @example
 *   import { late } from '@/lib/late'
 *   const post = await late.posts.create({ text: '...', platforms: ['instagram'] })
 */
import Late from '@getlate/node'

// Singleton : une seule instance partagée côté serveur
export const late = new Late({
  apiKey: process.env.LATE_API_KEY!,
})
```

### 3.2 — Schémas Zod pour les plateformes

```typescript
// modules/platforms/schemas/platform.schema.ts
/**
 * @file platform.schema.ts
 * @description Schémas Zod pour la validation des données de plateformes.
 */
import { z } from 'zod'

// Plateformes supportées (prioritaires dans l'UI)
export const PlatformEnum = z.enum([
  'instagram', 'tiktok', 'youtube', 'facebook',
  // Plateformes secondaires (disponibles mais non mises en avant)
  'twitter', 'linkedin', 'bluesky', 'threads',
  'reddit', 'pinterest', 'telegram', 'snapchat', 'google_business',
])
export type Platform = z.infer<typeof PlatformEnum>

// Plateformes prioritaires dans l'UI ogolong
export const PRIORITY_PLATFORMS: Platform[] = ['instagram', 'tiktok', 'youtube', 'facebook']

export const ConnectPlatformSchema = z.object({
  platform: PlatformEnum,
})

export const ConnectedPlatformSchema = z.object({
  id: z.string(),
  platform: PlatformEnum,
  accountName: z.string(),
  avatarUrl: z.string().url().optional(),
  isActive: z.boolean(),
  connectedAt: z.date(),
})
export type ConnectedPlatform = z.infer<typeof ConnectedPlatformSchema>
```

### 3.3 — Server Actions

```typescript
// modules/platforms/actions/connect-platform.action.ts
/**
 * @file connect-platform.action.ts
 * @description Server Action : initie la connexion OAuth d'un réseau social.
 *   Crée un profil getlate.dev et retourne l'URL de redirection OAuth.
 *
 * @param platform - La plateforme à connecter (ex: 'instagram')
 * @returns { redirectUrl: string } URL vers laquelle rediriger l'utilisateur
 */
'use server'

import { auth } from '@/lib/auth'
import { late } from '@/lib/late'
import { ConnectPlatformSchema } from '@/modules/platforms/schemas/platform.schema'
import { headers } from 'next/headers'

export async function connectPlatform(platform: unknown) {
  // 1. Validation Zod
  const { platform: validPlatform } = ConnectPlatformSchema.parse({ platform })

  // 2. Vérification session
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) throw new Error('Non authentifié')

  // 3. Créer un profil getlate.dev + obtenir l'URL OAuth
  const profile = await late.profiles.create({
    platform: validPlatform,
    callbackUrl: `${process.env.BETTER_AUTH_URL}/api/platforms/callback`,
  })

  return { redirectUrl: profile.oauthUrl }
}
```

```typescript
// modules/platforms/actions/disconnect-platform.action.ts
/**
 * @file disconnect-platform.action.ts
 * @description Server Action : déconnecte un réseau social.
 *   Supprime le profil getlate.dev et la ligne en DB.
 */
'use server'

import { auth } from '@/lib/auth'
import { late } from '@/lib/late'
import { prisma } from '@/lib/prisma'
import { headers } from 'next/headers'

export async function disconnectPlatform(connectedPlatformId: string) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) throw new Error('Non authentifié')

  // Récupérer le lateProfileId avant suppression
  const platform = await prisma.connectedPlatform.findFirst({
    where: { id: connectedPlatformId, userId: session.user.id },
  })
  if (!platform) throw new Error('Plateforme non trouvée')

  // Supprimer le profil getlate.dev
  await late.profiles.delete(platform.lateProfileId)

  // Supprimer en DB
  await prisma.connectedPlatform.delete({ where: { id: connectedPlatformId } })
}
```

### 3.4 — Route de callback OAuth

```typescript
// app/api/platforms/callback/route.ts
/**
 * @file route.ts
 * @description Callback OAuth après autorisation sur le réseau social.
 *   getlate.dev redirige ici avec les infos du compte connecté.
 *   Sauvegarde ConnectedPlatform en DB puis redirige vers /settings.
 */
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { headers } from 'next/headers'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)

  // Paramètres retournés par getlate.dev après OAuth
  const lateProfileId = searchParams.get('profileId')
  const platform = searchParams.get('platform')
  const accountName = searchParams.get('accountName')
  const avatarUrl = searchParams.get('avatarUrl')

  if (!lateProfileId || !platform || !accountName) {
    return NextResponse.redirect(new URL('/settings?error=platform_connect', request.url))
  }

  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Upsert : créer ou mettre à jour la plateforme connectée
  await prisma.connectedPlatform.upsert({
    where: { userId_platform_lateProfileId: {
      userId: session.user.id, platform, lateProfileId,
    }},
    create: {
      userId: session.user.id,
      platform, lateProfileId, accountName,
      avatarUrl: avatarUrl ?? undefined,
    },
    update: { accountName, avatarUrl: avatarUrl ?? undefined, isActive: true },
  })

  return NextResponse.redirect(new URL('/settings?success=platform_connected', request.url))
}
```

### 3.5 — Hook TanStack Query

```typescript
// modules/platforms/hooks/usePlatforms.ts
/**
 * @file usePlatforms.ts
 * @description Hook TanStack Query : liste les plateformes connectées de l'utilisateur.
 *
 * @returns { platforms, isLoading, error } — Données mises en cache automatiquement
 *
 * @example
 *   const { platforms, isLoading } = usePlatforms()
 */
import { useQuery } from '@tanstack/react-query'
import type { ConnectedPlatform } from '@/modules/platforms/schemas/platform.schema'

async function fetchPlatforms(): Promise<ConnectedPlatform[]> {
  const res = await fetch('/api/platforms')
  if (!res.ok) throw new Error('Erreur de chargement des plateformes')
  return res.json()
}

export const platformQueryKeys = {
  all: ['platforms'] as const,
  list: () => [...platformQueryKeys.all, 'list'] as const,
}

export function usePlatforms() {
  return useQuery({
    queryKey: platformQueryKeys.list(),
    queryFn: fetchPlatforms,
    staleTime: 1000 * 60 * 5, // 5 min de cache
  })
}
```

### 3.6 — Composants UI

**Fichiers à créer :**

- `modules/platforms/components/PlatformCard.tsx`
  - Affiche : logo réseau, nom du compte, statut (connecté/déconnecné), bouton action
  - Skeleton : `PlatformCardSkeleton.tsx` (même layout)

- `modules/platforms/components/PlatformPicker.tsx`
  - Sélecteur de plateformes dans le PostComposer
  - Affiche uniquement les plateformes connectées

- `app/(dashboard)/settings/page.tsx` → section "Réseaux connectés"
- `app/(dashboard)/settings/loading.tsx` → skeleton des cards plateformes

### 3.7 — Design des cartes plateformes (skill: `frontend-design`)

Chaque plateforme prioritaire a sa couleur de marque :
```typescript
// modules/platforms/constants.ts
export const PLATFORM_CONFIG = {
  instagram: { label: 'Instagram', color: '#E1306C', icon: 'instagram' },
  tiktok:    { label: 'TikTok',    color: '#000000', icon: 'tiktok' },
  youtube:   { label: 'YouTube',   color: '#FF0000', icon: 'youtube' },
  facebook:  { label: 'Facebook',  color: '#1877F2', icon: 'facebook' },
} as const
```

---

## Tests

```typescript
// tests/unit/modules/platforms/platform.schema.test.ts
import { describe, it, expect } from 'vitest'
import { ConnectPlatformSchema, PlatformEnum } from '@/modules/platforms/schemas/platform.schema'

describe('PlatformEnum', () => {
  it('accepte les plateformes prioritaires', () => {
    expect(PlatformEnum.safeParse('instagram').success).toBe(true)
    expect(PlatformEnum.safeParse('tiktok').success).toBe(true)
  })

  it('rejette une plateforme inconnue', () => {
    expect(PlatformEnum.safeParse('snapbook').success).toBe(false)
  })
})
```

```bash
pnpm vitest run tests/unit/modules/platforms
```

---

## Vérification / Critères de succès

- [ ] Page `/settings` affiche les 4 plateformes prioritaires avec bouton "Connecter"
- [ ] Clic "Connecter Instagram" → redirection vers OAuth getlate.dev
- [ ] Après OAuth → callback → plateforme apparaît comme "Connectée" en DB
- [ ] Bouton "Déconnecter" fonctionne et retire la plateforme
- [ ] Skeleton des cards visible pendant le chargement
- [ ] Tests unitaires schemas passent

---

## Passage à la phase suivante

Une fois cette phase validée → lire `04-post-composer.md`.
