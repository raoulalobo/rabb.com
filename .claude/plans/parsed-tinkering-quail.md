# Plan : Vue Kanban `/kanban`

## Contexte

ogolong.com a besoin d'une vue "pipeline de publication" complémentaire au calendrier.
Le calendrier répond à **"quand ?"** — le Kanban répond à **"où en est mon contenu ?"**.

Les 4 statuts de posts (`DRAFT`, `SCHEDULED`, `PUBLISHED`, `FAILED`) mappent naturellement sur 4 colonnes. Les cartes sont draggables entre colonnes pour changer de statut, et cliquables pour ouvrir l'édition via `AgentModal`.

**Résultat attendu :**
- Nouvelle page `/kanban` avec 4 colonnes : Brouillon | Planifié | Publié | Échoué
- Drag & drop des cartes entre colonnes → change le `status` du post (optimistic update)
- Clic sur une carte → ouvre `AgentModal` en mode édition
- Bouton "Nouveau post" dans l'en-tête → ouvre `AgentModal` en mode création
- Colonne `PUBLISHED` : lecture seule (aucun drag in/out)
- Lien "Kanban" ajouté dans la Sidebar

---

## Règles drag & drop

| Depuis → Vers | Autorisé ? | Effet |
|---|---|---|
| DRAFT → SCHEDULED | ✅ | `status = 'SCHEDULED'` (scheduledFor inchangé) |
| SCHEDULED → DRAFT | ✅ | `status = 'DRAFT'`, `scheduledFor = null` |
| FAILED → DRAFT | ✅ | `status = 'DRAFT'` (retry) |
| * → PUBLISHED | ❌ | Colonne lecture seule |
| PUBLISHED → * | ❌ | Colonne lecture seule |
| Intra-colonne | ❌ | Pas de réordonnancement (order par date) |

---

## Architecture

```
app/(dashboard)/kanban/page.tsx   (Server Component — auth + metadata)
  └── KanbanBoard                 (Client Component — DnD root)
        ├── En-tête : titre + compteurs + bouton "Nouveau post"
        ├── AgentModal (create ou edit, géré ici)
        └── 4 × KanbanColumn      (droppable)
              └── N × KanbanCard  (draggable)
```

**Data flow :**
- `useKanbanPosts()` → un seul `useQuery` → fetch tous les posts → groupé par statut client-side
- Drag end → `updatePostStatus(postId, newStatus)` → invalidation `postQueryKeys.kanban()`

---

## Packages à installer

```bash
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

---

## Fichiers à créer / modifier

### 1. `app/(dashboard)/kanban/page.tsx` — CRÉER

Server Component. Auth + metadata uniquement.

```tsx
import type { Metadata } from 'next'
import { KanbanBoard } from '@/modules/posts/components/Kanban/KanbanBoard'

export const metadata: Metadata = {
  title: 'Kanban — ogolong',
  description: 'Gérez vos posts par statut en vue Kanban.',
}

export default function KanbanPage(): React.JSX.Element {
  return <KanbanBoard />
}
```

### 2. `app/(dashboard)/kanban/loading.tsx` — CRÉER

Skeleton : 4 colonnes avec ~3 cartes skeleton chacune.

### 3. `modules/posts/queries/posts.queries.ts` — MODIFIER

Ajouter la query key Kanban :
```typescript
export const postQueryKeys = {
  // ... existants
  kanban: () => ['posts', 'kanban'] as const,
}
```

Ajouter le fetcher :
```typescript
// Fetch tous les posts sans pagination (limite haute = 200)
// Réutilise la route API GET /api/posts?compose=1&statuses=DRAFT,SCHEDULED,PUBLISHED,FAILED&limit=200
export async function fetchKanbanPosts(): Promise<Post[]>
```

### 4. `modules/posts/hooks/useKanbanPosts.ts` — CRÉER

```typescript
// Retourne les posts groupés par statut
export function useKanbanPosts(): {
  byStatus: Record<Post['status'], Post[]>
  isLoading: boolean
  error: Error | null
}
```

### 5. `modules/posts/actions/update-post-status.action.ts` — CRÉER

Server Action pour la mutation Kanban :
```typescript
// Mutation partielle : status + scheduledFor si SCHEDULED → DRAFT
export async function updatePostStatus(
  postId: string,
  newStatus: Post['status']
): Promise<{ success: boolean; post?: Post; error?: string }>
```

Règles :
- SCHEDULED → DRAFT : met aussi `scheduledFor = null` + annule l'event Inngest
- DRAFT → SCHEDULED : met `status = 'SCHEDULED'` (scheduledFor déjà présent ou null)
- FAILED → DRAFT : remet `status = 'DRAFT'`
- Interdit vers PUBLISHED (retourne une erreur)

### 6. `modules/posts/components/Kanban/KanbanBoard.tsx` — CRÉER

Client Component principal. Gère :
- `DndContext` de @dnd-kit/core (root du drag & drop)
- État des modales (create/edit)
- Optimistic update via `useQueryClient`

```typescript
// État interne
const [modalOpen, setModalOpen] = useState(false)
const [modalMode, setModalMode] = useState<'create' | 'edit'>('create')
const [selectedPost, setSelectedPost] = useState<Post | null>(null)

// Invalidation après mutation
void queryClient.invalidateQueries({ queryKey: postQueryKeys.kanban() })

// Handler drop
function handleDragEnd(event: DragEndEvent): void {
  // 1. Identifier post source et colonne cible
  // 2. Vérifier règles (PUBLISHED bloqué)
  // 3. Optimistic update locale
  // 4. Appeler updatePostStatus()
  // 5. Rollback si erreur
}
```

### 7. `modules/posts/components/Kanban/KanbanColumn.tsx` — CRÉER

Composant droppable (useDroppable de @dnd-kit/core) :

```tsx
// Props
interface KanbanColumnProps {
  status: Post['status']
  posts: Post[]
  isReadOnly?: boolean        // true pour PUBLISHED
  onEditPost: (post: Post) => void
}

// Structure
<div droppable data-status={status}>
  {/* En-tête colonne : label + badge compteur colorisé par status */}
  <KanbanColumnHeader status={status} count={posts.length} />
  {/* Cartes */}
  {posts.map(post => <KanbanCard key={post.id} post={post} onEdit={onEditPost} />)}
  {/* Zone drop vide */}
  {posts.length === 0 && <KanbanEmptyState status={status} />}
</div>
```

Styles en-tête par statut (réutilise `STATUS_BADGE_CLASSES` de `status-styles.ts`) :
- DRAFT : gris
- SCHEDULED : bleu
- PUBLISHED : vert
- FAILED : rouge

### 8. `modules/posts/components/Kanban/KanbanCard.tsx` — CRÉER

Composant draggable (useDraggable de @dnd-kit/core).
Inspiré de `PostComposeCard` (même structure), adapté pour Kanban :

```typescript
interface KanbanCardProps {
  post: Post
  onEdit: (post: Post) => void
  isDraggable?: boolean   // false pour PUBLISHED
}
```

Contenu :
- Icône plateforme + heure planifiée
- Texte tronqué (2 lignes)
- Vignettes médias (si présentes, max 2)
- Badge statut
- Bouton "Modifier" (→ `onEdit(post)`)

### 9. `modules/posts/components/Kanban/KanbanSkeleton.tsx` — CRÉER

4 colonnes skeleton, 3 cartes skeleton par colonne.
Utilisé par `loading.tsx`.

### 10. `components/layout/Sidebar.tsx` — MODIFIER

Ajouter le lien Kanban après "Calendrier" :
```typescript
{ label: 'Kanban', href: '/kanban', icon: KanbanSquare }
```
`KanbanSquare` importé depuis lucide-react.

---

## Détails techniques drag & drop

**Librairie :** `@dnd-kit/core` (compatible React 19 / Next.js 15 App Router, sans accès au DOM natif — contrairement à react-beautiful-dnd).

**Pattern :**
```
DndContext (KanbanBoard)
  └── useDroppable (KanbanColumn)  — identifié par: data.status
        └── useDraggable (KanbanCard) — identifié par: data.postId + data.currentStatus
```

**Détection colonne cible :**
```typescript
const over = event.over   // KanbanColumn
const active = event.active  // KanbanCard
const targetStatus = over?.data.current?.status as Post['status']
const sourceStatus = active.data.current?.currentStatus as Post['status']
```

**Optimistic update :**
```typescript
// Snapshot avant mutation
const previous = queryClient.getQueryData(postQueryKeys.kanban())
// Mise à jour locale immédiate
queryClient.setQueryData(postQueryKeys.kanban(), (old) => ...)
// Rollback si erreur
queryClient.setQueryData(postQueryKeys.kanban(), previous)
```

---

## Résumé des changements

| Fichier | Action |
|---|---|
| `app/(dashboard)/kanban/page.tsx` | CRÉER — Server Component, metadata |
| `app/(dashboard)/kanban/loading.tsx` | CRÉER — Skeleton 4 colonnes |
| `modules/posts/queries/posts.queries.ts` | MODIFIER — ajout `kanban()` + `fetchKanbanPosts` |
| `modules/posts/hooks/useKanbanPosts.ts` | CRÉER — hook groupé par statut |
| `modules/posts/actions/update-post-status.action.ts` | CRÉER — Server Action mutation statut |
| `modules/posts/components/Kanban/KanbanBoard.tsx` | CRÉER — DndContext + modales |
| `modules/posts/components/Kanban/KanbanColumn.tsx` | CRÉER — colonne droppable |
| `modules/posts/components/Kanban/KanbanCard.tsx` | CRÉER — carte draggable |
| `modules/posts/components/Kanban/KanbanSkeleton.tsx` | CRÉER — skeleton |
| `components/layout/Sidebar.tsx` | MODIFIER — ajouter lien /kanban |

**Réutilisés sans modification :**
- `AgentModal` — props identiques (create/edit)
- `STATUS_BADGE_CLASSES`, `STATUS_LABELS` — `modules/posts/utils/status-styles.ts`
- `PLATFORM_CONFIG` — `modules/platforms/constants`
- `postQueryKeys.kanban()` — via `posts.queries.ts` (ajout)
- `savePost` / `deletePost` — `modules/posts/actions/save-post.action.ts`

---

## Vérification

1. `npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities` → pas d'erreur
2. `npx tsc --noEmit` → 0 erreur TypeScript
3. `/kanban` charge avec 4 colonnes + skeleton pendant le fetch
4. Les posts apparaissent dans la bonne colonne selon leur statut
5. Glisser un DRAFT vers SCHEDULED → statut change, carte bouge, UI se rafraîchit
6. Glisser SCHEDULED → DRAFT → statut change + scheduledFor = null
7. Glisser FAILED → DRAFT → carte bouge en colonne Brouillon
8. Colonne PUBLISHED : les cartes ne sont pas draggables (curseur normal)
9. Clic sur une carte → AgentModal en mode édition s'ouvre avec les données du post
10. Bouton "Nouveau post" → AgentModal en mode création
11. Après création/édition → invalidation `kanban` → colonnes rafraîchies
12. Sidebar : lien "Kanban" visible et actif sur `/kanban`
