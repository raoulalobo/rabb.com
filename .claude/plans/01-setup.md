# Phase 01 — Initialisation du projet

> **Skills à activer** : `next-best-practices`, `vercel-react-best-practices`
> **Durée estimée** : session unique
> **Prérequis** : Node.js 20+, pnpm, compte Vercel, compte Supabase

---

## Objectif

Créer la base du projet Next.js avec tout le tooling configuré, prêt à développer
sans friction : linting, formatting, alias de chemins, shadcn/ui, et structure de
dossiers modulaire en place.

---

## Étapes

### 1.1 — Création du projet Next.js

```bash
pnpm create next-app@latest ogolong \
  --typescript \
  --tailwind \
  --app \
  --turbopack \
  --import-alias "@/*"

cd ogolong
```

### 1.2 — Installation des dépendances

```bash
# ORM et base de données
pnpm add prisma @prisma/client
pnpm add zenstack @zenstackhq/runtime

# Auth
pnpm add better-auth

# State management
pnpm add zustand immer

# Validation
pnpm add zod

# Data fetching
pnpm add @tanstack/react-query @tanstack/react-table

# Background jobs
pnpm add inngest

# Emails
pnpm add resend @react-email/components react-email

# Supabase
pnpm add @supabase/supabase-js @supabase/ssr

# UI
pnpm dlx shadcn@latest init
# Composants shadcn à installer au fur et à mesure

# Dev dependencies
pnpm add -D vitest @vitejs/plugin-react @testing-library/react \
  @testing-library/user-event msw playwright \
  eslint-plugin-import eslint-config-prettier prettier
```

### 1.3 — Configuration ESLint + Prettier

```jsonc
// .eslintrc.json
{
  "extends": ["next/core-web-vitals", "prettier"],
  "plugins": ["import"],
  "rules": {
    // Ordre des imports (voir CLAUDE.md §4.5)
    "import/order": ["error", {
      "groups": ["builtin", "external", "internal", "parent", "sibling", "index", "type"],
      "newlines-between": "always",
      "alphabetize": { "order": "asc" }
    }],
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/explicit-function-return-type": "warn"
  }
}
```

```json
// .prettierrc
{
  "semi": false,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "es5",
  "printWidth": 100
}
```

### 1.4 — Structure de dossiers modulaire

Créer l'arborescence complète vide (avec `.gitkeep` pour les dossiers vides) :

```bash
mkdir -p \
  app/\(auth\)/login \
  app/\(auth\)/register \
  app/\(auth\)/reset-password \
  app/\(dashboard\)/compose \
  app/\(dashboard\)/calendar \
  app/\(dashboard\)/analytics \
  app/\(dashboard\)/inbox \
  app/\(dashboard\)/settings \
  app/api/auth \
  app/api/posts \
  app/api/platforms \
  app/api/analytics \
  app/api/inbox \
  app/api/inngest \
  modules/auth/components \
  modules/auth/hooks \
  modules/auth/store \
  modules/posts/components/PostComposer \
  modules/posts/components/PostCard \
  modules/posts/components/PostList \
  modules/posts/hooks \
  modules/posts/queries \
  modules/posts/store \
  modules/posts/schemas \
  modules/posts/actions \
  modules/platforms/components \
  modules/platforms/hooks \
  modules/platforms/schemas \
  modules/platforms/actions \
  modules/analytics/components \
  modules/analytics/hooks \
  modules/inbox/components \
  modules/inbox/hooks \
  modules/notifications/emails \
  modules/notifications/hooks \
  lib/supabase \
  lib/inngest/functions \
  lib/validations \
  components/ui \
  components/layout \
  components/shared \
  store \
  hooks \
  types \
  prisma \
  emails \
  tests/unit/modules/posts \
  tests/unit/lib \
  tests/integration/modules/posts \
  tests/e2e
```

### 1.5 — Configuration des alias TypeScript

```jsonc
// tsconfig.json (vérifier que ces paths sont présents)
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./*"],
      "@/modules/*": ["./modules/*"],
      "@/lib/*": ["./lib/*"],
      "@/components/*": ["./components/*"],
      "@/store/*": ["./store/*"],
      "@/hooks/*": ["./hooks/*"],
      "@/types/*": ["./types/*"]
    }
  }
}
```

### 1.6 — Fichier `.env.local`

```bash
# Copier le template
cp .env.example .env.local
```

```bash
# .env.example (committer ce fichier, pas .env.local)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

BETTER_AUTH_SECRET=
BETTER_AUTH_URL=http://localhost:3000

LATE_API_KEY=

INNGEST_EVENT_KEY=
INNGEST_SIGNING_KEY=

RESEND_API_KEY=
RESEND_FROM_EMAIL=noreply@ogolong.com
```

### 1.7 — Configuration Vitest

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') },
  },
})
```

### 1.8 — Configuration Vercel (CI/CD)

```json
// vercel.json
{
  "framework": "nextjs",
  "buildCommand": "pnpm build",
  "installCommand": "pnpm install",
  "devCommand": "pnpm dev"
}
```

### 1.9 — Composants shadcn de base

```bash
pnpm dlx shadcn@latest add button input label card skeleton
pnpm dlx shadcn@latest add dialog sheet tabs badge avatar
pnpm dlx shadcn@latest add form toast sonner
```

### 1.10 — Layout racine + dashboard shell (sans données)

Créer :
- `app/layout.tsx` — providers globaux (QueryClientProvider, Toaster)
- `app/(dashboard)/layout.tsx` — sidebar + header (avec skeleton placeholders)
- `components/layout/Sidebar.tsx` — navigation principale
- `components/layout/Header.tsx` — barre du haut

---

## Vérification / Tests

```bash
# Build sans erreur
pnpm build

# Linting propre
pnpm lint

# Serveur de développement
pnpm dev
# → http://localhost:3000 doit afficher la page d'accueil Next.js
```

**Critères de succès :**
- [ ] `pnpm build` passe sans erreur ni warning TypeScript
- [ ] `pnpm lint` passe sans erreur
- [ ] Structure de dossiers créée et conforme à `00-overview.md`
- [ ] `.env.example` commité, `.env.local` dans `.gitignore`
- [ ] shadcn/ui initialisé avec les composants de base

---

## Passage à la phase suivante

Une fois cette phase validée → lire `02-auth-db.md`.
