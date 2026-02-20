# Phase 05 — Planification & Publication (Inngest)

> **Skills à activer** : `next-best-practices`, `vercel-react-best-practices`
> **Prérequis** : Phase 04 complétée (posts sauvegardés en DB)

---

## Objectif

Mettre en place le moteur de publication asynchrone :
- Planification d'un post à une date/heure précise via Inngest
- Publication effective via getlate.dev au moment prévu
- Gestion des échecs avec retry automatique
- Vue calendrier des posts planifiés

---

## Architecture Inngest

```
User clique "Planifier"
  → Server Action : savePost(status: SCHEDULED, scheduledFor: Date)
    → Inngest event : { name: "post/schedule", data: { postId, scheduledFor } }
      → Inngest function : schedulePost
        → À scheduledFor : appel getlate.dev → publication
          → Succès : DB post.status = PUBLISHED, post.publishedAt = now()
          → Échec   : DB post.status = FAILED, post.failureReason = message
                      → Inngest event : "post/failed" → email Resend
```

---

## Étapes

### 5.1 — Client Inngest

```typescript
// lib/inngest/client.ts
/**
 * @file client.ts
 * @description Client Inngest singleton.
 *   Toutes les fonctions Inngest importent ce client.
 *
 * @example
 *   import { inngest } from '@/lib/inngest/client'
 *   await inngest.send({ name: 'post/schedule', data: { postId: '...' } })
 */
import { Inngest } from 'inngest'

export const inngest = new Inngest({
  id: 'rabb',
  name: 'rabb.com',
})
```

### 5.2 — Fonction Inngest : publication planifiée

```typescript
// lib/inngest/functions/publish-scheduled-post.ts
/**
 * @file publish-scheduled-post.ts
 * @description Fonction Inngest déclenchée sur l'event "post/schedule".
 *   Attend la date scheduledFor, puis publie le post via getlate.dev.
 *   Retry automatique (3 tentatives) en cas d'erreur réseau.
 *
 * Événements écoutés :
 *   - "post/schedule" : { postId: string, scheduledFor: string (ISO) }
 *
 * Événements émis :
 *   - "post/failed" : si toutes les tentatives échouent
 */
import { inngest } from '@/lib/inngest/client'
import { late } from '@/lib/late'
import { prisma } from '@/lib/prisma'

export const publishScheduledPost = inngest.createFunction(
  {
    id: 'publish-scheduled-post',
    name: 'Publier un post planifié',
    // Retry automatique : 3 tentatives avec backoff exponentiel
    retries: 3,
  },
  { event: 'post/schedule' },
  async ({ event, step }) => {
    const { postId, scheduledFor } = event.data

    // Étape 1 : Attendre jusqu'à la date de publication planifiée
    await step.sleepUntil('attendre-heure-publication', scheduledFor)

    // Étape 2 : Récupérer le post en DB
    const post = await step.run('recuperer-post', async () => {
      return prisma.post.findUnique({
        where: { id: postId },
        include: { user: true },
      })
    })

    if (!post || post.status !== 'SCHEDULED') {
      // Post annulé ou déjà publié entre-temps → on arrête
      return { skipped: true, reason: 'Post non trouvé ou non planifié' }
    }

    // Étape 3 : Publier via getlate.dev
    const result = await step.run('publier-getlate', async () => {
      return late.posts.create({
        text:      post.text,
        platforms: post.platforms as any[],
        mediaUrls: post.mediaUrls,
      })
    })

    // Étape 4 : Mettre à jour le statut en DB
    await step.run('mettre-a-jour-statut', async () => {
      return prisma.post.update({
        where: { id: postId },
        data: {
          status:      'PUBLISHED',
          publishedAt: new Date(),
          latePostId:  result.id,
        },
      })
    })

    return { published: true, latePostId: result.id }
  }
)
```

### 5.3 — Fonction Inngest : gestion des échecs

```typescript
// lib/inngest/functions/handle-post-failure.ts
/**
 * @file handle-post-failure.ts
 * @description Fonction Inngest déclenchée si "post/schedule" échoue.
 *   Met à jour le statut du post en FAILED et envoie un email d'alerte.
 */
import { inngest } from '@/lib/inngest/client'
import { prisma } from '@/lib/prisma'
import { resend } from '@/lib/resend'
import { PublicationFailedEmail } from '@/emails/PublicationFailed'

export const handlePostFailure = inngest.createFunction(
  { id: 'handle-post-failure', name: 'Gérer échec publication' },
  // Déclenché automatiquement par Inngest quand la fonction principale échoue
  { event: 'inngest/function.failed' },
  async ({ event, step }) => {
    // Vérifier que c'est bien notre fonction qui a échoué
    if (!event.data.function_id?.includes('publish-scheduled-post')) return

    const postId = event.data.event?.data?.postId
    if (!postId) return

    // 1. Mettre le post en statut FAILED
    const post = await step.run('marquer-echec', async () => {
      return prisma.post.update({
        where: { id: postId },
        data: {
          status: 'FAILED',
          failureReason: event.data.error?.message ?? 'Erreur inconnue',
        },
        include: { user: true },
      })
    })

    // 2. Vérifier les préférences de notification de l'utilisateur
    const prefs = await step.run('verifier-prefs', async () => {
      return prisma.notificationPrefs.findUnique({
        where: { userId: post.userId },
      })
    })

    if (!prefs?.emailOnFailure) return { skipped: true }

    // 3. Envoyer l'email d'alerte via Resend
    await step.run('envoyer-email-echec', async () => {
      return resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL!,
        to: post.user.email,
        subject: '⚠️ Échec de publication — rabb',
        react: PublicationFailedEmail({
          userName:     post.user.name ?? 'Utilisateur',
          postText:     post.text.substring(0, 100),
          platforms:    post.platforms,
          failureReason: post.failureReason ?? 'Erreur inconnue',
          postUrl:      `${process.env.BETTER_AUTH_URL}/compose?postId=${postId}`,
        }),
      })
    })
  }
)
```

### 5.4 — Route handler Inngest (webhook)

```typescript
// app/api/inngest/route.ts
/**
 * @file route.ts
 * @description Endpoint webhook Inngest (GET + POST + PUT).
 *   Doit être accessible publiquement (pas de middleware d'auth sur cette route).
 *   Inngest envoie ses events ici.
 */
import { serve } from 'inngest/next'
import { inngest } from '@/lib/inngest/client'
import { publishScheduledPost } from '@/lib/inngest/functions/publish-scheduled-post'
import { handlePostFailure } from '@/lib/inngest/functions/handle-post-failure'

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [publishScheduledPost, handlePostFailure],
})
```

### 5.5 — Server Action : planifier un post

```typescript
// modules/posts/actions/schedule-post.action.ts
/**
 * @file schedule-post.action.ts
 * @description Server Action : sauvegarde le post en SCHEDULED et déclenche
 *   l'event Inngest pour la publication différée.
 *
 * @param data - PostCreateSchema avec scheduledFor obligatoire
 * @returns { post } - Post planifié
 */
'use server'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { inngest } from '@/lib/inngest/client'
import { PostCreateSchema } from '@/modules/posts/schemas/post.schema'
import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'

export async function schedulePost(data: unknown, existingPostId?: string) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) throw new Error('Non authentifié')

  const validated = PostCreateSchema.parse(data)
  if (!validated.scheduledFor) throw new Error('Date de publication requise')

  // Créer ou mettre à jour le post
  const post = existingPostId
    ? await prisma.post.update({
        where: { id: existingPostId, userId: session.user.id },
        data: { ...validated, status: 'SCHEDULED' },
      })
    : await prisma.post.create({
        data: { ...validated, userId: session.user.id, status: 'SCHEDULED' },
      })

  // Déclencher l'event Inngest
  await inngest.send({
    name: 'post/schedule',
    data: {
      postId:      post.id,
      scheduledFor: post.scheduledFor!.toISOString(),
    },
  })

  revalidatePath('/calendar')
  return { post }
}
```

### 5.6 — Vue calendrier

```typescript
// app/(dashboard)/calendar/page.tsx
// app/(dashboard)/calendar/loading.tsx  ← grille 7 colonnes avec cellules skeleton
```

Le calendrier affiche :
- Grille mensuelle avec les posts planifiés positionnés par date
- Code couleur par statut : DRAFT (gris), SCHEDULED (bleu), PUBLISHED (vert), FAILED (rouge)
- Clic sur un post → drawer avec résumé + actions

```typescript
// modules/posts/hooks/useCalendarPosts.ts
/**
 * @file useCalendarPosts.ts
 * @description Hook TanStack Query : posts du mois en cours pour le calendrier.
 *
 * @param month - Mois ciblé (Date)
 * @returns { posts, isLoading } — Posts groupés par date
 */
```

---

## Tests

```typescript
// tests/integration/modules/posts/schedule-post.test.ts
// Utilise MSW pour mocker inngest.send et prisma
describe('schedulePost', () => {
  it('crée un post SCHEDULED et envoie l\'event Inngest', async () => { ... })
  it('rejette si scheduledFor est dans le passé', async () => { ... })
  it('rejette si utilisateur non authentifié', async () => { ... })
})
```

```bash
pnpm vitest run tests/integration/modules/posts
```

---

## Vérification / Critères de succès

- [ ] Bouton "Planifier" dans PostComposer → post créé en SCHEDULED + event Inngest envoyé
- [ ] Inngest Dev Server (`npx inngest-cli@latest dev`) voit l'event et la fonction
- [ ] Simulation : forcer `scheduledFor` dans 10s → post passe à PUBLISHED
- [ ] En cas d'erreur getlate.dev → post passe à FAILED
- [ ] Vue calendrier affiche les posts par date avec code couleur
- [ ] Skeleton de la grille calendrier visible pendant le chargement
- [ ] Tests d'intégration passent

---

## Passage à la phase suivante

Une fois cette phase validée → lire `06-analytics.md`.
