# Plan — Fix dictée vocale (Web Speech) + Fix Inngest (publishNow)

## Tâche 1 — Remplacer Whisper par Web Speech API dans AgentModal

### Contexte
`useVoiceRecorder.ts` enregistre l'audio puis appelle `POST /api/agent/transcribe`
(Whisper OpenAI) → nécessite `OPENAI_API_KEY`. `AIFilterModal.tsx` utilise déjà
la Web Speech API native (gratuit, instantané, 0 appel serveur) via `useSpeechRecognition`.
Il faut réutiliser ce hook dans l'AgentModal.

### Fichiers supprimés
| Fichier | Raison |
|---------|--------|
| `modules/posts/hooks/useVoiceRecorder.ts` | Remplacé par useSpeechRecognition |
| `app/api/agent/transcribe/route.ts` | Plus nécessaire |

### Fichiers créés
| Fichier | Contenu |
|---------|---------|
| `modules/posts/hooks/useSpeechRecognition.ts` | Hook extrait de AIFilterModal (identique) |

### Fichiers modifiés
| Fichier | Changement |
|---------|------------|
| `modules/posts/components/PostComposeList/AIFilterModal.tsx` | Importer depuis le hook partagé au lieu de définir en local |
| `modules/posts/components/AgentModal/AgentModalCreate.tsx` | `useVoiceRecorder` → `useSpeechRecognition` |
| `modules/posts/components/AgentModal/AgentModalEdit.tsx` | `useVoiceRecorder` → `useSpeechRecognition` |

### Adaptation de l'interface

`useVoiceRecorder` retourne `{ status: 'idle'|'recording'|'transcribing', startRecording, stopRecording }`
`useSpeechRecognition` retourne `{ isListening, startListening, stopListening, isSupported }`

Dans `AgentModalCreate.tsx` et `AgentModalEdit.tsx` :
```typescript
// AVANT :
const { status: micStatus, startRecording, stopRecording } = useVoiceRecorder({
  onTranscription: (text) => setInstruction((prev) => prev ? `${prev} ${text}` : text),
  onError: (msg) => setError(msg),
})
// micStatus === 'recording' pour l'état du bouton
// micStatus === 'transcribing' pour le spinner

// APRÈS :
const { isListening, startListening, stopListening, isSupported } = useSpeechRecognition({
  onResult: (text) => setInstruction((prev) => prev ? `${prev} ${text}` : text),
})
// isListening pour l'état du bouton (pas d'état 'transcribing' — Web Speech est instantané)
// !isSupported pour masquer le bouton micro si le navigateur ne le supporte pas
```

Le bouton micro dans AgentModal doit :
- Être masqué si `!isSupported`
- Toggle `startListening` / `stopListening` au clic
- Afficher l'icône `Mic` (idle) ou `MicOff` (actif, comme dans AIFilterModal)
- Supprimer le spinner "transcribing" (plus d'état intermédiaire avec Web Speech)

---

## Tâche 2 — Fix Inngest : publishNow au lieu de scheduledFor

### Contexte
La fonction Inngest `publish-scheduled-post.ts` appelle Late avec `scheduledFor`
dans le payload, délégant le timing à Late. Avec `publishNow: true`, Late publie
**immédiatement** quand Inngest le décide (après `step.sleepUntil`) et retourne
le résultat synchronement : statut PUBLISHED ou erreur connue immédiatement.

### Fichiers modifiés
| Fichier | Changement |
|---------|------------|
| `lib/inngest/functions/publish-scheduled-post.ts` | `scheduledFor` → `publishNow: true` + exploiter réponse complète |
| `lib/late.ts` | Enrichir `LatePost` avec `platforms[].status` et `platformPostUrl` |
| `prisma/schema.prisma` | Ajouter `platformPostUrl String?` sur Post |
| `modules/posts/types.ts` | Ajouter `platformPostUrl: string \| null` |

### Changement dans `publish-scheduled-post.ts`

```typescript
// AVANT :
const result = await late.posts.create({
  platforms: [...],
  content: post.text,
  scheduledFor: post.scheduledFor?.toISOString(), // Late gère le timing
  mediaItems: [...],
})

// APRÈS :
const result = await late.posts.create({
  platforms: [...],
  content: post.text,
  publishNow: true, // Inngest a déjà attendu via step.sleepUntil
  mediaItems: [...],
})

// Vérifier le statut par plateforme
const platformResult = result.platforms?.[0]
if (!platformResult || platformResult.status === 'failed') {
  throw new Error(`Late : publication échouée sur ${platformResult?.platform ?? 'plateforme inconnue'}`)
  // → Inngest catch → handlePostFailure → status FAILED + email Resend
}

// Mise à jour DB avec platformPostUrl (nouveau)
await prisma.post.update({
  where: { id: post.id },
  data: {
    status: 'PUBLISHED',
    latePostId: result._id,
    publishedAt: result.publishedAt ? new Date(result.publishedAt) : new Date(),
    platformPostUrl: platformResult.platformPostUrl ?? null,  // ← nouveau
  },
})
```

### Nouveaux types dans `lib/late.ts`

```typescript
interface LatePostPlatformResult {
  platform: string
  accountId: { _id: string; username: string; displayName: string; isActive: boolean }
  status: 'pending' | 'success' | 'failed'
  platformPostUrl?: string
}
// Ajouter platforms?: LatePostPlatformResult[] dans LatePost
```

### Migration Prisma

```prisma
model Post {
  // ...
  platformPostUrl String?  // URL du post publié sur la plateforme sociale
}
```
`pnpm prisma migrate dev --name add-platform-post-url`

---

## Ordre d'exécution

1. Créer `modules/posts/hooks/useSpeechRecognition.ts` (extrait d'AIFilterModal)
2. Mettre à jour `AIFilterModal.tsx` pour importer le hook
3. Mettre à jour `AgentModalCreate.tsx` + `AgentModalEdit.tsx`
4. Supprimer `useVoiceRecorder.ts` + `app/api/agent/transcribe/route.ts`
5. `lib/late.ts` → enrichir `LatePost`
6. `prisma/schema.prisma` + migration
7. `modules/posts/types.ts` → ajouter `platformPostUrl`
8. `lib/inngest/functions/publish-scheduled-post.ts` → `publishNow: true`

---

## Vérification

1. `pnpm tsc --noEmit` → 0 erreur
2. Dictée vocale dans AgentModal → fonctionne sans `OPENAI_API_KEY`
3. Bouton micro masqué sur Firefox (pas de Web Speech API)
4. `pnpm build` → 0 erreur
