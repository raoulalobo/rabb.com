# Phase 04 — Éditeur de post (PostComposer)

> **Skills à activer** : `vercel-composition-patterns`, `frontend-design`, `vercel-react-best-practices`, `web-design-guidelines`
> **Prérequis** : Phase 03 complétée (plateformes connectées disponibles)

---

## Objectif

Construire l'éditeur de post central de rabb :
- Rédaction de texte multi-plateformes (avec compteur de caractères par réseau)
- Upload de médias (images/vidéos) vers Supabase Storage
- Sélection des plateformes de publication
- Sauvegarde de brouillons (Zustand + DB)
- Planification (date/heure)
- Aperçu du post par plateforme

---

## Architecture du composant (Compound Component Pattern)

```
PostComposer                    ← racine, fournit le contexte
├── PostComposer.Editor         ← textarea + compteur caractères
├── PostComposer.MediaUpload    ← drag & drop + prévisualisation médias
├── PostComposer.Platforms      ← sélection plateformes connectées
├── PostComposer.Schedule       ← DateTimePicker pour planification
├── PostComposer.Preview        ← aperçu rendu par plateforme
└── PostComposer.Footer         ← boutons Brouillon / Planifier / Publier
```

---

## Étapes

### 4.1 — Schéma Zod du post

```typescript
// modules/posts/schemas/post.schema.ts
/**
 * @file post.schema.ts
 * @description Schémas Zod pour la création et mise à jour de posts.
 *   Ces schémas sont utilisés côté client (validation en temps réel)
 *   ET côté serveur (Server Action).
 */
import { z } from 'zod'
import { PlatformEnum } from '@/modules/platforms/schemas/platform.schema'

// Limites de caractères par plateforme
export const PLATFORM_CHAR_LIMITS: Record<string, number> = {
  instagram: 2200,
  tiktok:    2200,
  youtube:   5000,
  facebook:  63206,
  twitter:   280,
  linkedin:  3000,
  bluesky:   300,
  threads:   500,
}

export const PostCreateSchema = z.object({
  text:        z.string().min(1, 'Le texte est requis').max(5000),
  platforms:   z.array(PlatformEnum).min(1, 'Sélectionne au moins une plateforme'),
  mediaUrls:   z.array(z.string().url()).max(10).optional().default([]),
  scheduledFor: z.date()
    .min(new Date(), 'La date doit être dans le futur')
    .optional(),
  status:      z.enum(['DRAFT', 'SCHEDULED']).default('DRAFT'),
})
export type PostCreate = z.infer<typeof PostCreateSchema>

export const PostUpdateSchema = PostCreateSchema.partial().extend({
  id: z.string(),
})
export type PostUpdate = z.infer<typeof PostUpdateSchema>
```

### 4.2 — Store Zustand du brouillon

```typescript
// modules/posts/store/draft.store.ts
/**
 * @file draft.store.ts
 * @description Store Zustand + Immer pour le brouillon en cours de rédaction.
 *   Mis à jour en temps réel lors de la saisie. Persiste le brouillon en
 *   sessionStorage pour éviter la perte lors d'un rafraîchissement.
 *
 * @example
 *   const { text, setText } = useDraftStore()
 *   setText('Mon nouveau post')
 */
import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { Platform } from '@/modules/platforms/schemas/platform.schema'

interface DraftStore {
  // Contenu du brouillon
  text: string
  platforms: Platform[]
  mediaUrls: string[]
  scheduledFor: Date | null
  postId: string | null  // null si nouveau post

  // Actions (mutations directes grâce à Immer)
  setText:         (text: string) => void
  setPlatforms:    (platforms: Platform[]) => void
  togglePlatform:  (platform: Platform) => void
  addMediaUrl:     (url: string) => void
  removeMediaUrl:  (url: string) => void
  setScheduledFor: (date: Date | null) => void
  setPostId:       (id: string | null) => void
  reset:           () => void
}

const initialState = {
  text: '',
  platforms: [],
  mediaUrls: [],
  scheduledFor: null,
  postId: null,
}

export const useDraftStore = create<DraftStore>()(
  persist(
    immer((set) => ({
      ...initialState,

      setText: (text) => set((state) => { state.text = text }),

      setPlatforms: (platforms) => set((state) => { state.platforms = platforms }),

      // Ajoute ou retire une plateforme du sélecteur
      togglePlatform: (platform) => set((state) => {
        const idx = state.platforms.indexOf(platform)
        if (idx === -1) state.platforms.push(platform)
        else state.platforms.splice(idx, 1)
      }),

      addMediaUrl: (url) => set((state) => { state.mediaUrls.push(url) }),

      removeMediaUrl: (url) => set((state) => {
        state.mediaUrls = state.mediaUrls.filter((u) => u !== url)
      }),

      setScheduledFor: (date) => set((state) => { state.scheduledFor = date }),

      setPostId: (id) => set((state) => { state.postId = id }),

      // Remet le store à l'état initial après publication
      reset: () => set(() => initialState),
    })),
    {
      name: 'rabb-draft',
      storage: createJSONStorage(() => sessionStorage),
    }
  )
)
```

### 4.3 — Upload média vers Supabase Storage

```typescript
// app/api/posts/upload-url/route.ts
/**
 * @file route.ts
 * @description Génère un presigned URL pour upload direct vers Supabase Storage.
 *   L'upload se fait depuis le browser → Supabase (pas via le serveur Next.js).
 *   Sécurité : vérifie la session avant de générer l'URL.
 *
 * Flux :
 *   1. Client demande un presigned URL (avec nom de fichier + type MIME)
 *   2. Server génère l'URL signée (valide 60s)
 *   3. Client uploade directement vers Supabase Storage
 *   4. Client récupère l'URL publique et la stocke dans draftStore
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { z } from 'zod'

const UploadRequestSchema = z.object({
  filename: z.string().min(1),
  mimeType: z.string().regex(/^(image|video)\//),
  size: z.number().max(500 * 1024 * 1024), // 500 MB max
})

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const body = await request.json()
  const { filename, mimeType, size } = UploadRequestSchema.parse(body)

  const supabase = await createClient()

  // Chemin : userId/timestamp-filename pour éviter les collisions
  const path = `${session.user.id}/${Date.now()}-${filename}`

  const { data, error } = await supabase.storage
    .from('post-media')
    .createSignedUploadUrl(path)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const publicUrl = supabase.storage.from('post-media').getPublicUrl(path).data.publicUrl

  return NextResponse.json({ signedUrl: data.signedUrl, publicUrl, path })
}
```

### 4.4 — Server Action : créer/mettre à jour un post

```typescript
// modules/posts/actions/save-post.action.ts
/**
 * @file save-post.action.ts
 * @description Server Action : sauvegarde un post (nouveau ou existant).
 *   Valide avec Zod, vérifie la session, persiste en DB.
 *   Ne déclenche PAS encore la publication (→ Phase 05).
 *
 * @param data - Données du post (PostCreateSchema)
 * @returns { post } - Post sauvegardé
 */
'use server'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PostCreateSchema, PostUpdateSchema } from '@/modules/posts/schemas/post.schema'
import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'

export async function savePost(data: unknown, postId?: string) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) throw new Error('Non authentifié')

  if (postId) {
    // Mise à jour d'un post existant
    const validated = PostUpdateSchema.parse({ ...data, id: postId })
    const post = await prisma.post.update({
      where: { id: postId, userId: session.user.id }, // ZenStack vérifie aussi
      data: {
        text:        validated.text,
        platforms:   validated.platforms ?? [],
        mediaUrls:   validated.mediaUrls ?? [],
        scheduledFor: validated.scheduledFor,
        status:      validated.status ?? 'DRAFT',
      },
    })
    revalidatePath('/calendar')
    return { post }
  }

  // Création d'un nouveau post
  const validated = PostCreateSchema.parse(data)
  const post = await prisma.post.create({
    data: {
      userId:      session.user.id,
      text:        validated.text,
      platforms:   validated.platforms,
      mediaUrls:   validated.mediaUrls ?? [],
      scheduledFor: validated.scheduledFor,
      status:      validated.status,
    },
  })
  revalidatePath('/calendar')
  return { post }
}
```

### 4.5 — Composant PostComposer (Compound Pattern)

```typescript
// modules/posts/components/PostComposer/index.tsx
// modules/posts/components/PostComposer/PostComposer.Editor.tsx
// modules/posts/components/PostComposer/PostComposer.MediaUpload.tsx
// modules/posts/components/PostComposer/PostComposer.Platforms.tsx
// modules/posts/components/PostComposer/PostComposer.Schedule.tsx
// modules/posts/components/PostComposer/PostComposer.Footer.tsx
// modules/posts/components/PostComposer/PostComposerSkeleton.tsx
```

Chaque sous-composant :
- Est un export nommé du module `PostComposer`
- Lit depuis `useDraftStore` (Zustand)
- Ne fait pas de fetch direct (délégué aux Server Actions ou TanStack Query)

### 4.6 — Page `/compose` avec skeleton

```typescript
// app/(dashboard)/compose/page.tsx
// app/(dashboard)/compose/loading.tsx  ← skeleton qui reproduit le layout de page.tsx
```

Le skeleton de `/compose` reproduit :
- Zone textarea (hauteur fixe)
- Barre d'outils (3-4 boutons rectangulaires)
- Ligne de sélection plateformes (4 badges ronds)
- Footer avec 3 boutons

---

## Tests

```typescript
// tests/unit/modules/posts/post.schema.test.ts
describe('PostCreateSchema', () => {
  it('valide un post minimal valide', () => { ... })
  it('rejette texte vide', () => { ... })
  it('rejette sans plateforme', () => { ... })
  it('rejette une date passée pour scheduledFor', () => { ... })
})

// tests/unit/modules/posts/draft.store.test.ts
describe('useDraftStore', () => {
  it('togglePlatform ajoute une plateforme absente', () => { ... })
  it('togglePlatform retire une plateforme présente', () => { ... })
  it('reset vide le store', () => { ... })
})
```

```bash
pnpm vitest run tests/unit/modules/posts
```

---

## Vérification / Critères de succès

- [ ] Page `/compose` affiche l'éditeur complet
- [ ] Texte mis à jour en temps réel dans draftStore
- [ ] Upload d'une image → URL publique affichée en prévisualisation
- [ ] Sélection plateformes → reflétée dans draftStore
- [ ] Bouton "Enregistrer brouillon" → post créé en DB avec status DRAFT
- [ ] Rechargement de page → brouillon restauré depuis sessionStorage
- [ ] Skeleton visible pendant le chargement de la page
- [ ] Compteur de caractères affiché selon la plateforme sélectionnée
- [ ] Tests unitaires passent

---

## Passage à la phase suivante

Une fois cette phase validée → lire `05-scheduling.md`.
