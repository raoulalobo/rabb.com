# Plan : Galerie Media

## Contexte

Les utilisateurs uploadent actuellement des médias (images, vidéos) directement lors de
la création/modification d'un post via l'AgentModal. Ces fichiers sont stockés dans
Supabase Storage (bucket `post-media`, chemin `{userId}/{timestamp}-{filename}`) mais
**ne sont pas indexés en DB** — ils ne sont reliés qu'aux posts via `Post.mediaUrls[]`.

Ce plan crée un **espace galerie** permettant de :
1. Stocker et gérer des médias indépendamment des posts (upload, suppression)
2. Réutiliser ces médias lors de la création/modification d'un post via un `MediaPicker`

---

## 1. Prisma — Nouveau modèle `Media`

**Fichier** : `prisma/schema.prisma`

```prisma
model Media {
  id        String   @id @default(cuid())
  userId    String
  url       String                // URL publique Supabase Storage (permanente)
  filename  String                // Nom affiché dans la galerie
  mimeType  String                // "image/jpeg", "video/mp4", etc.
  size      Int                   // Taille en octets
  createdAt DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([userId, createdAt])
  @@map("media")
}
```

Ajouter dans `User` : `media Media[]`

**Migration manuelle** : `prisma/migrations/20260227010000_add-media/migration.sql`
(même approche que la migration signatures — DB peut être inaccessible en dev)

```sql
CREATE TABLE "media" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "media_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "media_userId_idx" ON "media"("userId");
CREATE INDEX "media_userId_createdAt_idx" ON "media"("userId", "createdAt" DESC);
ALTER TABLE "media" ADD CONSTRAINT "media_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

---

## 2. Module `modules/media/`

```
modules/media/
├── types.ts
├── schemas/
│   └── media.schema.ts
├── actions/
│   └── media.action.ts
└── components/
    ├── MediaGrid.tsx         ← Grille des fichiers uploadés (infinite scroll)
    ├── MediaCard.tsx         ← Carte d'un fichier (image/vidéo + actions)
    ├── MediaUploader.tsx     ← Zone drag-and-drop réutilisable
    └── MediaPicker.tsx       ← Dialog de sélection depuis la galerie
```

### 2.1 `types.ts`

```typescript
export interface MediaItem {
  id: string
  userId: string
  url: string
  filename: string
  mimeType: string
  size: number        // octets
  createdAt: Date
}
```

### 2.2 `media.schema.ts`

```typescript
export const MediaSaveSchema = z.object({
  url:      z.string().url(),
  filename: z.string().min(1).max(255),
  mimeType: z.string().regex(/^(image|video)\//),
  size:     z.number().int().positive().max(500 * 1024 * 1024),
})
```

### 2.3 `media.action.ts` — 3 Server Actions

**`listMedia(cursor?, limit?)`** — liste paginée (40 items, tri `createdAt DESC`)

**`saveMedia(rawData)`** — sauvegarde les métadonnées après upload Supabase
(appelée côté client une fois le PUT vers Supabase réussi)

**`deleteMedia(id)`** — ownership check + `supabase.storage.remove([path])` + `prisma.media.delete()`

Chaque action : `auth.api.getSession({ headers: await headers() })` + `revalidatePath('/gallery')`

Pour extraire le `path` Supabase depuis l'URL publique, on peut isoler le segment
après `/post-media/` dans l'URL publique stockée.

---

## 3. API Route `/api/gallery/upload-url`

**Fichier** : `app/api/gallery/upload-url/route.ts`

Identique à `app/api/posts/upload-url/route.ts` — réutilise `MediaUploadRequestSchema`
(de `modules/posts/schemas/post.schema.ts`) avec un chemin différent :

- Posts : `{userId}/{timestamp}-{filename}`
- **Galerie** : `{userId}/gallery/{timestamp}-{filename}`

Même bucket `post-media`. Retourne `{ signedUrl, publicUrl, path, mimeType }`.

L'enregistrement en DB se fait côté client via `saveMedia()` après le PUT réussi.

---

## 4. Page `/gallery`

### `app/(dashboard)/gallery/page.tsx` — Server Component

Charge les 40 premiers médias via `listMedia()`.
Passe les données à `<MediaGrid>` (Client Component).

### `app/(dashboard)/gallery/loading.tsx` — Skeleton

Grille 3×4 de rectangles pulsants (ratio 4:3).

---

## 5. Composants UI

### 5.1 `MediaGrid.tsx` — Client Component

- Props : `initialItems: MediaItem[]`, `initialNextCursor: string | null`
- Infinite scroll via `IntersectionObserver` sur un sentinel en bas de grille
- Charge les pages suivantes via `listMedia(cursor)`
- Bouton "Importer" → input file caché ou drag-and-drop
- Gère l'upload : `POST /api/gallery/upload-url` → PUT → `saveMedia()`

### 5.2 `MediaCard.tsx`

- **Image** : `<img>` `object-cover`, ratio 4:3
- **Vidéo** : fond gris + badge "Vidéo"
- Overlay au hover : nom de fichier tronqué, taille formatée, bouton 🗑️ (confirmation inline)

### 5.3 `MediaUploader.tsx` — Composant réutilisable

Zone drag-and-drop extraite de `AgentModalCreate` (même pattern anti-faux-dragLeave).
Props : `onFilesSelected: (files: File[]) => void`, `disabled?: boolean`.
Utilisé à la fois dans `MediaGrid` et dans `MediaPicker`.

### 5.4 `MediaPicker.tsx` — Dialog de sélection

```typescript
interface MediaPickerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedUrls: string[]                     // pour pré-cocher les déjà sélectionnés
  onConfirm: (urls: string[]) => void
}
```

- Charge la galerie via `listMedia()` au montage
- Cases à cocher sur chaque `MediaCard` (sélection multiple)
- Bouton "Importer ici" → upload inline → `saveMedia()` → réintègre à la grille du picker
- Bouton "Confirmer (N)" → `onConfirm(selectedUrls)`
- État vide : "Galerie vide — importez des fichiers"

---

## 6. Intégration dans l'AgentModal

### `AgentModalCreate.tsx` et `AgentModalEdit.tsx`

Dans la section "Médias", ajouter un bouton **"Galerie"** à côté de "Ajouter" :

```tsx
<Button variant="outline" size="sm" onClick={() => setPickerOpen(true)}>
  <LayoutGrid className="size-3.5" /> Galerie
</Button>

<MediaPicker
  open={pickerOpen}
  onOpenChange={setPickerOpen}
  selectedUrls={mediaPool.map(m => m.url)}
  onConfirm={(urls) => {
    // Fusionner les nouvelles URLs avec le pool existant (sans doublons)
    const newItems = urls
      .filter(url => !mediaPool.some(m => m.url === url))
      .map(url => ({ url, type: isVideoUrl(url) ? 'video' : 'photo', filename: url.split('/').pop() ?? 'fichier' }))
    setMediaPool(prev => [...prev, ...newItems])
    setPickerOpen(false)
  }}
/>
```

`isVideoUrl` est déjà défini dans `AgentModalEdit.tsx` — à extraire dans un utilitaire
partagé `modules/posts/utils/media.utils.ts`.

---

## 7. Sidebar — Lien `/gallery`

**Fichier** : `components/layout/Sidebar.tsx`

Ajouter dans `NAV_ITEMS` entre "Composer" et "Signatures" :

```typescript
import { Images } from 'lucide-react'
{ label: 'Galerie', href: '/gallery', icon: Images },
```

---

## 8. Fichiers impactés (résumé)

| Fichier | Action |
|---|---|
| `prisma/schema.prisma` | MODIFIER — modèle `Media` + `User.media` |
| `prisma/migrations/20260227010000_add-media/migration.sql` | CRÉER |
| `modules/media/types.ts` | CRÉER |
| `modules/media/schemas/media.schema.ts` | CRÉER |
| `modules/media/actions/media.action.ts` | CRÉER |
| `modules/media/components/MediaGrid.tsx` | CRÉER |
| `modules/media/components/MediaCard.tsx` | CRÉER |
| `modules/media/components/MediaUploader.tsx` | CRÉER |
| `modules/media/components/MediaPicker.tsx` | CRÉER |
| `app/api/gallery/upload-url/route.ts` | CRÉER |
| `app/(dashboard)/gallery/page.tsx` | CRÉER |
| `app/(dashboard)/gallery/loading.tsx` | CRÉER |
| `components/layout/Sidebar.tsx` | MODIFIER |
| `modules/posts/components/AgentModal/AgentModalCreate.tsx` | MODIFIER — bouton + MediaPicker |
| `modules/posts/components/AgentModal/AgentModalEdit.tsx` | MODIFIER — bouton + MediaPicker |
| `modules/posts/utils/media.utils.ts` | CRÉER — `isVideoUrl()` partagé |

---

## 9. Éditeur d'image — Filerobot Image Editor

**Package** : `react-filerobot-image-editor`

### 9.1 Composant partagé `ImageEditorDialog.tsx`

**Fichier** : `modules/media/components/ImageEditorDialog.tsx`

Composant Client (`'use client'`) avec chargement dynamique (`ssr: false`) pour éviter
les erreurs Canvas en Node.js :

```typescript
import dynamic from 'next/dynamic'

const FilerobotImageEditor = dynamic(
  () => import('react-filerobot-image-editor'),
  { ssr: false, loading: () => <div className="...skeleton..." /> }
)

interface ImageEditorDialogProps {
  sourceUrl: string                    // URL Supabase de l'image originale
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Appelé avec la nouvelle URL Supabase après re-upload de l'image éditée */
  onSave: (newUrl: string) => void
}
```

**Flux interne `onSave`** :
1. Récupère `editedImageObject.imageBase64` depuis Filerobot
2. Convertit en `Blob` (`fetch(base64).then(r => r.blob())`)
3. POST `/api/gallery/upload-url` → `{ signedUrl, publicUrl }`
4. PUT `blob` vers `signedUrl` (même pattern XHR que AgentModal)
5. Si vient de la galerie → appelle `saveMedia()` pour mettre à jour l'entrée DB
6. Appelle `onSave(publicUrl)` → le parent remplace l'ancienne URL

### 9.2 Intégration point 1 — `MediaCard.tsx` (galerie)

Dans l'overlay hover de chaque `MediaCard`, ajouter un bouton ✏️ à côté du 🗑️ :

```tsx
{/* Bouton éditer — images seulement (pas vidéo) */}
{!isVideo && (
  <button onClick={() => setEditorOpen(true)} ...>
    <Pencil className="size-3.5" />
  </button>
)}

<ImageEditorDialog
  sourceUrl={item.url}
  open={editorOpen}
  onOpenChange={setEditorOpen}
  onSave={async (newUrl) => {
    // Met à jour l'entrée DB (nouvelle URL) + revalide la galerie
    await saveMedia({ url: newUrl, filename: item.filename, mimeType: item.mimeType, size: item.size })
    onMediaUpdated(newUrl)   // callback vers MediaGrid pour rafraîchir
    setEditorOpen(false)
  }}
/>
```

### 9.3 Intégration point 2 — `AgentModalCreate.tsx`

Dans la grille des miniatures (`mediaPool.map`), ajouter ✏️ en haut à gauche
(le ✗ suppression reste en haut à droite) :

```tsx
{/* Bouton éditer — coin haut-gauche, images seulement */}
{media.type === 'photo' && (
  <button
    onClick={() => setEditingMedia(media)}
    className="absolute left-0.5 top-0.5 flex size-4 items-center justify-center
               rounded-full bg-black/60 text-white hover:bg-black/80"
  >
    <Pencil className="size-2.5" />
  </button>
)}

{/* Dialog partagé — une seule instance pour tout le pool */}
{editingMedia && (
  <ImageEditorDialog
    sourceUrl={editingMedia.url}
    open={!!editingMedia}
    onOpenChange={(open) => { if (!open) setEditingMedia(null) }}
    onSave={(newUrl) => {
      setMediaPool(prev => prev.map(m =>
        m.url === editingMedia.url ? { ...m, url: newUrl } : m
      ))
      setEditingMedia(null)
    }}
  />
)}
```

État supplémentaire : `const [editingMedia, setEditingMedia] = useState<PoolMedia | null>(null)`

### 9.4 Intégration point 3 — `AgentModalEdit.tsx`

Même pattern qu'`AgentModalCreate`. Le pool est initialisé depuis `post.mediaUrls` —
l'URL éditée remplace l'ancienne dans le pool, et sera transmise à l'API lors de la
mise à jour du post.

### 9.5 Fichier supplémentaire impacté

| Fichier | Action |
|---|---|
| `modules/media/components/ImageEditorDialog.tsx` | CRÉER |
| `modules/posts/components/AgentModal/AgentModalCreate.tsx` | MODIFIER — état `editingMedia` + `ImageEditorDialog` |
| `modules/posts/components/AgentModal/AgentModalEdit.tsx` | MODIFIER — état `editingMedia` + `ImageEditorDialog` |
| `modules/media/components/MediaCard.tsx` | MODIFIER (intégré dès la création) |

---

## 10. Points clés

- **Pas de nouveau bucket Supabase** : même bucket `post-media`, chemin `{userId}/gallery/…`
- **Suppression physique** : `deleteMedia` efface Storage ET DB en une action
- **Pas de doublons** : fusion URL-aware dans `onConfirm`
- **Réutilisation** : `MediaUploadRequestSchema` existant, `isVideoUrl` extrait en utilitaire
- **Infinite scroll** : `IntersectionObserver` + `listMedia(cursor)`, 40 items/page
- **Filerobot** : `dynamic import { ssr: false }` — chargé uniquement côté client au clic ✏️
- **Éditeur — images seulement** : bouton ✏️ masqué sur les vidéos (`media.type === 'video'`)

---

## 11. Branche Git

Créer et travailler sur : `git checkout -b feature/gallery`

---

## 12. Vérification end-to-end

1. `pnpm prisma migrate deploy` → migration `add-media` appliquée sans erreur
2. `pnpm tsc --noEmit` → 0 erreur TypeScript
3. Sidebar → lien "Galerie" visible entre Composer et Signatures
4. Page `/gallery` vide → zone de dépôt visible
5. Importer une image → apparaît dans la grille, entrée DB créée
6. Importer une vidéo → badge "Vidéo" visible, pas de bouton ✏️
7. Survoler une image → overlay avec ✏️ éditer + 🗑️ supprimer
8. Cliquer ✏️ → Filerobot s'ouvre avec l'image source
9. Modifier (recadrer, filtrer) → "Sauvegarder" → nouvelle URL dans la galerie
10. Supprimer → fichier retiré de la grille ET du Storage Supabase
11. "+ Nouveau post" → AgentModal → bouton "Galerie" visible
12. MediaPicker s'ouvre → images de la galerie visibles avec cases à cocher
13. Sélectionner 2 images → "Confirmer" → ajoutées au pool
14. Dans le pool (AgentModal) → bouton ✏️ sur chaque image → Filerobot s'ouvre
15. Modifier → nouvelle URL remplace l'ancienne dans le pool
16. Générer → post créé avec les URLs dans `mediaUrls`
17. "Modifier" un post → même flow Galerie + éditeur
