# Phase 09 — Déploiement & Production

> **Skills à activer** : `next-best-practices`
> **Prérequis** : Phases 01-08 complétées et validées

---

## Objectif

Déployer rabb.com en production sur Vercel avec :
- Variables d'environnement correctement configurées
- Domaine personnalisé rabb.com
- Inngest connecté en production
- Monitoring et alertes de base

---

## Checklist pré-déploiement

### 9.1 — Vérifications locales finales

```bash
# Build de production sans erreur
pnpm build

# Pas d'erreur TypeScript
pnpm tsc --noEmit

# Linting propre
pnpm lint

# Tests unitaires et d'intégration
pnpm vitest run

# Tests E2E (parcours critiques)
pnpm playwright test
```

**Critères de blocage** (ne pas déployer si l'un échoue) :
- [ ] `pnpm build` : 0 erreur, 0 warning TypeScript
- [ ] `pnpm lint` : 0 erreur ESLint
- [ ] Tests unitaires : tous passent
- [ ] Test E2E : inscription → connexion réseau → création post → planification

---

### 9.2 — Variables d'environnement Vercel

Configurer dans Vercel Dashboard → Settings → Environment Variables :

```bash
# ─── Supabase ────────────────────────────────────────────────
NEXT_PUBLIC_SUPABASE_URL          = https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY     = eyJhbGci...
SUPABASE_SERVICE_ROLE_KEY         = eyJhbGci...   # ← Secret, ne jamais exposer côté client
DATABASE_URL                      = postgresql://...?pgbouncer=true&connection_limit=1
DIRECT_URL                        = postgresql://...          # Pour les migrations Prisma

# ─── better-auth ─────────────────────────────────────────────
BETTER_AUTH_SECRET                = [générer avec : openssl rand -base64 32]
BETTER_AUTH_URL                   = https://rabb.com

# ─── OAuth Google ────────────────────────────────────────────
GOOGLE_CLIENT_ID                  = [depuis console.cloud.google.com]
GOOGLE_CLIENT_SECRET              = [depuis console.cloud.google.com]

# ─── getlate.dev ─────────────────────────────────────────────
LATE_API_KEY                      = sk_live_...

# ─── Inngest ─────────────────────────────────────────────────
INNGEST_EVENT_KEY                 = [depuis dashboard.inngest.com]
INNGEST_SIGNING_KEY               = signkey-prod-...

# ─── Resend ──────────────────────────────────────────────────
RESEND_API_KEY                    = re_live_...
RESEND_FROM_EMAIL                 = noreply@rabb.com

# ─── App ─────────────────────────────────────────────────────
NEXT_PUBLIC_APP_URL               = https://rabb.com
```

> **Règle de sécurité** : seules les variables préfixées `NEXT_PUBLIC_` sont
> accessibles côté navigateur. Toutes les autres sont exclusivement serveur.

---

### 9.3 — Configuration Supabase pour la production

```sql
-- Dans Supabase SQL Editor : activer RLS sur toutes les tables
ALTER TABLE posts              ENABLE ROW LEVEL SECURITY;
ALTER TABLE connected_platforms ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_prefs  ENABLE ROW LEVEL SECURITY;

-- ZenStack gère les règles d'accès en application,
-- RLS Supabase est une couche de sécurité supplémentaire au niveau DB
```

**Bucket Supabase Storage `post-media` :**
```
- Access : Public (les médias doivent être accessibles par getlate.dev)
- Taille max : 500 MB par fichier
- Types autorisés : image/*, video/*
- Durée de vie : pas de TTL (les médias sont persistants)
```

---

### 9.4 — Déploiement Vercel

```bash
# Via CLI Vercel
npx vercel --prod

# OU via Git : connecter le repo GitHub à Vercel
# Chaque push sur main → déploiement automatique
```

**Configuration `vercel.json` :**
```json
{
  "framework": "nextjs",
  "buildCommand": "pnpm prisma generate && pnpm zenstack generate && pnpm build",
  "installCommand": "pnpm install",
  "regions": ["cdg1"],
  "functions": {
    "app/api/inngest/route.ts": {
      "maxDuration": 300
    }
  }
}
```

> `maxDuration: 300` pour la route Inngest car les fonctions peuvent tourner longtemps.

---

### 9.5 — Migration DB en production

```bash
# Depuis la machine de dev (avec DIRECT_URL pointant vers prod)
DATABASE_URL=$DIRECT_URL pnpm prisma migrate deploy

# Vérifier que toutes les migrations sont appliquées
pnpm prisma migrate status
```

---

### 9.6 — Configuration Inngest en production

1. Aller sur [dashboard.inngest.com](https://app.inngest.com)
2. Créer une app "rabb-production"
3. Dans **Apps** → pointer vers `https://rabb.com/api/inngest`
4. Cliquer "Sync" → vérifier que les 3 fonctions sont détectées :
   - `publish-scheduled-post`
   - `handle-post-failure`
   - `weekly-recap`
5. Vérifier le cron `weekly-recap` dans **Functions → Schedules**

---

### 9.7 — Domaine personnalisé Vercel

1. Vercel Dashboard → Settings → Domains → Add `rabb.com`
2. Configurer les DNS chez le registrar :
   ```
   A     @    76.76.21.21
   CNAME www  cname.vercel-dns.com
   ```
3. Attendre la propagation DNS (max 48h)
4. Vérifier le certificat SSL Let's Encrypt (automatique via Vercel)

---

### 9.8 — Tests E2E parcours critiques (Playwright)

```typescript
// tests/e2e/schedule-post.spec.ts
/**
 * @file schedule-post.spec.ts
 * @description Test E2E du parcours complet : inscription → connexion réseau
 *   → création de post → planification.
 *   Utilise un compte de test dédié (ne pas utiliser en prod).
 */
import { test, expect } from '@playwright/test'

test('parcours complet : inscription → post planifié', async ({ page }) => {
  // 1. Inscription
  await page.goto('/register')
  await page.fill('[name="email"]', 'test-e2e@rabb.com')
  await page.fill('[name="password"]', 'TestPassword123!')
  await page.click('button[type="submit"]')
  await expect(page).toHaveURL('/dashboard')

  // 2. Navigation vers /compose
  await page.goto('/compose')
  await expect(page.locator('[data-testid="post-composer"]')).toBeVisible()

  // 3. Rédiger un post
  await page.fill('[data-testid="composer-editor"]', 'Test post automatisé rabb E2E')

  // 4. Sauvegarder en brouillon
  await page.click('[data-testid="save-draft-btn"]')
  await expect(page.locator('[data-testid="toast-success"]')).toBeVisible()

  // 5. Vérifier dans le calendrier
  await page.goto('/calendar')
  await expect(page.locator('text=Test post automatisé rabb E2E')).toBeVisible()
})
```

```bash
# Lancer les tests E2E
pnpm playwright test

# Avec interface graphique
pnpm playwright test --ui
```

---

### 9.9 — Monitoring (post-déploiement)

**Vercel Analytics** (gratuit) :
- Activer dans Vercel Dashboard → Analytics
- Suivre les Web Vitals (LCP, FID, CLS)

**Sentry** (optionnel, post-MVP) :
```bash
pnpm add @sentry/nextjs
# Suivre le guide Sentry Next.js pour la configuration
```

**Alertes Inngest** :
- Configurer des alertes email dans le dashboard Inngest si une fonction échoue
- Seuil recommandé : alerte si > 3 échecs consécutifs

---

## Checklist de mise en production finale

- [ ] `pnpm build` passe sans erreur en local avec les vars prod
- [ ] Toutes les vars d'env configurées sur Vercel
- [ ] Migration DB déployée (`prisma migrate deploy`)
- [ ] Inngest synced avec `https://rabb.com/api/inngest`
- [ ] Domaine rabb.com → SSL actif
- [ ] Test manuel : inscription, connexion, connexion réseau, création post
- [ ] Email de test reçu (déclencher manuellement depuis Inngest dashboard)
- [ ] Web Vitals Vercel : LCP < 2.5s, CLS < 0.1
- [ ] Tests E2E passent sur l'URL de production

---

## Commandes de maintenance

```bash
# Voir les logs Vercel en temps réel
npx vercel logs --follow

# Relancer les migrations après un schéma DB modifié
pnpm prisma migrate deploy

# Redéclencher une fonction Inngest manuellement
# → dashboard.inngest.com → Functions → [nom] → Run
```
