# Correctif : clés dupliquées dans le fil de conversation AgentComposer

## Contexte

Le fil de conversation de l'AgentComposer (`index.tsx`) affiche une erreur React en
développement (Strict Mode) :

```
Encountered two children with the same key, `4`.
Keys should be unique so that components maintain their identity across updates.
```

L'erreur survient à la ligne 623, dans le `.map()` qui rend les messages `user`
du `chatHistory` avec `key={turn.turnCount}`.

## Cause racine

Dans `handleRefinePlan`, `setChatHistory` est appelé **à l'intérieur** de la fonction
updater passée à `setTurnCount` :

```typescript
// ❌ PROBLÈME : side-effect dans un updater React
setTurnCount((n) => {
  const nextTurn = n + 1
  setChatHistory((prev) => [...prev, newUser, newAgent])  // appelé 2× en Strict Mode
  return nextTurn
})
```

React Strict Mode exécute les fonctions updater **deux fois** en développement pour
détecter les side-effects. Résultat : `setChatHistory` est appelé deux fois avec le
même `nextTurn`, ajoutant deux paires identiques (même `turnCount`) dans `chatHistory`.
Le `.map()` reçoit donc des clés dupliquées.

## Correctif

**Fichier** : `modules/posts/components/AgentComposer/index.tsx`

### 1. Séparer les mises à jour d'état dans `handleRefinePlan`

Remplacer l'appel imbriqué par deux appels indépendants. `turnCount` est lisible
directement depuis la closure du composant (pas besoin du pattern fonctionnel
puisqu'il n'y a pas de mise à jour concurrente sur cet état) :

```typescript
// ✅ CORRECT : deux setState indépendants, pas de side-effect dans un updater
const nextTurn = turnCount + 1
setTurnCount(nextTurn)
setChatHistory((prev) => [
  ...prev,
  { role: 'user',  content: refinementInstruction.trim(), turnCount: nextTurn },
  { role: 'agent', content: `Plan mis à jour — ...`,      turnCount: nextTurn },
])
```

### 2. Utiliser l'index comme clé dans le `.map()`

`turnCount` n'est pas stable en tant que clé React car plusieurs ChatTurn peuvent
partager le même `turnCount` (user + agent du même tour). Utiliser l'index `i` du
tableau filtré, qui est garanti unique dans ce rendu :

```typescript
// avant  : key={turn.turnCount}
// après  : key={i}
.map((turn, i, arr) => (
  <div key={i} ...>
```

## Fichier impacté

| Fichier | Lignes | Action |
|---|---|---|
| `modules/posts/components/AgentComposer/index.tsx` | ~410–422 | Séparer `setTurnCount` et `setChatHistory` |
| `modules/posts/components/AgentComposer/index.tsx` | ~624 | Changer `key={turn.turnCount}` → `key={i}` |

## Vérification

1. `pnpm tsc --noEmit` → 0 erreur
2. `pnpm lint` → 0 erreur
3. Tour 1 → générer un plan → aucune erreur console
4. Tour 2 (raffinement) → les deux messages (tour 1 estompé + tour 2 actif) s'affichent sans doublon
5. Tour 3 → 3 messages dans le fil, aucune erreur de clé dupliquée
