# Plan : Contenu par plateforme dans le PostComposer

## Contexte

Chaque réseau social a des règles différentes pour les posts (photos max, types de médias, longueur texte).
La structure actuelle utilise un seul `text` et `mediaUrls[]` partagés pour toutes les plateformes sélectionnées.
L'objectif est d'ajouter des onglets par plateforme dans le PostComposer, permettant de personnaliser
le texte et les médias par canal, tout en conservant un contenu "base" commun.

---

## Choix d'architecture retenus

- **DB** : nouvelle table `PostPlatformContent` (requetable, relationnelle)
- **UX** : onglets par plateforme (onglet "Tous" = base + onglets spécifiques)
- **Override** : opt-in — une plateforme utilise la base sauf si l'utilisateur la personnalise
- **Inngest** : publication par plateforme avec fallback sur la base si pas d'override

---

## Phase 1 — Config des règles par plateforme (nouveau fichier)

### `modules/platforms/config/platform-rules.ts` (CRÉER)

```ts
export interface PlatformRules {
  maxPhotos: number       // 0 = photos interdites
  maxVideos: number       // 0 = vidéo interdite
  allowsMixed: boolean    // photos ET vidéo dans le même post
  maxText: number         // limite de caractères
  requiresMedia: boolean  // YouTube : vidéo obligatoire
  allowedMimeTypes: string[] // ex: ['image/*', 'video/mp4']
}

export const PLATFORM_RULES: Record<Platform, PlatformRules> = {
  instagram:       { maxPhotos: 10,  maxVideos: 1, allowsMixed: false, maxText: 2200,  requiresMedia: false, allowedMimeTypes: ['image/*', 'video/*'] },
  tiktok:          { maxPhotos: 35,  maxVideos: 1, allowsMixed: false, maxText: 2200,  requiresMedia: false, allowedMimeTypes: ['image/*', 'video/*'] },
  youtube:         { maxPhotos: 0,   maxVideos: 1, allowsMixed: false, maxText: 5000,  requiresMedia: true,  allowedMimeTypes: ['video/*'] },
  facebook:        { maxPhotos: 100, maxVideos: 1, allowsMixed: false, maxText: 63206, requiresMedia: false, allowedMimeTypes: ['image/*', 'video/*'] },
  twitter:         { maxPhotos: 4,   maxVideos: 1, allowsMixed: false, maxText: 280,   requiresMedia: false, allowedMimeTypes: ['image/*', 'video/*'] },
  linkedin:        { maxPhotos: 9,   maxVideos: 1, allowsMixed: false, maxText: 3000,  requiresMedia: false, allowedMimeTypes: ['image/*', 'video/*'] },
  bluesky:         { maxPhotos: 4,   maxVideos: 1, allowsMixed: false, maxText: 300,   requiresMedia: false, allowedMimeTypes: ['image/*', 'video/*'] },
  threads:         { maxPhotos: 10,  maxVideos: 1, allowsMixed: false, maxText: 500,   requiresMedia: false, allowedMimeTypes: ['image/*', 'video/*'] },
  reddit:          { maxPhotos: 20,  maxVideos: 1, allowsMixed: false, maxText: 40000, requiresMedia: false, allowedMimeTypes: ['image/*', 'video/*'] },
  pinterest:       { maxPhotos: 1,   maxVideos: 1, allowsMixed: false, maxText: 500,   requiresMedia: false, allowedMimeTypes: ['image/*', 'video/*'] },
  telegram:        { maxPhotos: 10,  maxVideos: 1, allowsMixed: true,  maxText: 4096,  requiresMedia: false, allowedMimeTypes: ['image/*', 'video/*'] },
  snapchat:        { maxPhotos: 1,   maxVideos: 1, allowsMixed: false, maxText: 250,   requiresMedia: false, allowedMimeTypes: ['image/*', 'video/*'] },
  google_business: { maxPhotos: 1,   maxVideos: 0, allowsMixed: false, maxText: 1500,  requiresMedia: false, allowedMimeTypes: ['image/*'] },
}
```

Également exporter :
- `getMaxMediaForPlatforms(platforms)` → nombre max de médias pour les plateformes sélectionnées
- `getPlatformViolations(platform, text, mediaUrls)` → liste de violations

---

## Phase 2 — Migration Prisma

### `prisma/schema.prisma` (MODIFIER)

Ajouter le modèle `PostPlatformContent` et l'enum `PostPlatformStatus` :

```prisma
enum PostPlatformStatus {
  PENDING
  PUBLISHED
  FAILED
}

model PostPlatformContent {
  id            String              @id @default(cuid())
  postId        String
  platform      String              // "instagram" | "tiktok" | ...
  text          String              // Contenu textuel spécifique à cette plateforme
  mediaUrls     String[]            @default([])
  status        PostPlatformStatus  @default(PENDING)
  latePostId    String?             // ID retourné par getlate.dev pour cette plateforme
  failureReason String?
  publishedAt   DateTime?
  createdAt     DateTime            @default(now())
  updatedAt     DateTime            @updatedAt

  post Post @relation(fields: [postId], references: [id], onDelete: Cascade)

  @@unique([postId, platform])
  @@index([postId])
  @@map("post_platform_contents")
}
```

Ajouter la relation inverse dans `Post` :
```prisma
model Post {
  // ... champs existants inchangés ...
  platformContents PostPlatformContent[]  // ← AJOUTER
}
```

Commande : `pnpm prisma migrate dev --name add-post-platform-content`

---

## Phase 3 — DraftStore Zustand

### `modules/posts/store/draft.store.ts` (MODIFIER)

Ajouter `platformOverrides` et `activePlatformTab` :

```ts
// Type d'un override de plateforme
export interface PlatformOverride {
  text: string
  mediaUrls: string[]
}

interface DraftStore {
  // ... champs existants inchangés ...

  // Overrides par plateforme (vide = utilise le contenu de base)
  platformOverrides: Partial<Record<Platform, PlatformOverride>>

  // Nouvelles actions
  setPlatformOverride: (platform: Platform, content: PlatformOverride) => void
  removePlatformOverride: (platform: Platform) => void
  clearAllPlatformOverrides: () => void
}
```

Implémenter avec Immer. Persister dans sessionStorage (la clé `'rabb-draft'` existante).

Également modifier `reset()` pour vider `platformOverrides`.

---

## Phase 4 — PostComposer (contexte + onglets)

### `modules/posts/components/PostComposer/context.tsx` (MODIFIER)

Ajouter au contexte :

```ts
interface PostComposerContextValue {
  // ... existant ...

  // Onglet actif (null = onglet "Tous")
  activePlatformTab: Platform | null
  setActivePlatformTab: (platform: Platform | null) => void

  // Contenu de l'onglet actif (base ou override selon l'onglet)
  activeText: string
  activeMediaUrls: string[]

  // Actions sur les overrides
  customizePlatform: (platform: Platform) => void     // Copie la base → crée l'override
  resetPlatform: (platform: Platform) => void          // Supprime l'override
  isPlatformCustomized: (platform: Platform) => boolean
}
```

### `modules/posts/components/PostComposer/index.tsx` (MODIFIER)

- Ajouter état local `activePlatformTab: Platform | null` (initialisé à `null`)
- Calculer `activeText` et `activeMediaUrls` :
  - Si `activePlatformTab === null` → base (`text`, `mediaUrls`)
  - Sinon → `platformOverrides[activePlatformTab]` s'il existe, sinon base
- Implémenter `customizePlatform` : copie base → `setPlatformOverride(platform, { text, mediaUrls })`
- Implémenter `resetPlatform` : appelle `removePlatformOverride(platform)`
- Passer tout au contexte

### `modules/posts/components/PostComposer/PlatformTabs.tsx` (CRÉER)

Composant affichant les onglets au-dessus de l'éditeur :

```
[ Tous ] [ 📷 Instagram ] [ 🎵 TikTok ✎ ] [ ▶ YouTube ]
```

- Onglet "Tous" = contenu de base, toujours présent
- Un onglet par plateforme sélectionnée (icône + nom)
- Badge `(✎)` si la plateforme est personnalisée
- Badge d'avertissement `(⚠)` si le contenu actif viole les règles de la plateforme

---

## Phase 5 — Editor + MediaUpload (contenus actifs)

### `modules/posts/components/PostComposer/Editor.tsx` (MODIFIER)

- Lire `activeText` depuis le contexte (au lieu de `text`)
- Écrire via `setText(value)` si onglet "Tous", `setPlatformOverride(tab, ...)` si onglet plateforme
- Limite de caractères : si onglet "Tous" → `getEffectiveCharLimit(platforms)` existant ; si onglet plateforme → `PLATFORM_RULES[tab].maxText`
- Afficher règles de la plateforme active sous l'éditeur (texte petit) : `"Max 2 200 caractères · Max 10 photos"`

### `modules/posts/components/PostComposer/MediaUpload.tsx` (MODIFIER)

- Lire `activeMediaUrls` depuis le contexte
- Écrire via les actions du store en fonction de l'onglet actif
- `maxFiles` : si onglet "Tous" → min des plateformes sélectionnées ; si onglet plateforme → `PLATFORM_RULES[tab].maxPhotos` (ou maxVideos si vidéo)

---

## Phase 6 — Server Action

### `modules/posts/actions/save-post.action.ts` (MODIFIER)

### `modules/posts/schemas/post.schema.ts` (MODIFIER)

Ajouter à `PostCreateSchema` :
```ts
platformOverrides: z.record(PlatformEnum, z.object({
  text: z.string().max(63206),
  mediaUrls: z.array(z.string().url()).max(35),
})).optional().default({}),
```

Dans `createPost()` et `updatePost()`, après la sauvegarde du `Post` :
```ts
// Upsert PostPlatformContent pour chaque plateforme
for (const platform of validated.platforms) {
  const content = validated.platformOverrides?.[platform]
  if (content) {
    await prisma.postPlatformContent.upsert({
      where: { postId_platform: { postId: post.id, platform } },
      create: { postId: post.id, platform, text: content.text, mediaUrls: content.mediaUrls },
      update: { text: content.text, mediaUrls: content.mediaUrls },
    })
  }
}
```

---

## Phase 7 — Inngest (publication par plateforme)

### `lib/inngest/functions/publish-scheduled-post.ts` (MODIFIER)

Remplacer l'appel unique getlate.dev par une boucle par plateforme :

```ts
// Pour chaque plateforme du post :
for (const platform of post.platforms) {
  // Chercher un override spécifique
  const platformContent = post.platformContents.find(pc => pc.platform === platform)
  const text = platformContent?.text ?? post.text
  const mediaUrls = platformContent?.mediaUrls ?? post.mediaUrls

  // Trouver la plateforme connectée (lateProfileId)
  const connectedPlatform = connectedPlatforms.find(cp => cp.platform === platform)
  if (!connectedPlatform) continue

  // Publier sur cette plateforme uniquement
  const latePost = await late.posts.create({
    text,
    profileIds: [connectedPlatform.lateProfileId],
    mediaUrls,
  })

  // Mettre à jour le statut PostPlatformContent
  await prisma.postPlatformContent.upsert({
    where: { postId_platform: { postId: post.id, platform } },
    create: { postId: post.id, platform, text, mediaUrls, status: 'PUBLISHED', latePostId: latePost.id, publishedAt: new Date() },
    update: { status: 'PUBLISHED', latePostId: latePost.id, publishedAt: new Date() },
  })
}

// Le Post global passe à PUBLISHED si toutes les plateformes sont OK
```

Inclure le `platformContents` dans la query Prisma du post (`.include({ platformContents: true })`).

---

## Fichiers impactés (résumé)

| Fichier | Action |
|---|---|
| `modules/platforms/config/platform-rules.ts` | CRÉER |
| `modules/posts/components/PostComposer/PlatformTabs.tsx` | CRÉER |
| `prisma/schema.prisma` | MODIFIER (+ `PostPlatformContent`) |
| `modules/posts/store/draft.store.ts` | MODIFIER (+ `platformOverrides`) |
| `modules/posts/components/PostComposer/context.tsx` | MODIFIER (+ onglet actif) |
| `modules/posts/components/PostComposer/index.tsx` | MODIFIER (+ logique onglets) |
| `modules/posts/components/PostComposer/Editor.tsx` | MODIFIER (contenu actif) |
| `modules/posts/components/PostComposer/MediaUpload.tsx` | MODIFIER (contenu actif) |
| `modules/posts/schemas/post.schema.ts` | MODIFIER (+ platformOverrides) |
| `modules/posts/actions/save-post.action.ts` | MODIFIER (+ upsert PlatformContent) |
| `lib/inngest/functions/publish-scheduled-post.ts` | MODIFIER (boucle par plateforme) |

---

## Vérification end-to-end

1. `pnpm prisma migrate dev` → migration sans erreur
2. `pnpm dev` → `/compose`
3. Sélectionner Instagram + TikTok → 2 onglets apparaissent
4. Onglet "Tous" : taper texte commun, uploader 5 photos
5. Onglet "Instagram" : cliquer "Personnaliser" → contenu copié depuis base
6. Modifier le texte Instagram → badge `(✎)` apparaît sur l'onglet
7. Onglet "TikTok" → sans override → affiche le contenu de base
8. Cliquer "Planifier" → vérifier en DB : `Post` + 1 `PostPlatformContent` (instagram uniquement)
9. `pnpm tsc --noEmit` → aucune erreur TypeScript
