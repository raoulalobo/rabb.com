# Plan — Fix : bouton de validation masqué dans AgentModalBulkEdit

## Contexte

Quand la phase 2 (preview "Avant/Après") du modal "Modifier avec l'IA" contient
beaucoup de posts, le bouton "Appliquer à N posts" disparaît sous le bas du viewport.

**Cause racine** : Le `DialogContent` dans `AgentModal.tsx` a `max-h-[90dvh]`
mais pas de hauteur explicite. Or le composant enfant `AgentModalBulkEdit`
utilise `h-full` sur son div racine.
En CSS, `height: 100%` **ne fonctionne** que si le parent a une hauteur explicite.
`max-height` seul ne crée PAS de contexte de hauteur défini — donc `h-full`
s'évalue à `height: auto`, le div grandit à sa hauteur naturelle, et le footer
sort du viewport.

Le scroll est pourtant bien configuré (`flex-1 min-h-0 overflow-y-auto` sur la
zone de contenu, `shrink-0` sur le footer), mais le layout flex global ne
fonctionne pas parce que le div racine n'est pas contraint correctement.

---

## Fichiers à modifier (2)

```
modules/posts/components/AgentModal/AgentModal.tsx          ← DialogContent
modules/posts/components/AgentModal/AgentModalBulkEdit.tsx  ← divs racines phases 1 et 2
```

---

## Modifications

### 1. `AgentModal.tsx` — DialogContent (ligne ~103)

Ajouter `overflow-hidden` au `DialogContent`.
Sans cela, même avec le bon layout flex, le contenu peut déborder du `max-h`.

```tsx
// Avant
<DialogContent className="max-w-xl flex flex-col max-h-[90dvh]">

// Après
<DialogContent className="max-w-xl flex flex-col max-h-[90dvh] overflow-hidden">
```

### 2. `AgentModalBulkEdit.tsx` — Phase 2 root div (ligne ~587)

Remplacer `h-full` par `flex-1 min-h-0`.
- `flex-1` : prend tout l'espace restant dans le flex column parent (DialogContent)
  → fonctionne avec `max-height` contrairement à `h-full`
- `min-h-0` : permet au div de rétrécir sous sa taille naturelle (obligatoire
  pour que les flex enfants avec `overflow-y-auto` scrollent correctement)

```tsx
// Avant (phase 2)
<div className="flex h-full flex-col gap-4">

// Après (phase 2)
<div className="flex flex-1 min-h-0 flex-col gap-4">
```

### 3. `AgentModalBulkEdit.tsx` — Phase 1 root div (ligne ~739 ou proche)

Même correction sur la phase 1 (input) qui partage le même pattern :

```tsx
// Avant (phase 1)
<div className="flex h-full flex-col gap-4">

// Après (phase 1)
<div className="flex flex-1 min-h-0 flex-col gap-4">
```

> **Note** : La phase 3 (success) utilise `flex flex-col gap-4` sans `h-full`
> — elle n'a pas de zone scrollable donc elle n'est pas concernée.

---

## Pourquoi ça corrige le bug

Hiérarchie après fix :

```
DialogContent  (flex flex-col  max-h-[90dvh]  overflow-hidden)
  DialogHeader (shrink-0 implicite via contenu court)
  AgentModalBulkEdit root  (flex-1  min-h-0  flex-col  gap-4)  ← FIX
    zone scrollable          (flex-1  min-h-0  overflow-y-auto)
      cartes Avant/Après
    footer                   (shrink-0)
      Bouton "Appliquer"     ← toujours visible
```

`flex-1` sur le root div lui dit de prendre l'espace restant dans le
`DialogContent` flex column. `min-h-0` lui permet de rétrécir si nécessaire.
La zone scrollable à l'intérieur peut alors prendre tout l'espace disponible
et scroller, pendant que le footer reste ancré en bas.

---

## Vérification

1. Ouvrir la liste des posts, sélectionner 3+ posts
2. Cliquer "Modifier avec l'IA" → saisir une instruction → générer
3. Phase 2 : vérifier que le bouton "Appliquer à N posts" est visible en bas
4. Vérifier que la zone des cards scroll correctement
5. Tester avec 1 post (modal court) → vérifier que le layout n'est pas cassé
6. Tester la phase 1 (input) avec beaucoup de médias dans le pool → même vérification
