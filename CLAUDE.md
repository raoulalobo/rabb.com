# CLAUDE.md — ogolong.com

> Guide de référence pour l'IA et les développeurs.
> Toujours lire ce fichier avant de modifier du code.

---

## 1. Présentation du projet

**ogolong.com** est un SaaS de planification de contenu sur les réseaux sociaux,
ciblant les créateurs de contenu francophones solo.
Il s'appuie sur l'API **Zernio** (ex getlate.dev) pour la publication multi-plateformes.

### Plateformes prioritaires
`Instagram` · `TikTok` · `YouTube` · `Facebook`
(Les 9 autres plateformes Zernio sont disponibles mais non mises en avant dans l'UI)

### Langue de l'UI
Français uniquement (MVP). i18n (next-intl) ajouté ultérieurement.

---

## 2. Stack technique

| Couche | Technologie | Rôle |
|---|---|---|
| Framework | Next.js 16 (App Router, Turbopack) | Frontend + API Routes |
| Base de données | Supabase (PostgreSQL Cloud) | Données applicatives (users, platforms, media, etc.) |
| Stockage fichiers | Supabase Storage | Images et vidéos uploadées |
| ORM | Prisma | Modèles DB (hors posts — gérés par Zernio) |
| Auth | better-auth | Authentification (email, OAuth) |
| State management | Zustand + Immer | État global client |
| Validation | Zod | Schémas de données (server + client) |
| Data fetching | TanStack Query | Cache, synchronisation serveur |
| Emails | Resend + React Email | Notifications transactionnelles |
| Déploiement | Vercel | Hosting + Edge Functions |
| API sociale | Zernio (zernio.com/api) | Publication, scheduling, source de vérité posts |

### Architecture des posts — Zernio comme source de vérité unique

Les posts ne sont **pas** stockés en DB locale (Prisma). Zernio est la source de vérité unique :
- **Lecture** : `GET /api/posts` → proxy vers `GET /v1/posts` Zernio
- **Création** : `createPost()` Server Action → `POST /v1/posts` Zernio
- **Modification** : `updatePost()` → `PUT /v1/posts/:id` Zernio
- **Suppression** : `deletePost()` → `DELETE /v1/posts/:id` Zernio
- **Retry** : `retryPost()` → `POST /v1/posts/:id/retry` Zernio
- **Scheduling** : Zernio gère nativement le timing (`scheduledFor` + `timezone`)

---

## 3. Architecture modulaire

```
ogolong/
├── app/                        # Next.js App Router
│   ├── (auth)/                 # Routes publiques (login, register, reset)
│   ├── (dashboard)/            # Routes protégées (layout avec sidebar)
│   │   ├── page.tsx            # Dashboard home (stats rapides)
│   │   ├── calendar/           # Calendrier de planification (vue principale des posts)
│   │   ├── queue/              # File d'attente (créneaux horaires récurrents)
│   │   ├── gallery/            # Galerie média (Supabase Storage)
│   │   ├── analytics/          # Statistiques détaillées
│   │   └── settings/           # Compte, réseaux connectés, facturation
│   └── api/
│       ├── auth/               # better-auth handlers
│       ├── posts/              # Proxy Zernio (lecture + CRUD posts)
│       ├── platforms/          # Connexion OAuth réseaux sociaux
│       ├── analytics/          # Proxy Zernio analytics
│       └── dashboard/          # Stats agrégées (via Zernio)
│
├── modules/                    # ← CŒUR DE L'ARCHITECTURE MODULAIRE
│   ├── auth/                   # Module authentification
│   ├── posts/                  # Module posts (via Zernio, zéro DB locale)
│   │   ├── components/
│   │   │   ├── PostComposer/   # Éditeur de post (compound component)
│   │   │   ├── CalendarGrid/   # Grille calendrier (mois + semaine)
│   │   │   └── CalendarView/   # Orchestrateur calendrier (Dialog + filtres)
│   │   ├── hooks/              # useCalendarPosts
│   │   ├── queries/            # TanStack Query keys + fetchers (proxy Zernio)
│   │   ├── store/              # Zustand: draftStore (brouillon en mémoire)
│   │   ├── schemas/            # Zod: PostCreateSchema
│   │   ├── actions/            # Server Actions → API Zernio directe
│   │   │   ├── create-post.action.ts
│   │   │   ├── update-post.action.ts
│   │   │   ├── delete-post.action.ts
│   │   │   └── retry-post.action.ts
│   │   ├── utils/              # failure-advice, status-styles
│   │   └── types.ts            # Post normalisé + mapZernioPost()
│   ├── platforms/              # Module réseaux sociaux connectés
│   ├── analytics/              # Module statistiques
│   ├── queue/                  # Module file d'attente (créneaux locaux Prisma)
│   ├── signatures/             # Module signatures réutilisables
│   └── notifications/          # Module emails + notifs in-app
│
├── lib/                        # Clients et utilitaires partagés
│   ├── late.ts                 # Client Zernio (singleton) — base URL: zernio.com/api
│   ├── prisma.ts               # Client Prisma (users, platforms, media, queue, etc.)
│   ├── supabase/               # Clients Supabase (browser + server)
│   ├── resend.ts               # Client Resend (singleton)
│   ├── auth.ts                 # Config better-auth
│   └── validations/            # Schémas Zod partagés
│
├── components/                 # Composants UI génériques (shadcn/ui + layout)
├── store/                      # Stores Zustand globaux
├── hooks/                      # Hooks React globaux
├── types/                      # Types TypeScript globaux
│
└── prisma/
    └── schema.prisma           # Schéma Prisma (sans modèle Post — supprimé)
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
```
modules/<nom>/
├── components/     # Composants React du module
├── hooks/          # Hooks React (logique réutilisable)
├── queries/        # Clés + fetchers TanStack Query
├── store/          # Store Zustand du module (si état local complexe)
├── schemas/        # Schémas Zod (validation)
├── actions/        # Server Actions Next.js (→ API Zernio ou Prisma)
└── types.ts        # Types TypeScript du module
```

### 4.3 Commentaires
- **Chaque fichier** doit commencer par un commentaire `@file` JSDoc en en-tête.
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

### 5.1 API-First Pattern (posts)
Les posts n'ont pas de table locale. Toute interaction passe par l'API Zernio :
```typescript
// ✅ Correct — Server Action appelle Zernio directement
// modules/posts/actions/create-post.action.ts
'use server'
export async function createPost(data: { text: string; platform: string; ... }) {
  const zernioPost = await late.posts.create({ content: data.text, ... })
  return { success: true, post: mapZernioPost(zernioPost) }
}
```

### 5.2 Proxy Pattern (API routes)
Les routes `/api/posts` sont de simples proxies vers Zernio avec normalisation :
```typescript
// app/api/posts/route.ts
// GET /api/posts?year=2026&month=3 → GET /v1/posts?from=...&to=...&profileId=...
const data = await late.posts.list(zernioParams)
const posts = data.posts.map(mapZernioPost)  // Normalise ZernioRawPost → Post
```

### 5.3 Store Pattern (Zustand + Immer)
Un store par domaine. Immer permet les mutations immuables lisibles.
Le `draftStore` garde le brouillon en mémoire (sessionStorage) avant envoi à Zernio.

### 5.4 Schema-First Validation (Zod)
Définir le schéma Zod AVANT le composant. Inférer le type TypeScript depuis Zod.

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

---

## 7. Workflows clés

### 7.1 Publication d'un post planifié
```
1. User remplit PostComposer → draftStore mis à jour en temps réel
2. Validation Zod côté client (feedback immédiat)
3. Soumission → createPost() Server Action
4. Appel Zernio : POST /v1/posts avec scheduledFor + timezone
5. Zernio stocke le post et gère le timing automatiquement
6. À l'heure prévue, Zernio publie sur la plateforme cible
7. Au prochain refetch calendrier → statut "published" + platformPostUrl
```

### 7.2 Upload média
```
1. User sélectionne fichier → validation (type, taille) côté client
2. Génération d'un presigned URL Supabase Storage (via API Route)
3. Upload direct du fichier depuis le browser vers Supabase Storage
4. URL publique stockée dans draftStore
5. URL transmise à Zernio lors de la création du post
```

### 7.3 Retry d'un post échoué
```
1. User voit un post FAILED dans le calendrier
2. Clic → Dialog avec FailureAlert + bouton "Relancer"
3. retryPost() → POST /v1/posts/:id/retry
4. Zernio relance uniquement les plateformes échouées
5. Invalidation cache → calendrier rafraîchi
```

---

## 8. Variables d'environnement requises

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Base de données
DATABASE_URL=          # Connection pooler PgBouncer (runtime)
DIRECT_URL=            # Connexion directe (migrations Prisma)

# better-auth
BETTER_AUTH_SECRET=
BETTER_AUTH_URL=

# Zernio (ex getlate.dev)
LATE_API_KEY=          # Clé API Zernio (Bearer token)

# Resend
RESEND_API_KEY=
RESEND_FROM_EMAIL=noreply@ogolong.com
```

---

## 9. Tests

### Stratégie
- **Unitaires** (Vitest) : schémas Zod, fonctions utilitaires, stores Zustand
- **Intégration** (Vitest + MSW) : Server Actions, API Routes (mocks Zernio/Supabase)
- **E2E** (Playwright) : Parcours critiques (inscription → connexion réseau → création post → planification)

---

## 10. Skills Claude Code installés

Voir les skills dans `~/.claude/skills/`. Activer automatiquement selon le contexte.

| Skill | Déclencher quand... |
|---|---|
| `next-best-practices` | Routes, Server Components, data fetching, layouts |
| `vercel-react-best-practices` | Création/révision de composants React |
| `vercel-composition-patterns` | Composants réutilisables (compound, context) |
| `frontend-design` | Création d'UI (pages, dashboard, landing) |
| `web-design-guidelines` | Audit UI/UX, accessibilité |
| `supabase-postgres-best-practices` | Schéma Prisma, requêtes SQL, migrations |
| `better-auth-best-practices` | Configuration better-auth |
| `code-simplifier` | Après chaque session de code |

---

## 11. États de chargement — Skeletons

Chaque page et composant qui charge des données **doit avoir un skeleton qui reproduit
fidèlement la forme et la disposition du contenu réel**. Jamais de spinner générique.

Utiliser les fichiers `loading.tsx` natifs de Next.js ou `<Suspense>` avec un skeleton dédié.

---

## 12. Directives pour l'IA (Claude)

- Toujours respecter la structure modulaire : chaque feature dans son module.
- **Ne jamais appeler Zernio directement depuis un composant React** — passer par les Server Actions ou API routes proxy.
- Toujours valider avec Zod avant toute opération API externe.
- Toujours commenter les fichiers avec le bloc `@file` JSDoc en en-tête.
- Ne jamais exposer `SUPABASE_SERVICE_ROLE_KEY` côté client.
- Les Server Actions posts sont dans `modules/posts/actions/` et appellent `lib/late.ts`.
- Les stores Zustand ne contiennent jamais de logique de fetch (déléguée à TanStack Query).
- **Les posts n'ont pas de table Prisma** — tout passe par Zernio.
- `timezone: "Europe/Paris"` est le défaut pour le scheduling (MVP francophone).
- Toujours répondre et commenter en français.
