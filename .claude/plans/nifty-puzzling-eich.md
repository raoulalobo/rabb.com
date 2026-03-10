# Plan : Gestion des médias dans le Bulk Edit

## Contexte

Le Bulk Edit actuel n'inclut aucune gestion des médias :
- Phase 1 : seuls `postIds` + `instruction` sont envoyés à l'agent
- Phase 2 (preview) : seuls les changements de texte et de date sont affichés
- L'agent peut modifier `mediaUrls` dans ses propositions mais l'utilisateur ne les voit pas et ne peut pas les corriger

**Besoin validé** (les deux approches combinées) :
1. **Phase 1** : pool de médias partagé (upload ou galerie), optionnel, transmis à Claude
2. **Phase 2** : affichage avant/après des médias + édition par post (supprimer ✕, ajouter + depuis pool)

---

## Architecture — 3 fichiers modifiés

```
modules/posts/schemas/post.schema.ts                         ← Ajouter mediaPool à BulkEditBatchSchema
app/api/agent/edit-posts-batch/route.ts                      ← Accepter + passer mediaPool à Claude
modules/posts/components/AgentModal/AgentModalBulkEdit.tsx   ← UI phase 1 pool + phase 2 per-post
```

---

## Fichier 1 — `modules/posts/schemas/post.schema.ts`

Ajouter `PoolMediaSchema` (identique à celui de `create-posts/route.ts`) et l'inclure dans `BulkEditBatchSchema` :

```typescript
const PoolMediaSchema = z.object({
  url: z.string().url(),
  type: z.enum(['photo', 'video']),
  filename: z.string(),
})

export const BulkEditBatchSchema = z.object({
  postIds: z.array(z.string().min(1)).min(1).max(50),
  instruction: z.string().min(1).max(2000),
  mediaPool: z.array(PoolMediaSchema).max(50).default([]),  // NOUVEAU
})
```

---

## Fichier 2 — `app/api/agent/edit-posts-batch/route.ts`

### 2a. Destructurer mediaPool depuis le body validé
```typescript
const { postIds, instruction, mediaPool } = parsed.data
```

### 2b. Ajouter une section dans le system prompt Claude

Après `postsSection`, ajouter :

```
## Nouveaux médias disponibles dans le pool partagé
${
  mediaPool.length === 0
    ? 'Aucun nouveau média fourni par l\'utilisateur.'
    : mediaPool.map((m, i) => `${i + 1}. ${m.url} (${m.filename}, type: ${m.type})`).join('\n')
}
Si l'instruction demande d'ajouter des médias à tout ou partie des posts, puise depuis ce pool.
Respecte les limites de chaque plateforme (maxPhotos, types autorisés).
```

Aucun autre changement dans la route (logique métier, tool, validation — identiques).

---

## Fichier 3 — `modules/posts/components/AgentModal/AgentModalBulkEdit.tsx`

### Imports à ajouter
```typescript
import { isVideoUrl } from '@/modules/posts/utils/media.utils'
import { MediaPicker } from '@/modules/media/components/MediaPicker'
import type { PoolMedia, UploadingFile } from '@/modules/posts/types'
// Icônes : Plus, ImageIcon (déjà probablement importé), X (déjà présent)
```

### Nouveau state

```typescript
// Phase 1 — pool de médias partagé (optionnel)
const [mediaPool, setMediaPool] = useState<PoolMedia[]>([])
const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([])
const [pickerOpen, setPickerOpen] = useState(false)
const [isDragging, setIsDragging] = useState(false)
const dragCounterRef = useRef(0)
```

### handleUploadFile

Copier exactement le pattern de `AgentModalEdit.tsx` :
1. Valide MIME (image/* ou video/*)
2. Ajoute à `uploadingFiles` avec `progress: 0`
3. Appelle `POST /api/posts/upload-url`
4. Upload direct (XHR PUT) vers `signedUrl`
5. Ajoute `publicUrl` au `mediaPool`
6. Nettoie `uploadingFiles`

### Mise à jour de handleGenerate (appel API phase 1)

```typescript
// AVANT
body: JSON.stringify({ postIds: posts.map((p) => p.id), instruction: instruction.trim() })

// APRÈS
body: JSON.stringify({ postIds: posts.map((p) => p.id), instruction: instruction.trim(), mediaPool })
```

---

### Phase 1 — Zone de médias (après le textarea, avant le bouton)

Section collapsible légère :

```
┌──────────────────────────────────────────────────────┐
│ 🖼 Médias à distribuer  (optionnel)     [+Upload] [Galerie] │
│                                                      │
│  [vignette1.jpg ✕] [video2.mp4 ✕]                  │
│  [uploadProgress: 45%]                              │
└──────────────────────────────────────────────────────┘
```

- Zone drag & drop (même `onDragEnter/Leave/Drop` que `AgentModalEdit`)
- Bouton "Ajouter" (`<input type="file" multiple accept="image/*,video/*">`)
- Bouton "Galerie" → ouvre `<MediaPicker>`
- Vignettes du pool avec bouton ✕ (supprimer du pool)
- Barre de progression pour les uploads en cours
- Pas de `ImageEditorDialog` (hors scope pour le bulk)

### Phase 2 — Médias dans les cartes preview

Dans chaque carte `ProposedEdit`, après le texte proposé, ajouter une section médias :

```
Avant  [🖼][🖼]         (grisés/semi-transparents, non interactifs)
Après  [🖼✕][🖼✕][+]   (interactifs)
```

**Structure** :
```tsx
{/* Ligne "Avant" : mediaUrls du post original (lecture seule) */}
{originalPost.mediaUrls.length > 0 && (
  <MediaRow label="Avant" urls={originalPost.mediaUrls} dimmed />
)}

{/* Ligne "Après" : mediaUrls proposés par l'IA, éditables */}
<MediaRow
  label="Après"
  urls={edit.mediaUrls}
  onRemove={(url) => handleRemoveMedia(edit.postId, url)}
  poolItems={mediaPool.filter(m => !edit.mediaUrls.includes(m.url))}
  onAddFromPool={(item) => handleAddMediaFromPool(edit.postId, item)}
/>
```

`MediaRow` est un petit composant inline (non exporté) dans `AgentModalBulkEdit.tsx`.

### Fonctions d'édition par post (phase 2)

```typescript
/** Retire une URL des médias proposés pour un post donné */
const handleRemoveMedia = (postId: string, url: string) => {
  setProposedEdits((prev) =>
    prev.map((e) =>
      e.postId === postId ? { ...e, mediaUrls: e.mediaUrls.filter((u) => u !== url) } : e,
    ),
  )
}

/** Ajoute un item du pool aux médias proposés pour un post donné */
const handleAddMediaFromPool = (postId: string, item: PoolMedia) => {
  setProposedEdits((prev) =>
    prev.map((e) =>
      e.postId === postId && !e.mediaUrls.includes(item.url)
        ? { ...e, mediaUrls: [...e.mediaUrls, item.url] }
        : e,
    ),
  )
}
```

Le bouton [+] dans la ligne "Après" est un `<Popover>` listant les items du pool non encore dans ce post.
Si le pool est vide, le bouton [+] est absent.

---

## Ce qui NE change pas

- `ProposedEdit` (Zod schema) : déjà `mediaUrls: z.array(z.string().url())` — aucune modif
- `bulk-apply-edits.action.ts` : reçoit les `ProposedEdit[]` finaux (avec mediaUrls modifiés) — aucune modif
- Phase 3 Success, catch blocks 529, rate limiting, Inngest : inchangés
- `AgentModalCreate.tsx` et `AgentModalEdit.tsx` : non touchés

---

## Vérification

1. **TypeScript** : `npx tsc --noEmit` → 0 erreur
2. **Phase 1 upload** : uploader une image → apparaît dans le pool → envoyée à la route
3. **Phase 1 galerie** : ouvrir MediaPicker → sélectionner → apparaît dans le pool
4. **Route batch** : vérifier que le prompt Claude contient bien la section "pool partagé"
5. **Phase 2 remove** : cliquer ✕ sur une vignette "Après" → disparaît du tableau `mediaUrls`
6. **Phase 2 add** : cliquer [+] → popover pool → cliquer un item → apparaît en vignette "Après"
7. **Apply** : après confirmation, les posts en DB ont bien les nouveaux `mediaUrls`
