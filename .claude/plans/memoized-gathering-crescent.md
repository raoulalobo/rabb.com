# Plan — Corriger l'anachronisme Inngest "already scheduling" + UI stale

## Contexte

**Symptôme observé :**
1. Inngest log montre : `LateApiError: This exact content is already scheduled, publishing, or was posted to this account within the last 24 hours.`
2. Pourtant, le post est bien publié en DB : `status: PUBLISHED`, `latePostId: "69a7701c75d3b58f198d6982"`, `publishedAt`
3. L'application affiche le "premier message" (état d'erreur) au lieu de PUBLISHED

**Pourquoi ça arrive — l'anachronisme :**

La `LateApiError` est levée depuis `late.posts.create()` dans `step.run('publier-post')` (ligne 222, `publish-scheduled-post.ts`). Deux scénarios déclencheurs :

- **Scénario A (le plus probable)** : Inngest a rejoué la fonction (timeout Vercel, redémarrage) alors qu'un run précédent avait déjà envoyé la requête à Late. Late dit "already scheduling" car il traite encore la 1ère requête. Quelques secondes plus tard (retry Inngest), Late a fini son traitement et accepte la 2ème → PUBLISHED.
- **Scénario B** : Double-dispatch de l'event `post/schedule` (network blip côté Inngest).

**Pourquoi l'erreur n'est pas catchée :** Le code ne gère que les erreurs issues de `platformResult` (lignes 257+). Mais quand `late.posts.create()` *throw* directement (ligne 222-251), aucun `platformResult` n'est disponible — l'exception remonte comme erreur retryable générique. Inngest retente 3× avec backoff.

**Risque réel non couvert :** Si deux retries réussissent tous les deux côté Late → le contenu est publié **deux fois**. Dans le cas du client, un seul retry a abouti mais le risque demeure.

**Pourquoi l'UI affiche le vieux statut :** Le TanStack Query (kanban et compose) n'a pas de `refetchInterval`. L'UI charge les posts au montage et ne se re-synchronise pas quand Inngest termine (aucun mécanisme push).

---

## Fichiers critiques

- `lib/inngest/functions/publish-scheduled-post.ts` — **principal** : étape 4 à corriger
- `lib/late.ts` — `LateApiError`, `late.posts.get()` disponible (ligne 769)
- `modules/posts/queries/posts.queries.ts` — définit les queryKeys (kanban, compose)
- À trouver : hooks `useKanbanPosts` et hook compose — pour ajouter le refetchInterval

---

## Corrections à apporter

### Fix 1 — Idempotence + gestion de l'erreur "already scheduling" dans step 4

**Fichier** : `lib/inngest/functions/publish-scheduled-post.ts`

Dans `step.run('publier-post', async () => { ... })` (lignes 222-251), ajouter **deux mécanismes** :

**A. Vérification d'idempotence en tête de step**

Avant d'appeler `late.posts.create()`, re-lire le post en DB pour voir si un `latePostId` existe déjà (run Inngest précédent qui aurait réussi step 4 mais pas step 6) :

```typescript
const latePost = await step.run('publier-post', async () => {
  // ── Idempotence : vérifier si Late a déjà un post pour ce run ──────────────
  // Si un run Inngest précédent a réussi late.posts.create() mais échoué avant
  // step 6 (mise à jour DB), latePostId est déjà en DB → on récupère ce post
  // au lieu de re-soumettre à Late (ce qui déclencherait "already posted").
  const existingLatePostId = await prisma.post.findUnique({
    where: { id: postId },
    select: { latePostId: true },
  }).then(p => p?.latePostId)

  if (existingLatePostId) {
    console.log(`[publish-scheduled-post] latePostId déjà présent (${existingLatePostId}) → récupération directe`)
    return late.posts.get(existingLatePostId)
  }

  // ── Appel Late avec catch spécifique "already scheduling" ─────────────────
  try {
    return await late.posts.create({ ... /* params inchangés */ })
  } catch (err) {
    if (err instanceof LateApiError) {
      const msg = err.message.toLowerCase()
      if (
        msg.includes('already scheduled') ||
        msg.includes('publishing') ||
        msg.includes('already posted') ||
        msg.includes('already been posted')
      ) {
        // Late a déjà reçu une requête pour ce contenu.
        // Re-lire la DB : si un run concurrent a réussi entre-temps, latePostId est là.
        const concurrentLatePostId = await prisma.post.findUnique({
          where: { id: postId },
          select: { latePostId: true },
        }).then(p => p?.latePostId)

        if (concurrentLatePostId) {
          // Run concurrent réussi → récupérer le post Late et continuer
          console.log(`[publish-scheduled-post] Run concurrent détecté, latePostId=${concurrentLatePostId}`)
          return late.posts.get(concurrentLatePostId)
        }

        // Aucun run concurrent détecté — Late a la requête mais on n'a pas l'ID.
        // On ne peut pas re-soumettre (Late rejette en boucle) ni tracker le post.
        // Marquer FAILED avec message clair pour l'utilisateur.
        await prisma.post.update({
          where: { id: postId },
          data: {
            status: 'FAILED',
            failureReason: `Late traite déjà ce contenu mais la publication n'a pas pu être confirmée. `
              + `Vérifie sur ${post.platform} si le post est apparu. Si oui, marque-le manuellement comme publié.`,
          },
        })
        throw new NonRetriableError(`Late already handling post ${postId} — no latePostId tracked`)
      }
    }
    throw err // rethrow les autres LateApiError (400 format, 401 token, etc.)
  }
})
```

**Import à ajouter** en tête du fichier :
```typescript
import { LateApiError } from '@/lib/late'
```

### Fix 2 — Polling TanStack Query pour les posts SCHEDULED

**Fichier** : hooks consommant `postQueryKeys.kanban()` et `composeQueryKey()`

Ajouter un `refetchInterval` dynamique qui poll toutes les **10 secondes** tant qu'il existe des posts `SCHEDULED` dans les données. Dès qu'aucun post n'est SCHEDULED, polling arrêté automatiquement.

```typescript
// Dans useKanbanPosts() (ou hook équivalent)
refetchInterval: (data) => {
  const posts = data?.pages?.flatMap(p => p.posts) ?? data ?? []
  return posts.some((p: Post) => p.status === 'SCHEDULED') ? 10_000 : false
},
```

Cela garantit que l'UI se synchronise avec la DB ~10s après qu'Inngest publie le post.

---

## Ordre d'implémentation

1. Ajouter l'import `LateApiError` dans `publish-scheduled-post.ts`
2. Modifier `step.run('publier-post', ...)` avec idempotence + catch spécifique
3. Localiser les hooks kanban + compose et ajouter le `refetchInterval`

---

## Vérification

1. **Test manuel** : planifier un post sur TikTok → dans Inngest Dashboard, vérifier que le run ne montre plus d'erreur retryable pour "already scheduled/publishing"
2. **Test idempotence** : dans `step.run('publier-post')`, ajouter un `console.log` du `latePostId` existant → vérifier dans les logs Vercel qu'il n'appelle pas `late.posts.create()` deux fois
3. **Test UI** : planifier un post, observer la vue Kanban → elle doit passer de SCHEDULED à PUBLISHED sans rechargement manuel (dans les ~10-40s selon Late)
4. **Cas edge** : simuler "already scheduling" sans `latePostId` en DB → vérifier que le post passe en FAILED avec le message clair (visible dans l'UI)
