# Plan : Suppression des 4 features /compose (sans valeur ajoutée)

## Contexte

Après test en conditions réelles, les 4 features ajoutées à `/compose` n'apportent
pas de valeur produit suffisante. Elles sont supprimées proprement pour alléger le code
et réduire la surface de maintenance.

**Features à supprimer :**
1. **Replanification inline** — Popover Calendar sur la date d'un post + PATCH /api/posts/[id]
2. **Aperçu trous de contenu** — WeekCoverageStrip (pills 7 jours)
3. **Actions groupées** — BulkActionBar + checkboxes + multi-select state
4. **Barre de progression hebdomadaire** — WeeklyProgressBar

---

## Fichiers à supprimer entièrement (3 fichiers)

```
modules/posts/components/PostComposeList/WeeklyProgressBar.tsx
modules/posts/components/PostComposeList/WeekCoverageStrip.tsx
modules/posts/components/PostComposeList/BulkActionBar.tsx
```

---

## Fichiers à modifier (3 fichiers)

### 1. `app/api/posts/[id]/route.ts`

- Supprimer `import { z } from 'zod'` (ligne 35)
- Supprimer le schéma `PatchBodySchema` (lignes 41-49)
- Supprimer la fonction `PATCH` entière (lignes 124-235)
- Mettre à jour le JSDoc @file : retirer les lignes sur PATCH (lignes 9-29)

**Résultat :** ne garde que le handler `DELETE`.

---

### 2. `modules/posts/components/PostComposeList/PostComposeCard.tsx`

**Imports à modifier :**
- Retirer `CalendarClock, Check, X` de `lucide-react`
- Retirer `import { Calendar as CalendarPicker }` (shadcn)
- Retirer `import { Popover, PopoverContent, PopoverTrigger }`

**Props à retirer :**
- `onReschedule: (updatedPost: Post) => void`
- `isSelected?: boolean`
- `isSelecting?: boolean`
- `onToggleSelect?: (postId: string) => void`

**State à retirer :**
- `rescheduleOpen`, `pickedDate`, `pickedHour`, `pickedMinute`, `isRescheduling`

**Constantes à retirer :**
- `HOURS`, `MINUTES`

**Variable à retirer :**
- `canReschedule`

**Fonctions à retirer :**
- `initPicker()`, `handleConfirmReschedule()`, `handleRemoveDate()`

**JSX à retirer / restaurer :**
- Supprimer le bloc `<div relative shrink-0 size-8>` avec le checkbox overlay.
  Restaurer l'icône de plateforme simple :
  ```tsx
  <div
    className="flex size-8 shrink-0 items-center justify-center rounded-md"
    style={{ backgroundColor: config?.bgColor ?? '#f5f5f5' }}
  >
    {config ? (
      <img src={config.iconPath} alt={config.label} className="size-5 object-contain" />
    ) : (
      <span className="text-xs font-bold text-muted-foreground uppercase">
        {post.platform.slice(0, 2)}
      </span>
    )}
  </div>
  ```

- Supprimer le bloc Popover replanification entier (lignes ~407-540).
  Restaurer affichage date simple (conditionnel sur `post.scheduledFor`) :
  ```tsx
  {post.scheduledFor && (
    <div className="flex items-center gap-1 text-xs text-muted-foreground">
      <Calendar className="size-3 shrink-0" />
      <span>{formatScheduledDate(post.scheduledFor)}</span>
    </div>
  )}
  ```

- Restaurer className de la carte (supprimer la logique `isSelected`/`isSelecting`) :
  ```tsx
  className="flex gap-3 rounded-xl border border-border bg-card p-4 transition-all hover:shadow-sm hover:border-border/80"
  ```

- Restaurer `onClick` : toujours `() => onDetail?.(post)` (supprimer la branche `isSelecting`)

- Supprimer `isSelecting ? 'opacity-0 pointer-events-none' : 'opacity-100'` du div actions

- Mettre à jour le JSDoc @file en tête de fichier

---

### 3. `modules/posts/components/PostComposeList/index.tsx`

**Imports à retirer :**
- `import { BulkActionBar } from './BulkActionBar'`
- `import { WeekCoverageStrip } from './WeekCoverageStrip'`
- `import { WeeklyProgressBar } from './WeeklyProgressBar'`
- `useCallback` (plus utilisé après suppression des handlers bulk)

**State et logique à retirer (bloc "Sélection groupée") :**
- `selectedIds`, `isSelecting`, `isBulkDeleting`
- `useEffect` qui vide `selectedIds` au changement de filtre
- `handleToggleSelect`, `handleSelectAll`, `handleClearSelection`
- `handleBulkDeleted`, `handleBulkDelete`
- `totalDeletable` (memo)

**Fonction à retirer :**
- `handlePostRescheduled`

**Props retirés du `<PostComposeCard>` :**
- `onReschedule={handlePostRescheduled}`
- `isSelected={selectedIds.has(post.id)}`
- `isSelecting={isSelecting}`
- `onToggleSelect={handleToggleSelect}`

**JSX à retirer :**
- Bloc conditionnel `{!hasActiveFilter && allPosts.length > 0 && ...}` (WeeklyProgressBar + WeekCoverageStrip)
- `<BulkActionBar ... />` en bas du rendu

- Mettre à jour le JSDoc @file en tête de fichier

---

## Vérification

1. `pnpm build` ou `pnpm dev` sans erreur TypeScript
2. Naviguer sur `/compose` → liste des posts s'affiche normalement
3. Cliquer sur un post → PostDetailModal s'ouvre
4. Cliquer "Modifier" → AgentModal s'ouvre en mode edit
5. Supprimer un post → disparaît de la liste (optimiste)
6. Aucun checkbox, aucune BulkActionBar, aucune WeeklyProgressBar, aucune WeekCoverageStrip visible
7. Les dates planifiées s'affichent en texte simple (non cliquable)

---

## Résumé

| Action | Fichier |
|--------|---------|
| Supprimer | `PostComposeList/WeeklyProgressBar.tsx` |
| Supprimer | `PostComposeList/WeekCoverageStrip.tsx` |
| Supprimer | `PostComposeList/BulkActionBar.tsx` |
| Modifier  | `app/api/posts/[id]/route.ts` — retirer PATCH |
| Modifier  | `PostComposeList/PostComposeCard.tsx` — retirer reschedule + selection |
| Modifier  | `PostComposeList/index.tsx` — retirer les 4 intégrations |
