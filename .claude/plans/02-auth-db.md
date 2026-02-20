# Phase 02 — Authentification & Base de données

> **Skills à activer** : `better-auth-best-practices`, `supabase-postgres-best-practices`, `next-best-practices`
> **Prérequis** : Phase 01 complétée

---

## Objectif

Mettre en place :
1. Le schéma de base de données (Prisma + ZenStack) sur Supabase
2. L'authentification complète avec better-auth (email/password + OAuth Google)
3. Les pages d'auth (login, register, reset password) avec leurs skeletons

---

## Étapes

### 2.1 — Schéma Prisma

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}

// ─── Modèle utilisateur (géré par better-auth) ───────────────────────────────
model User {
  id            String    @id @default(cuid())
  email         String    @unique
  name          String?
  avatarUrl     String?
  emailVerified Boolean   @default(false)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  // Relations
  sessions      Session[]
  accounts      Account[]
  posts         Post[]
  platforms     ConnectedPlatform[]
  notifPrefs    NotificationPrefs?

  @@map("users")
}

model Session {
  id        String   @id @default(cuid())
  userId    String
  token     String   @unique
  expiresAt DateTime
  ipAddress String?
  userAgent String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("sessions")
}

model Account {
  id                String   @id @default(cuid())
  userId            String
  provider          String   // "google", "email", etc.
  providerAccountId String
  accessToken       String?
  refreshToken      String?
  expiresAt         DateTime?
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
  @@map("accounts")
}

model Verification {
  id         String   @id @default(cuid())
  identifier String
  value      String
  expiresAt  DateTime
  createdAt  DateTime @default(now())

  @@map("verifications")
}

// ─── Réseaux sociaux connectés ────────────────────────────────────────────────
model ConnectedPlatform {
  id           String   @id @default(cuid())
  userId       String
  platform     String   // "instagram", "tiktok", "youtube", "facebook"
  lateProfileId String  // ID du profil getlate.dev
  accountName  String   // Nom affiché (@handle)
  avatarUrl    String?
  isActive     Boolean  @default(true)
  connectedAt  DateTime @default(now())
  updatedAt    DateTime @updatedAt

  user  User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  posts Post[]

  @@unique([userId, platform, lateProfileId])
  @@map("connected_platforms")
}

// ─── Posts ────────────────────────────────────────────────────────────────────
model Post {
  id           String     @id @default(cuid())
  userId       String
  text         String
  mediaUrls    String[]   @default([])
  platforms    String[]   // ["instagram", "tiktok"]
  status       PostStatus @default(DRAFT)
  scheduledFor DateTime?
  publishedAt  DateTime?
  latePostId   String?    // ID retourné par getlate.dev après publication
  failureReason String?
  createdAt    DateTime   @default(now())
  updatedAt    DateTime   @updatedAt

  user             User                @relation(fields: [userId], references: [id], onDelete: Cascade)
  connectedPlatform ConnectedPlatform? @relation(fields: [connectedPlatformId], references: [id])
  connectedPlatformId String?

  @@index([userId, status])
  @@index([scheduledFor])
  @@map("posts")
}

enum PostStatus {
  DRAFT
  SCHEDULED
  PUBLISHED
  FAILED
}

// ─── Préférences de notifications ─────────────────────────────────────────────
model NotificationPrefs {
  id              String  @id @default(cuid())
  userId          String  @unique
  emailOnFailure  Boolean @default(true)
  emailWeeklyRecap Boolean @default(true)

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("notification_prefs")
}
```

### 2.2 — Extension ZenStack (access control)

```zmodel
// prisma/schema.zmodel
// Étend schema.prisma avec les règles d'accès par utilisateur

import './schema.prisma'

// Un utilisateur ne peut accéder qu'à ses propres données
model Post {
  @@allow('all', auth() != null && auth().id == userId)
  @@deny('all', auth() == null)
}

model ConnectedPlatform {
  @@allow('all', auth() != null && auth().id == userId)
  @@deny('all', auth() == null)
}

model NotificationPrefs {
  @@allow('all', auth() != null && auth().id == userId)
  @@deny('all', auth() == null)
}
```

### 2.3 — Configuration better-auth

```typescript
// lib/auth.ts
/**
 * @file auth.ts
 * @description Configuration better-auth : providers email + Google OAuth.
 *   Utilise l'adaptateur Prisma pour la persistance en base Supabase.
 */
import { betterAuth } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import { prisma } from '@/lib/prisma'

export const auth = betterAuth({
  // Adaptateur Prisma → Supabase PostgreSQL
  database: prismaAdapter(prisma, { provider: 'postgresql' }),

  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
  },

  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
  },

  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 jours
    updateAge: 60 * 60 * 24,       // Renouvellement quotidien
  },
})

export type Session = typeof auth.$Infer.Session
export type User = typeof auth.$Infer.Session.user
```

### 2.4 — Clients Supabase

```typescript
// lib/supabase/client.ts
/**
 * @file client.ts
 * @description Client Supabase pour les composants CLIENT (browser).
 *   Ne jamais utiliser dans les Server Components ou Server Actions.
 */
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

```typescript
// lib/supabase/server.ts
/**
 * @file server.ts
 * @description Client Supabase pour les Server Components et Server Actions.
 *   Lit les cookies via next/headers pour maintenir la session.
 */
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )
}
```

### 2.5 — Route handler better-auth

```typescript
// app/api/auth/[...all]/route.ts
/**
 * @file route.ts
 * @description Handler universel better-auth (GET + POST).
 *   Gère login, register, OAuth callback, session, logout.
 */
import { auth } from '@/lib/auth'
import { toNextJsHandler } from 'better-auth/next-js'

export const { GET, POST } = toNextJsHandler(auth)
```

### 2.6 — Middleware de protection des routes

```typescript
// middleware.ts
/**
 * @file middleware.ts
 * @description Protège les routes du groupe (dashboard).
 *   Redirige vers /login si l'utilisateur n'est pas authentifié.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getSession } from 'better-auth/next-js'
import { auth } from '@/lib/auth'

export async function middleware(request: NextRequest) {
  const session = await getSession(request, auth)

  // Routes protégées : tout ce qui n'est pas (auth) ou api
  const isProtected = !request.nextUrl.pathname.startsWith('/login') &&
    !request.nextUrl.pathname.startsWith('/register') &&
    !request.nextUrl.pathname.startsWith('/api')

  if (isProtected && !session) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (session && request.nextUrl.pathname === '/login') {
    return NextResponse.redirect(new URL('/', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
```

### 2.7 — Pages d'auth avec skeletons

**Fichiers à créer :**

- `app/(auth)/login/page.tsx` — Formulaire email + mot de passe + bouton Google
- `app/(auth)/login/loading.tsx` — Skeleton du formulaire (même layout)
- `app/(auth)/register/page.tsx` — Formulaire inscription
- `app/(auth)/register/loading.tsx` — Skeleton
- `app/(auth)/reset-password/page.tsx` — Demande de reset
- `modules/auth/components/LoginForm.tsx` — Composant formulaire (react-hook-form + Zod)
- `modules/auth/components/RegisterForm.tsx`
- `modules/auth/hooks/useSession.ts` — Hook session côté client
- `modules/auth/schemas/auth.schema.ts` — Schémas Zod login/register
- `modules/auth/store/auth.store.ts` — Store Zustand (état de chargement auth)

### 2.8 — Migration et seed

```bash
# Générer le client Prisma + ZenStack
pnpm zenstack generate

# Pousser le schéma vers Supabase
pnpm prisma migrate dev --name init

# Vérifier la connexion
pnpm prisma studio
```

---

## Tests

```typescript
// tests/unit/modules/auth/auth.schema.test.ts
import { describe, it, expect } from 'vitest'
import { LoginSchema, RegisterSchema } from '@/modules/auth/schemas/auth.schema'

describe('LoginSchema', () => {
  it('valide un email et mot de passe corrects', () => {
    expect(LoginSchema.safeParse({
      email: 'user@example.com',
      password: 'motdepasse123',
    }).success).toBe(true)
  })

  it('rejette un email invalide', () => {
    expect(LoginSchema.safeParse({
      email: 'pas-un-email',
      password: 'motdepasse123',
    }).success).toBe(false)
  })
})
```

```bash
# Lancer les tests unitaires
pnpm vitest run tests/unit/modules/auth
```

---

## Vérification / Critères de succès

- [ ] `pnpm prisma migrate dev` passe sans erreur
- [ ] `pnpm zenstack generate` génère les types d'accès
- [ ] Page `/login` accessible, formulaire fonctionnel
- [ ] Inscription → email de vérification reçu (via better-auth)
- [ ] Login → redirection vers `/` (dashboard)
- [ ] Route `/` sans session → redirection vers `/login`
- [ ] Skeletons de login/register visibles pendant le chargement
- [ ] Tests unitaires auth passent

---

## Passage à la phase suivante

Une fois cette phase validée → lire `03-platforms.md`.
