# Plan : Corriger le textarea qui étire la modale et cache le bouton de validation

## Contexte

Dans `AgentModal` (mode create et edit), le champ `Textarea` (shadcn/ui) contient
`field-sizing-content` dans ses styles de base. Cette propriété CSS fait que le textarea
**grandit automatiquement** pour s'adapter à son contenu (auto-resize natif CSS).

Le `DialogContent` n'ayant aucune contrainte de hauteur (`max-h`), quand le texte est long :
1. Le textarea s'élargit au-delà de `rows={4}`
2. Le dialog dépasse la hauteur du viewport
3. Le footer avec "Générer les posts" / "Modifier le post" disparaît sous le bas de l'écran

## Cause racine

`components/ui/textarea.tsx` ligne 10 : `field-sizing-content` dans les classes de base.
Cette classe est intentionnelle (UX auto-grow) → **ne pas la retirer**.
La correction se fait au niveau du conteneur (dialog + layout interne).

## Solution : 3 fichiers à modifier

### 1. `modules/posts/components/AgentModal/AgentModal.tsx`

Ajouter `flex flex-col max-h-[90dvh]` au `DialogContent` et wrapper le contenu dans
une div `flex-1 min-h-0 overflow-hidden` pour que la hauteur soit contrainte et transmise
aux composants enfants.

```tsx
<DialogContent className="max-w-xl flex flex-col max-h-[90dvh]">
  <DialogHeader>
    {/* ... inchangé */}
  </DialogHeader>

  {/* Wrapper qui prend l'espace restant et empêche le débordement */}
  <div className="flex-1 min-h-0 overflow-hidden">
    {mode === 'create' ? (
      <AgentModalCreate ... />
    ) : (
      <AgentModalEdit ... />
    )}
  </div>
</DialogContent>
```

### 2. `modules/posts/components/AgentModal/AgentModalCreate.tsx`

Section "rendu principal" uniquement (pas la section succès qui est courte).

**Root div** (ligne 326) : remplacer `space-y-4` par un flex-col qui occupe toute la hauteur.

**Wrapper scrollable** : encapsuler instruction + médias + erreur dans une div qui scroll.

**Footer** : sortir du wrapper scrollable → toujours visible en bas.

```tsx
// Avant (ligne 326):
<div className="space-y-4">

// Après:
<div className="flex h-full flex-col gap-4">

  {/* Zone scrollable (instruction + médias + erreur) */}
  <div className="min-h-0 flex-1 overflow-y-auto space-y-4 pr-1">
    {/* section instruction — inchangée */}
    {/* section médias — inchangée */}
    {/* erreur — inchangée */}
  </div>

  {/* Footer — toujours visible, ne scroll pas */}
  <div className="flex items-center justify-between gap-3 border-t border-border pt-4 shrink-0">
    {/* boutons Annuler + Générer — inchangés */}
  </div>

</div>
```

Les `<MediaPicker>` et `<ImageEditorDialog>` (portails Radix) restent à la fin du return
car ils rendent dans le DOM body — non affectés par le scroll.

### 3. `modules/posts/components/AgentModal/AgentModalEdit.tsx`

Même correction identique sur la section "rendu principal" (ligne 298).

```tsx
// Avant (ligne 298):
<div className="space-y-4">

// Après:
<div className="flex h-full flex-col gap-4">

  {/* Zone scrollable (plateforme + médias + instruction + erreur) */}
  <div className="min-h-0 flex-1 overflow-y-auto space-y-4 pr-1">
    {/* sections inchangées */}
  </div>

  {/* Footer — toujours visible */}
  <div className="flex items-center justify-between gap-3 border-t border-border pt-4 shrink-0">
    {/* boutons inchangés */}
  </div>

</div>
```

## Pourquoi ce layout fonctionne

```
DialogContent [flex-col, max-h-90dvh]
├── DialogHeader          → taille naturelle (titre + description)
└── div [flex-1, min-h-0, overflow-hidden]
    └── AgentModalCreate/Edit [flex-col, h-full]
        ├── div [flex-1, min-h-0, overflow-y-auto]  ← scroll ici
        │   ├── Instruction (textarea auto-grow)
        │   ├── Médias
        │   └── Erreur
        └── div [shrink-0]                           ← footer toujours visible
            └── Annuler + Générer / Modifier
```

`min-h-0` est indispensable dans les flex-col : sans lui, un flex item ne peut pas
descendre sous sa taille de contenu minimale (le comportement par défaut `min-height: auto`).

## Fichiers à modifier (résumé)

| Fichier | Changement |
|---|---|
| `modules/posts/components/AgentModal/AgentModal.tsx` | DialogContent + wrapper div |
| `modules/posts/components/AgentModal/AgentModalCreate.tsx` | Root div + scroll wrapper + footer shrink-0 |
| `modules/posts/components/AgentModal/AgentModalEdit.tsx` | Idem AgentModalCreate |

## Vérification

1. Ouvrir la modale "Nouveau post avec l'IA"
2. Coller un long texte dans le champ Instruction
3. Vérifier que le textarea grandit mais s'arrête → scroll interne
4. Vérifier que le bouton "Générer les posts" reste visible en bas
5. Tester aussi la modale d'édition (mode "Modifier le post")
6. Vérifier que le comportement est identique sur mobile (petite hauteur viewport)
