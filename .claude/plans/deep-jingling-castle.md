# Plan : Déplacer l'INSERT DB du Server Action vers la fonction Inngest

## Contexte

**Philosophie actuelle (DB-first) :**
```
Server Action → INSERT DB (status: SCHEDULED) → inngest.send({ postId })
Inngest → sleepUntil → READ DB → Late API → UPDATE DB (PUBLISHED)
```

**Nouveau principe voulu :**
> Si la fonction Inngest ne se lance pas (SIGNING_KEY absente, event perdu, etc.),
> aucun enregistrement orphelin en DB. L'insert n'a lieu QUE si Inngest démarre.

**Nouveau flux cible :**
```
Server Action → genère postId → inngest.send({ postId, ...allPostData })
                                        ↓ (Inngest traite l'event quasi-instantanément)
Inngest Step 0 → UPSERT in DB (status: SCHEDULED, createdAt = "Queued at")
Inngest Step 1 → sleepUntil(scheduledFor)  ("ended at" = scheduledFor)
Inngest Step 2+ → Late API → UPDATE DB (PUBLISHED)
```

**Conséquences :**
- Posts visibles dans le calendrier dès qu'Inngest traite l'event (< 1s en général)
- Zéro enregistrement SCHEDULED orphelin si Inngest ne peut pas traiter l'event
- Watchdog `watchdog-scheduled-post.ts` devient inutile (supprimé)

---

## Génération du postId — choix retenu

Deux options envisagées :

| Option | Mécanisme | Problème |
|---|---|---|
| `event.id` Inngest | `inngest.send()` retourne `{ ids }` → `ids[0]` utilisé comme postId | postId connu seulement APRÈS l'envoi → impossible de l'inclure dans `data` → `cancelOn: [{ match: 'data.postId' }]` ne fonctionne plus |
| `crypto.randomUUID()` | Généré AVANT l'envoi → inclus dans `data.postId` | Aucun — c'est le built-in Node.js |

**Choix retenu : `crypto.randomUUID()`** — permet de conserver le mécanisme `cancelOn`
qui compare `data.postId` entre l'event `post/schedule` et l'event `post/cancel`.

Prisma accepte un ID fourni même si le schéma a `@default(cuid())` :
```typescript
prisma.post.upsert({ where: { id: postId }, create: { id: postId, ... } })
```

---

## Fichiers modifiés

| Action | Fichier |
|---|---|
| Modifier | `modules/posts/actions/schedule-post.action.ts` |
| Modifier | `lib/inngest/functions/publish-scheduled-post.ts` |
| **Supprimer** | `lib/inngest/functions/watchdog-scheduled-post.ts` |
| Modifier | `app/api/inngest/route.ts` (retirer watchdog du serve()) |

---

## Correctif 1 — `schedule-post.action.ts`

### Changements
- Supprimer `prisma.post.create/update`
- Pré-générer `postId` avec `crypto.randomUUID()`
- Enrichir l'event `post/schedule` avec toutes les données du post
- Supprimer l'event `post/watchdog` (watchdog supprimé)
- Retourner un `SavePostResult` optimiste (données issues de l'input, pas de la DB)
- Conserver : auth, validation Zod, vérification plateforme connectée, ownership check

### Code clé

```typescript
// Pré-génère un UUID côté serveur (Node.js built-in)
// Inngest recevra cet ID et l'utilisera comme clé primaire lors de l'UPSERT en DB
const postId = existingPostId ?? crypto.randomUUID()

// Envoie toutes les données du post dans l'event
// (Inngest fait l'INSERT en DB dans son Step 0, pas ici)
await inngest.send({
  name: 'post/schedule',
  data: {
    postId,
    scheduledFor: scheduledFor.toISOString(),
    // Données complètes du post — Inngest s'occupera de l'UPSERT
    userId: session.user.id,
    text,
    platform,
    mediaUrls: mediaUrls ?? [],
  },
})

// Réponse optimiste : le post n'est pas encore en DB,
// mais l'UI n'utilise result.post que pour vérifier success (toast + reset)
return {
  success: true,
  post: {
    id: postId,
    userId: session.user.id,
    text,
    platform,
    mediaUrls: mediaUrls ?? [],
    scheduledFor,
    publishedAt: null,
    status: 'SCHEDULED' as const,
    latePostId: null,
    platformPostUrl: null,
    failureReason: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
}
```

### Note sur `existingPostId`
Pour une mise à jour : `postId = existingPostId` → l'UPSERT dans Inngest mettra à jour
le post existant (condition `where: { id: postId }`).

---

## Correctif 2 — `publish-scheduled-post.ts`

### Changements
- Récupérer les nouvelles données depuis `event.data` (text, platform, mediaUrls, userId)
- Ajouter **Step 0** avant `sleepUntil` : UPSERT du post en DB
- Tous les steps suivants restent identiques (profil Late, account ID, publication, update PUBLISHED)

### Nouvelle interface event.data

```typescript
// Ancienne structure : { postId, scheduledFor }
// Nouvelle structure : { postId, scheduledFor, userId, text, platform, mediaUrls }
const { postId, scheduledFor, userId, text, platform, mediaUrls } = event.data
```

### Nouveau Step 0 : upsert en DB

```typescript
// ── Étape 0 : Créer ou mettre à jour le post en DB ───────────────────────
// L'INSERT se fait ici (dans Inngest) et non dans le Server Action.
// Si la fonction ne s'est jamais lancée (SIGNING_KEY absente), aucun enregistrement
// orphelin en DB. createdAt = horodatage "Queued at" dans le Dashboard Inngest.
// `upsert` gère les deux cas : nouveau post (create) et re-planification (update).
await step.run('creer-ou-mettre-a-jour-post', async () => {
  return prisma.post.upsert({
    where: { id: postId },
    create: {
      id: postId,
      userId,
      text,
      platform,
      mediaUrls,
      scheduledFor: new Date(scheduledFor),
      status: 'SCHEDULED',
    },
    update: {
      text,
      platform,
      mediaUrls,
      scheduledFor: new Date(scheduledFor),
      status: 'SCHEDULED',
      // Efface l'erreur précédente si le post était FAILED (retry propre)
      failureReason: null,
    },
  })
})
```

Après ce step, les steps existants (sleepUntil, recuperer-post, recuperer-profil, etc.)
restent **inchangés** — ils lisent toujours le post depuis la DB par `postId`.

---

## Correctif 3 — Supprimer `watchdog-scheduled-post.ts`

Le watchdog était nécessaire pour détecter les posts SCHEDULED orphelins (Inngest
n'avait jamais exécuté la fonction → post bloqué en SCHEDULED indéfiniment).

Avec le nouveau design, si Inngest ne s'exécute pas → pas d'INSERT → pas d'orphelin.
Le watchdog n'a plus de raison d'être.

**Supprimer** `lib/inngest/functions/watchdog-scheduled-post.ts`

---

## Correctif 4 — `app/api/inngest/route.ts`

Retirer l'import et l'enregistrement du watchdog :

```typescript
// Supprimer ces lignes :
import { watchdogScheduledPost } from '@/lib/inngest/functions/watchdog-scheduled-post'
// ...
watchdogScheduledPost,  // dans functions: [...]
```

---

## Vérification post-implémentation

1. Soumettre un post planifié → dans le Dashboard Inngest, le run `publish-scheduled-post`
   doit apparaître avec :
   - Step 0 `creer-ou-mettre-a-jour-post` → succès (INSERT en DB)
   - Step 1 `attendre-heure-publication` → sleeping jusqu'à scheduledFor
2. Le calendrier doit afficher le post dans les secondes suivant la soumission
3. À scheduledFor : le post passe en PUBLISHED dans Inngest + DB
4. Vérifier dans Prisma Studio que `post.createdAt` ≈ heure de soumission (pas scheduledFor)
5. Tester la re-planification (existingPostId) : l'UPSERT met à jour le post sans doublon
