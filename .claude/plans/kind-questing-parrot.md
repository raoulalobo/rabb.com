# Plan : Épuration des services email inactifs

## Contexte

Trois services d'emailing coexistent dans le projet. Seul **Plunk** est actif (clé API configurée,
utilisé pour les emails d'auth). Les deux autres — **Resend** et **Loops** — sont inactifs
(clés API absentes/non configurées) et doivent être supprimés pour assainir le code.

| Service | Statut | Raison de suppression |
|---------|--------|-----------------------|
| **Plunk** | ✅ Actif | Conserver |
| **Resend** | ❌ Inactif | `RESEND_API_KEY` vide, jamais envoyé en prod |
| **Loops** | ❌ Inactif | Package installé, aucune implémentation, aucune clé API |

---

## Fichiers à supprimer intégralement

| Fichier | Raison |
|---------|--------|
| `lib/resend.ts` | Client singleton Resend — inutile sans clé API |
| `emails/PublicationFailed.tsx` | Template React Email utilisé exclusivement par Resend |

---

## Fichiers à modifier

### 1. `lib/inngest/functions/handle-post-failure.ts`
- Supprimer l'import `getResend` (ligne 26) et `PublicationFailedEmail` (ligne 23)
- Supprimer l'étape 2 (`verifier-prefs-notification`) — n'a de sens qu'avec l'envoi email
- Supprimer l'étape 3 (`envoyer-email-echec`) — dépend de Resend
- **Conserver** l'étape 1 (`marquer-echec`) — update DB `status: FAILED`, indépendante de Resend
- Retourner `{ postMarkedFailed: true }` au lieu de `{ postMarkedFailed: true, emailSent: true/false }`

### 2. `package.json`
- Supprimer la dépendance `resend` (~`6.9.2`)
- Supprimer la dépendance `loops` (~`6.2.1`)
- ⚠️ Conserver `@react-email/components`, `@react-email/render`, `react-email` — utilisés par Plunk

### 3. `.env.local`
- Supprimer les lignes `RESEND_API_KEY` et `RESEND_FROM_EMAIL`
- (Loops n'a pas de variable dans `.env.local`)

### 4. `.vercel/.env.development.local`
- Supprimer la ligne `LOOPS_EMAIL_VERIFICATION_ID`

---

## Ce qui est conservé (Plunk)

| Fichier | Rôle |
|---------|------|
| `lib/plunk.ts` | Client singleton Plunk |
| `lib/auth.ts` | Intégration better-auth (callbacks sendVerificationEmail + sendResetPassword) |
| `emails/VerificationEmail.tsx` | Template vérification email |
| `emails/ResetPasswordEmail.tsx` | Template reset mot de passe |
| `@react-email/*` | Librairie de templates (partagée, conservée) |

---

## Ordre d'exécution

1. Supprimer `emails/PublicationFailed.tsx`
2. Modifier `lib/inngest/functions/handle-post-failure.ts` (retirer imports + étapes 2 et 3)
3. Supprimer `lib/resend.ts`
4. Modifier `package.json` (retirer `resend` et `loops`)
5. Modifier `.env.local` (retirer variables Resend)
6. Modifier `.vercel/.env.development.local` (retirer variable Loops)
7. Désinstaller les packages : `bun remove resend loops`

---

## Vérification

- `bun run build` (ou `next dev`) — aucune erreur d'import manquant
- `lib/auth.ts` — toujours fonctionnel (Plunk intact)
- `lib/inngest/functions/handle-post-failure.ts` — compile, step 1 seul
- `grep -r "resend\|loops" lib/ emails/ modules/` → aucun résultat
