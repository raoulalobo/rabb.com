# Phase 07 — Inbox unifié

> **Skills à activer** : `frontend-design`, `vercel-react-best-practices`, `web-design-guidelines`
> **Prérequis** : Phase 03 complétée (plateformes connectées)

---

## Objectif

Centraliser les commentaires et messages directs de toutes les plateformes
connectées dans une seule interface, via l'API inbox de getlate.dev.

---

## Étapes

### 7.1 — Route API proxy inbox

```typescript
// app/api/inbox/route.ts
/**
 * @file route.ts
 * @description Proxy vers getlate.dev inbox API.
 *   Retourne les commentaires et DMs de toutes les plateformes connectées.
 *
 * Query params :
 *   - type : 'comments' | 'dms' | 'all' (défaut: 'all')
 *   - platform : filtrer par plateforme (optionnel)
 *   - cursor : pagination cursor (optionnel)
 */
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { late } from '@/lib/late'
import { prisma } from '@/lib/prisma'
import { headers } from 'next/headers'

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const type     = searchParams.get('type') ?? 'all'
  const platform = searchParams.get('platform') ?? undefined
  const cursor   = searchParams.get('cursor') ?? undefined

  const connectedPlatforms = await prisma.connectedPlatform.findMany({
    where: { userId: session.user.id, isActive: true },
  })

  if (connectedPlatforms.length === 0) {
    return NextResponse.json({ messages: [], nextCursor: null })
  }

  const inbox = await late.inbox.list({
    profileIds: connectedPlatforms.map((p) => p.lateProfileId),
    type:       type as any,
    platform,
    cursor,
    limit: 30,
  })

  return NextResponse.json(inbox)
}
```

### 7.2 — Types inbox

```typescript
// modules/inbox/types.ts
/**
 * @file types.ts
 * @description Types pour les messages inbox.
 */

export type MessageType = 'comment' | 'dm' | 'mention' | 'review'

export interface InboxMessage {
  id:          string
  type:        MessageType
  platform:    string
  authorName:  string
  authorAvatar?: string
  text:        string
  // Contexte (post original si c'est un commentaire)
  postText?:   string
  postUrl?:    string
  receivedAt:  Date
  isRead:      boolean
}

export interface InboxPage {
  messages:   InboxMessage[]
  nextCursor: string | null
  total:      number
}
```

### 7.3 — Hook TanStack Query avec pagination infinie

```typescript
// modules/inbox/hooks/useInbox.ts
/**
 * @file useInbox.ts
 * @description Hook TanStack Query avec pagination infinie pour l'inbox.
 *   Charge 30 messages à la fois, en demande plus via "Charger plus".
 *
 * @example
 *   const { data, fetchNextPage, hasNextPage } = useInbox({ type: 'all' })
 */
import { useInfiniteQuery } from '@tanstack/react-query'
import type { InboxPage } from '@/modules/inbox/types'

interface UseInboxParams {
  type?:     'comments' | 'dms' | 'all'
  platform?: string
}

async function fetchInboxPage(
  params: UseInboxParams,
  cursor?: string
): Promise<InboxPage> {
  const query = new URLSearchParams()
  if (params.type)     query.set('type', params.type)
  if (params.platform) query.set('platform', params.platform)
  if (cursor)          query.set('cursor', cursor)

  const res = await fetch(`/api/inbox?${query}`)
  if (!res.ok) throw new Error('Erreur de chargement de l\'inbox')
  return res.json()
}

export const inboxQueryKeys = {
  all:  ['inbox'] as const,
  list: (params: UseInboxParams) => ['inbox', params] as const,
}

export function useInbox(params: UseInboxParams = {}) {
  return useInfiniteQuery({
    queryKey:     inboxQueryKeys.list(params),
    queryFn:      ({ pageParam }) => fetchInboxPage(params, pageParam as string),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    staleTime:    1000 * 60 * 2, // 2 min (inbox = contenu temps réel)
  })
}
```

### 7.4 — Composants inbox

**Layout inbox** (style email client) :
```
┌─────────────────────────────────────────────────────┐
│ Filtres : [Tout] [Commentaires] [DMs] [Plateforme▼] │
├─────────────────┬───────────────────────────────────┤
│ Liste messages  │ Détail du message sélectionné      │
│ (InboxList)     │                                    │
│                 │  @auteur · instagram · il y a 2h   │
│ ○ @alice        │                                    │
│   "Super post!" │  "Super post ! 🔥 Continue comme ça"│
│   instagram · 2h│                                    │
│                 │  [Contexte : post original]        │
│ ○ @bob          │                                    │
│   "Merci pour…" │  ┌─────────────────────────┐      │
│   youtube · 5h  │  │ Répondre...             │      │
│                 │  └─────────────────────────┘      │
│ [Charger plus]  │                                    │
└─────────────────┴───────────────────────────────────┘
```

**Fichiers à créer :**
```
modules/inbox/components/
├── InboxLayout.tsx        ← split view (liste + détail)
├── InboxList.tsx          ← liste des messages avec pagination infinie
├── InboxListItem.tsx      ← item de la liste (avatar, texte tronqué, badge plateforme)
├── InboxListItemSkeleton.tsx  ← skeleton de l'item
├── InboxDetail.tsx        ← détail du message sélectionné
├── InboxDetailSkeleton.tsx
└── InboxFilters.tsx       ← tabs Tout / Commentaires / DMs + filtre plateforme
```

### 7.5 — Store Zustand sélection de message

```typescript
// modules/inbox/store/inbox.store.ts
/**
 * @file inbox.store.ts
 * @description Store Zustand pour le message sélectionné dans l'inbox
 *   et les filtres actifs.
 */
import { create } from 'zustand'
import type { MessageType } from '@/modules/inbox/types'

interface InboxStore {
  selectedMessageId: string | null
  activeType:        MessageType | 'all'
  activePlatform:    string | null
  setSelectedMessage: (id: string | null) => void
  setActiveType:      (type: MessageType | 'all') => void
  setActivePlatform:  (platform: string | null) => void
}

export const useInboxStore = create<InboxStore>()((set) => ({
  selectedMessageId: null,
  activeType:        'all',
  activePlatform:    null,
  setSelectedMessage: (id) => set({ selectedMessageId: id }),
  setActiveType:      (type) => set({ activeType: type }),
  setActivePlatform:  (platform) => set({ activePlatform: platform }),
}))
```

### 7.6 — Page inbox avec skeletons

```typescript
// app/(dashboard)/inbox/page.tsx
// app/(dashboard)/inbox/loading.tsx
```

Le `loading.tsx` reproduit :
- Barre de filtres : 3 tabs skeleton + 1 select skeleton
- Colonne gauche : 5 `<InboxListItemSkeleton>` empilés
- Colonne droite : blocs skeleton de la zone de détail

---

## Tests

```typescript
// tests/unit/modules/inbox/inbox.types.test.ts
describe('InboxMessage', () => {
  it('filtre les messages par type', () => { ... })
})
```

---

## Vérification / Critères de succès

- [ ] Page `/inbox` affiche les messages de toutes les plateformes connectées
- [ ] Filtre "Commentaires" / "DMs" fonctionne
- [ ] Clic sur un message → détail affiché dans la colonne droite
- [ ] "Charger plus" → page suivante chargée (pagination infinie)
- [ ] Skeleton reproduit fidèlement le split view
- [ ] Responsive : sur mobile, liste et détail s'alternent (pas de split view)

---

## Passage à la phase suivante

Une fois cette phase validée → lire `08-notifications.md`.
