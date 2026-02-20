# CLAUDE.md — rabb.com

> Guide de référence pour l'IA et les développeurs.
> Toujours lire ce fichier avant de modifier du code.

---

## 1. Présentation du projet

**rabb.com** est un SaaS de planification de contenu sur les réseaux sociaux,
ciblant les créateurs de contenu francophones solo.
Il s'appuie sur l'API **getlate.dev** pour la publication multi-plateformes.

### Plateformes prioritaires
`Instagram` · `TikTok` · `YouTube` · `Facebook`
(Les 9 autres plateformes getlate.dev sont disponibles mais non mises en avant dans l'UI)

### Langue de l'UI
Français uniquement (MVP). i18n (next-intl) ajouté ultérieurement.

---

## 2. Stack technique

| Couche | Technologie | Rôle |
|---|---|---|
| Framework | Next.js 15 (App Router, Turbopack) | Frontend + API Routes |
| Base de données | Supabase (PostgreSQL Cloud) | Données applicatives |
| Stockage fichiers | Supabase Storage | Images et vidéos uploadées |
| ORM + Access Control | Prisma + ZenStack | Modèles DB + règles d'accès |
| Auth | better-auth | Authentification (email, OAuth) |
| State management | Zustand + Immer | État global client |
| Validation | Zod | Schémas de données (server + client) |
| Data fetching | TanStack Query | Cache, synchronisation serveur |
| Tables | TanStack Table | Listes de posts, analytics |
| Background jobs | Inngest | Scheduling, retries, workflows |
| Emails | Resend + React Email | Notifications transactionnelles |
| Déploiement | Vercel | Hosting + Edge Functions |
| API sociale | getlate.dev | Publication multi-réseaux |

---

## 3. Architecture modulaire

```
rabb/
├── app/                        # Next.js App Router
│   ├── (auth)/                 # Routes publiques (login, register, reset)
│   ├── (dashboard)/            # Routes protégées (layout avec sidebar)
│   │   ├── page.tsx            # Dashboard home (stats rapides)
│   │   ├── compose/            # Composer un post
│   │   ├── calendar/           # Calendrier de planification
│   │   ├── analytics/          # Statistiques détaillées
│   │   ├── inbox/              # Messages et commentaires unifiés
│   │   └── settings/           # Compte, réseaux connectés, facturation
│   └── api/
│       ├── auth/               # better-auth handlers
│       ├── posts/              # CRUD posts (proxy + DB)
│       ├── platforms/          # Connexion OAuth réseaux sociaux
│       ├── analytics/          # Proxy getlate.dev analytics
│       ├── inbox/              # Proxy getlate.dev inbox
│       └── inngest/            # Webhook Inngest (endpoint public)
│
├── modules/                    # ← CŒUR DE L'ARCHITECTURE MODULAIRE
│   ├── auth/                   # Module authentification
│   │   ├── components/         # LoginForm, RegisterForm, AuthGuard
│   │   ├── hooks/              # useSession, useSignOut
│   │   ├── store/              # Zustand: authStore
│   │   └── types.ts
│   ├── posts/                  # Module posts (création, édition, liste)
│   │   ├── components/
│   │   │   ├── PostComposer/   # Éditeur de post (multi-plateformes)
│   │   │   ├── PostCard/       # Carte de post dans le calendrier
│   │   │   └── PostList/       # Liste TanStack Table
│   │   ├── hooks/              # usePost, usePosts, useCreatePost
│   │   ├── queries/            # TanStack Query keys + fetchers
│   │   ├── store/              # Zustand: draftStore (brouillon en cours)
│   │   ├── schemas/            # Zod: PostCreateSchema, PostUpdateSchema
│   │   └── types.ts
│   ├── platforms/              # Module réseaux sociaux connectés
│   │   ├── components/         # PlatformCard, ConnectButton, PlatformPicker
│   │   ├── hooks/              # usePlatforms, useConnectPlatform
│   │   ├── schemas/            # Zod: PlatformSchema
│   │   └── types.ts
│   ├── analytics/              # Module statistiques
│   │   ├── components/         # StatsCard, EngagementChart, PostsTable
│   │   ├── hooks/              # useAnalytics, useWeeklyStats
│   │   └── types.ts
│   ├── inbox/                  # Module messages unifiés
│   │   ├── components/         # InboxList, MessageThread, ReplyForm
│   │   ├── hooks/              # useInbox, useReply
│   │   └── types.ts
│   └── notifications/          # Module emails + notifs in-app
│       ├── emails/             # React Email templates
│       └── hooks/              # useNotificationPrefs
│
├── lib/                        # Clients et utilitaires partagés
│   ├── late.ts                 # Client getlate.dev (singleton)
│   ├── supabase/
│   │   ├── client.ts           # Client browser (createBrowserClient)
│   │   └── server.ts           # Client server (createServerClient + cookies)
│   ├── inngest/
│   │   ├── client.ts           # Client Inngest
│   │   └── functions/          # publish-scheduled-post.ts, weekly-recap.ts
│   ├── resend.ts               # Client Resend (singleton)
│   ├── auth.ts                 # Config better-auth
│   └── validations/            # Schémas Zod partagés (ex: pagination)
│
├── components/                 # Composants UI génériques (non-métier)
│   ├── ui/                     # shadcn/ui (Button, Input, Dialog, etc.)
│   ├── layout/                 # Sidebar, Header, PageWrapper
│   └── shared/                 # DatePicker, FileUploader, EmptyState
│
├── store/                      # Stores Zustand globaux (cross-modules)
│   └── app.store.ts            # Ex: thème, sidebar ouvert/fermé
│
├── hooks/                      # Hooks React globaux
│   └── useDebounce.ts
│
├── types/                      # Types TypeScript globaux
│   └── index.ts                # Re-exports, types communs
│
├── prisma/
│   ├── schema.prisma           # Schéma Prisma standard
│   └── schema.zmodel           # Extensions ZenStack (access control)
│
└── emails/                     # Templates React Email
    ├── PublicationFailed.tsx
    └── WeeklyRecap.tsx
```

---

## 4. Conventions de code

### 4.1 Nommage
- **Fichiers composants** : PascalCase → `PostComposer.tsx`
- **Fichiers utilitaires/hooks** : camelCase → `usePost.ts`, `formatDate.ts`
- **Fichiers de store Zustand** : `*.store.ts` → `draft.store.ts`
- **Fichiers de schémas Zod** : `*.schema.ts` → `post.schema.ts`
- **Fichiers de queries TanStack** : `*.queries.ts` → `posts.queries.ts`
- **Constantes** : UPPER_SNAKE_CASE → `MAX_POST_LENGTH`

### 4.2 Structure d'un module (pattern standard)
Chaque module suit exactement cette structure pour garantir la cohérence :
```
modules/<nom>/
├── components/     # Composants React du module
├── hooks/          # Hooks React (logique réutilisable)
├── queries/        # Clés + fetchers TanStack Query
├── store/          # Store Zustand du module (si état local complexe)
├── schemas/        # Schémas Zod (validation)
├── actions/        # Server Actions Next.js (mutations)
└── types.ts        # Types TypeScript du module
```

### 4.3 Commentaires
- **Chaque fichier** doit commencer par un commentaire de fichier :
  ```typescript
  /**
   * @file PostComposer.tsx
   * @module posts
   * @description Éditeur de post multi-plateformes. Gère le brouillon en temps
   *   réel via draftStore (Zustand), la validation (Zod), et l'upload média
   *   vers Supabase Storage avant envoi à getlate.dev.
   */
  ```
- **Chaque fonction/hook exporté** doit avoir un commentaire JSDoc avec `@param`, `@returns`, et un exemple si non évident.
- **Logique complexe** : commentaire inline au-dessus de la ligne, pas en fin de ligne.

### 4.4 TypeScript
- Toujours typer explicitement les retours de fonctions.
- Pas de `any`. Utiliser `unknown` + assertion de type si nécessaire.
- Préférer `interface` pour les objets de domaine, `type` pour les unions/intersections.
- Exporter les types depuis `types.ts` du module, pas depuis les composants.

### 4.5 Imports
Ordre strict (enforced par ESLint) :
```typescript
// 1. Node built-ins
// 2. Packages externes (react, next, etc.)
// 3. Alias @/ (modules internes)
// 4. Imports relatifs ./
// 5. Types (import type)
```

---

## 5. Design Patterns

### 5.1 Repository Pattern (accès données)
Toute interaction avec Supabase/getlate.dev passe par des fonctions de repository,
jamais directement dans les composants.
```typescript
// ✅ Correct
// modules/posts/queries/posts.queries.ts
export const postQueries = {
  list: (userId: string) => ({
    queryKey: ['posts', userId],
    queryFn: () => fetchPosts(userId),
  }),
}
```

### 5.2 Store Pattern (Zustand + Immer)
Un store par domaine. Immer permet les mutations immuables lisibles.
```typescript
// modules/posts/store/draft.store.ts
interface DraftStore {
  text: string;
  platforms: Platform[];
  scheduledFor: Date | null;
  setText: (text: string) => void;
}

export const useDraftStore = create<DraftStore>()(
  immer((set) => ({
    text: '',
    platforms: [],
    scheduledFor: null,
    // Immer: mutation directe → immutabilité garantie
    setText: (text) => set((state) => { state.text = text }),
  }))
)
```

### 5.3 Schema-First Validation (Zod)
Définir le schéma Zod AVANT le composant. Inférer le type TypeScript depuis Zod.
```typescript
// modules/posts/schemas/post.schema.ts
export const PostCreateSchema = z.object({
  text: z.string().min(1).max(2200),
  platforms: z.array(PlatformEnum).min(1),
  scheduledFor: z.date().min(new Date()).optional(),
})

export type PostCreate = z.infer<typeof PostCreateSchema>
```

### 5.4 Server Actions Pattern
Les mutations (create, update, delete) utilisent des Server Actions Next.js,
validées par Zod, protégées par ZenStack.
```typescript
// modules/posts/actions/create-post.action.ts
'use server'
export async function createPost(data: unknown) {
  const validated = PostCreateSchema.parse(data)  // Zod
  // ... logique métier
}
```

### 5.5 Compound Component Pattern
Pour les composants complexes comme PostComposer :
```
PostComposer (root)
├── PostComposer.Editor      (zone de texte)
├── PostComposer.MediaUpload (upload images/vidéos)
├── PostComposer.Platforms   (sélection plateformes)
└── PostComposer.Footer      (boutons publier/planifier)
```

---

## 6. Rôles utilisateurs (MVP)

```
USER (seul rôle MVP)
├── Gérer son compte (email, mot de passe, avatar)
├── Connecter/déconnecter ses comptes sociaux
├── Créer, éditer, supprimer ses posts
├── Planifier et publier ses posts
├── Consulter ses analytics
└── Consulter son inbox
```

> Post-MVP : Ajout des rôles EDITOR et VIEWER pour la collaboration en équipe.

---

## 7. Workflows clés

### 7.1 Publication d'un post planifié
```
1. User remplit PostComposer → draftStore mis à jour en temps réel
2. Validation Zod côté client (feedback immédiat)
3. Soumission → Server Action → Validation Zod côté serveur
4. Sauvegarde en DB (Supabase) avec status: "scheduled"
5. Inngest event déclenché : "post/schedule" avec { postId, scheduledFor }
6. À l'heure prévue, Inngest appelle getlate.dev API → publication
7. DB mise à jour : status "published" ou "failed"
8. Si "failed" → Resend envoie l'email "Échec de publication"
```

### 7.2 Upload média
```
1. User sélectionne fichier → validation (type, taille) côté client
2. Génération d'un presigned URL Supabase Storage (via API Route)
3. Upload direct du fichier depuis le browser vers Supabase Storage
4. URL publique stockée dans draftStore puis dans la DB post
5. URL transmise à getlate.dev lors de la publication
```

### 7.3 Récapitulatif hebdomadaire
```
1. Inngest cron job : tous les lundis à 9h
2. Récupère les stats de la semaine via getlate.dev analytics
3. Agrège par plateforme
4. Resend envoie WeeklyRecap.tsx avec les stats formatées
```

---

## 8. Variables d'environnement requises

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# better-auth
BETTER_AUTH_SECRET=
BETTER_AUTH_URL=

# getlate.dev
LATE_API_KEY=

# Inngest
INNGEST_EVENT_KEY=
INNGEST_SIGNING_KEY=

# Resend
RESEND_API_KEY=
RESEND_FROM_EMAIL=noreply@rabb.com
```

---

## 9. Tests

### Stratégie
- **Unitaires** (Vitest) : schémas Zod, fonctions utilitaires, stores Zustand
- **Intégration** (Vitest + MSW) : Server Actions, API Routes (mocks getlate.dev/Supabase)
- **E2E** (Playwright) : Parcours critiques uniquement (inscription → connexion réseau → création post → planification)

### Convention de nommage des tests
```
tests/
├── unit/
│   ├── modules/posts/post.schema.test.ts
│   └── lib/late.test.ts
├── integration/
│   └── modules/posts/create-post.action.test.ts
└── e2e/
    └── schedule-post.spec.ts
```

---

## 10. Skills Claude Code installés

Les skills sont des guides de meilleures pratiques que Claude doit activer automatiquement
selon le contexte de la tâche. Ils sont disponibles dans `~/.claude/skills/`.

### Installation (commandes de référence)
```bash
npx skills add https://github.com/vercel-labs/agent-skills --skill vercel-react-best-practices
npx skills add https://github.com/anthropics/skills --skill frontend-design
npx skills add https://github.com/vercel-labs/agent-skills --skill vercel-composition-patterns
npx skills add https://github.com/vercel-labs/agent-browser --skill agent-browser
npx skills add https://github.com/supabase/agent-skills --skill supabase-postgres-best-practices
npx skills add https://github.com/better-auth/skills --skill better-auth-best-practices
npx skills add https://github.com/vercel-labs/next-skills --skill next-best-practices
npx skills add https://github.com/vercel-labs/agent-skills --skill web-design-guidelines
npx skills add https://github.com/simonwong/agent-skills --skill code-simplifier
```

### Tableau d'utilisation — quand activer chaque skill

| Skill | Déclencher quand... | Phase projet |
|---|---|---|
| `next-best-practices` | Écriture de routes, Server Components, data fetching, layouts | Toutes |
| `vercel-react-best-practices` | Création/révision de composants React (performance, bundle) | Toutes |
| `vercel-composition-patterns` | Conception de composants réutilisables (compound, context, render props) | 01, 04, 05 |
| `frontend-design` | Création d'UI (pages, composants, dashboard, landing page) | 03, 04, 05, 06 |
| `web-design-guidelines` | Audit UI/UX, vérification accessibilité, révision de design | 04, 05, 06, 07 |
| `supabase-postgres-best-practices` | Schéma Prisma, requêtes SQL, RLS Supabase, migrations | 02 |
| `better-auth-best-practices` | Configuration et intégration de better-auth | 02 |
| `code-simplifier` | Après toute session de code pour simplifier/nettoyer | Post chaque phase |
| `agent-browser` | Automatisation navigateur (tests manuels, scraping, debugging) | Tests E2E |

### Règle d'activation
> Avant de coder une feature, consulter le(s) skill(s) correspondant(s).
> Après avoir codé, passer le code dans `code-simplifier`.

---

## 11. États de chargement — Skeletons

### Règle fondamentale
Chaque page et composant qui charge des données **doit avoir un skeleton qui reproduit
fidèlement la forme et la disposition du contenu réel** (même layout, mêmes dimensions
approximatives, mêmes proportions). Jamais de spinner générique à la place d'un skeleton.

### Convention d'implémentation (Next.js App Router)
Utiliser les fichiers `loading.tsx` natifs de Next.js qui activent le Suspense automatiquement :

```
app/(dashboard)/
├── compose/
│   ├── page.tsx           # contenu réel
│   └── loading.tsx        # skeleton qui épouse la mise en page de page.tsx
├── analytics/
│   ├── page.tsx
│   └── loading.tsx        # skeleton des cards + graphiques + tableau
├── calendar/
│   ├── page.tsx
│   └── loading.tsx        # skeleton de la grille calendrier
└── inbox/
    ├── page.tsx
    └── loading.tsx        # skeleton de la liste de messages
```

Pour les composants avec chargement interne (TanStack Query), wrapper avec `<Suspense>` :
```tsx
// ✅ Skeleton qui épouse la forme du composant réel
<Suspense fallback={<PostListSkeleton />}>
  <PostList />
</Suspense>
```

### Structure d'un skeleton (pattern standard)
```tsx
// modules/posts/components/PostList/PostListSkeleton.tsx
export function PostListSkeleton() {
  return (
    // Reproduire exactement la structure du composant réel
    <div className="space-y-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="flex gap-3 p-4 rounded-lg border">
          {/* Avatar : même taille que le vrai avatar */}
          <Skeleton className="size-10 rounded-full shrink-0" />
          <div className="flex-1 space-y-2">
            {/* Titre : même largeur approximative */}
            <Skeleton className="h-4 w-3/4" />
            {/* Sous-titre : plus court */}
            <Skeleton className="h-3 w-1/2" />
            {/* Corps : plusieurs lignes */}
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-5/6" />
          </div>
        </div>
      ))}
    </div>
  )
}
```

### Règles de construction
- **Proportions** : les blocs skeleton ont les mêmes `width` / `height` que les vrais éléments.
- **Structure** : même arborescence flex/grid que le composant réel.
- **Nombre** : afficher le même nombre d'items que la liste réelle en chargera (ex: 3-5 items).
- **Couleur** : utiliser le composant `<Skeleton>` de shadcn/ui (animation pulse intégrée).
- **Pas de texte factice** : aucun "Lorem ipsum" ou placeholder textuel dans un skeleton.
- **Un skeleton par composant** : colocalisé dans le même dossier que le composant.

### Mapping pages → skeletons
| Page | Skeleton à reproduire |
|---|---|
| `/compose` | Éditeur (textarea) + barre outils + sélecteur plateformes + footer |
| `/calendar` | Grille 7 colonnes avec cellules de posts miniatures |
| `/analytics` | 4 cards stats + 1 graphique + 1 tableau TanStack |
| `/inbox` | Sidebar liste messages + zone conversation |
| `/settings` | Sections formulaire avec labels et inputs |

---

## 12. Directives pour l'IA (Claude)

> La section 11 (Skeletons) fait partie des directives : toujours créer un skeleton
> qui épouse la forme du composant réel. Ne jamais utiliser de spinner seul.

- Toujours respecter la structure modulaire : chaque feature dans son module.
- Ne jamais appeler getlate.dev directement depuis un composant React.
- Toujours valider avec Zod avant toute opération DB ou API externe.
- Toujours commenter les fichiers avec le bloc `@file` JSDoc en en-tête.
- Ne jamais exposer `SUPABASE_SERVICE_ROLE_KEY` côté client.
- Utiliser `createServerClient` (Supabase) dans les Server Components et Actions.
- Utiliser `createBrowserClient` (Supabase) dans les Client Components.
- Les Server Actions sont dans `modules/<nom>/actions/`.
- Les stores Zustand ne contiennent jamais de logique de fetch (déléguée à TanStack Query).
- **Activer les skills appropriés avant de coder** (voir tableau section 10).
- **Passer dans `code-simplifier` après chaque phase de code**.
- Toujours répondre et commenter en français.
