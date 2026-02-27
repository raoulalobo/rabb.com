# Plan général — ogolong.com

> Plan maître incrémental et itératif.
> Chaque phase est autonome, testable, et déployable indépendamment.

---

## Vision

ogolong.com est un SaaS de planification de contenu multiplateforme pour créateurs
francophones solo. Il s'appuie sur l'API getlate.dev pour la publication réelle
sur Instagram, TikTok, YouTube et Facebook (+ 9 autres).

---

## Stack de référence

| Rôle | Outil |
|---|---|
| Framework | Next.js 15 App Router + Turbopack |
| Base de données | Supabase PostgreSQL Cloud |
| Stockage médias | Supabase Storage |
| ORM + ACL | Prisma + ZenStack |
| Auth | better-auth |
| State client | Zustand + Immer |
| Validation | Zod |
| Data fetching | TanStack Query |
| Tables | TanStack Table |
| Background jobs | Inngest |
| Emails | Resend + React Email |
| Déploiement | Vercel |
| API sociale | getlate.dev |

---

## Phases du projet

| Phase | Fichier | Contenu | Statut |
|---|---|---|---|
| 00 | `00-overview.md` | Ce fichier — vision et roadmap | ✅ |
| 01 | `01-setup.md` | Init projet, tooling, CI/CD | ⬜ |
| 02 | `02-auth-db.md` | Auth (better-auth), DB (Prisma + ZenStack), Supabase | ⬜ |
| 03 | `03-platforms.md` | Connexion réseaux sociaux via getlate.dev | ⬜ |
| 04 | `04-post-composer.md` | Éditeur de post, upload média, brouillons | ⬜ |
| 05 | `05-scheduling.md` | Planification Inngest + publication getlate.dev | ⬜ |
| 06 | `06-analytics.md` | Dashboard statistiques (TanStack Table + graphiques) | ⬜ |
| 07 | `07-inbox.md` | Inbox unifié (commentaires + DMs) | ⬜ |
| 08 | `08-notifications.md` | Emails Resend (échec pub + récap hebdo) | ⬜ |
| 09 | `09-deployment.md` | Déploiement Vercel, variables d'env, monitoring | ⬜ |

---

## Principes de développement

1. **Schema-first** : Schéma Prisma → types Zod → composants (dans cet ordre)
2. **Skeleton-first** : chaque page a son `loading.tsx` AVANT d'avoir ses données réelles
3. **Skills-first** : activer le(s) skill(s) approprié(s) avant de coder (voir CLAUDE.md §10)
4. **Test au fur et à mesure** : tests unitaires après chaque module, E2E après chaque phase
5. **Code-simplifier** : passer `code-simplifier` après chaque phase de code

---

## Règles inter-phases

- Chaque phase commence par lire son fichier de plan.
- Chaque phase se termine par une vérification `pnpm build` sans erreur.
- Les migrations DB sont cumulatives (ne jamais modifier une migration existante).
- Les variables d'env ajoutées dans une phase sont documentées dans `09-deployment.md`.

---

## Arborescence cible finale

```
ogolong/
├── .claude/plans/          ← ce dossier
├── app/
│   ├── (auth)/
│   ├── (dashboard)/
│   └── api/
├── modules/
│   ├── auth/
│   ├── posts/
│   ├── platforms/
│   ├── analytics/
│   ├── inbox/
│   └── notifications/
├── lib/
├── components/
├── store/
├── hooks/
├── types/
├── prisma/
└── emails/
```
