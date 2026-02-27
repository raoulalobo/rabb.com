# Fix : ActivityHeatmap — fenêtre dynamique + cellules fluides

## Contexte

Le composant `ActivityHeatmap` présente deux problèmes visuels par rapport à getlate.dev :

1. **Fenêtre hardcodée** : la grille remonte toujours 16 semaines (112 jours) en arrière,
   indépendamment de la date du premier post. Résultat : la majorité des cellules sont vides
   car l'activité réelle est concentrée sur quelques semaines récentes.

2. **Cellules fixes** : `size-[10px]` fixe chaque cellule à 10×10px. Avec 16 colonnes,
   la grille fait ~192px de large et ne remplit jamais son conteneur. Les données récentes
   s'accumulent à droite, laissant un grand vide à gauche.

getlate.dev part de la date du premier post publié et utilise des cellules fluides qui
s'étirent pour remplir toute la largeur disponible.

---

## Fichier modifié

**Un seul fichier** : `modules/analytics/components/ActivityHeatmap.tsx`

---

## Correction

### Fix 1 — Fenêtre dynamique (dérivée des données)

Remplacer le hardcode `i = 111 → 0` par un calcul basé sur la date la plus ancienne
du tableau `days` reçu en props.

```typescript
// Avant : fenêtre fixe de 112 jours
for (let i = 111; i >= 0; i--) { ... }

// Après : fenêtre dérivée du premier jour de données (cap 52 semaines)
const firstDate = safeDays.length > 0
  ? new Date(safeDays[0].date)          // premier jour de données (trié ASC par l'API)
  : (() => { const d = new Date(); d.setDate(d.getDate() - 111); return d })()

// S'assurer que la fenêtre ne dépasse pas 52 semaines (364 jours)
const maxStart = new Date()
maxStart.setDate(maxStart.getDate() - 364)
const gridStart = firstDate < maxStart ? maxStart : firstDate

// Construire les cellules de gridStart à aujourd'hui
const today = new Date()
const totalDays = Math.round((today.getTime() - gridStart.getTime()) / 86_400_000) + 1
for (let i = totalDays - 1; i >= 0; i--) { ... }
```

**Comportement résultant :**
- Si l'API retourne des données depuis le 19 mai 2025 → la grille commence le 19 mai 2025
- Si l'API retourne des données sur 30 jours → la grille couvre 30 jours
- Cap à 52 semaines pour éviter une grille excessivement large
- Fallback à 16 semaines si `days` est vide

### Fix 2 — Cellules fluides (remplissage largeur)

3 changements CSS uniquement :

| Élément | Classe actuelle | Classe cible |
|---|---|---|
| Conteneur des semaines (`div.flex`) | `flex gap-0.5` | `flex gap-0.5 w-full` |
| Colonne semaine (`div.flex-col`) | `flex flex-col gap-0.5` | `flex flex-col gap-0.5 flex-1` |
| Cellule | `size-[10px] rounded-[2px]` | `h-[10px] w-full rounded-[2px]` |

Les labels de jours (`h-[10px]`) restent inchangés — ils s'alignent déjà sur `h-[10px]` des cellules.

Supprimer `overflow-x-auto` sur le conteneur racine (inutile puisque la grille
s'adapte à la largeur disponible).

---

## Code final du `useMemo` cells

```typescript
const cells = useMemo(() => {
  const today = new Date()

  // Déterminer le début de la grille depuis la date du premier jour de données
  // (l'API retourne les jours triés par date ASC)
  const rawStart = safeDays.length > 0
    ? new Date(safeDays[0].date)
    : (() => { const d = new Date(today); d.setDate(d.getDate() - 111); return d })()

  // Cap à 52 semaines pour éviter une grille trop large
  const maxStart = new Date(today)
  maxStart.setDate(today.getDate() - 364)
  const gridStart = rawStart < maxStart ? maxStart : rawStart

  // Nombre total de jours dans la fenêtre
  const totalDays = Math.round((today.getTime() - gridStart.getTime()) / 86_400_000) + 1

  const gridDays: Array<{ date: string; count: number } | null> = []

  for (let i = totalDays - 1; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(today.getDate() - i)
    const dateStr = d.toISOString().slice(0, 10)
    gridDays.push({ date: dateStr, count: byDate.get(dateStr)?.postCount ?? 0 })
  }

  // Padding initial : aligner le premier jour sur le lundi
  const firstDate = new Date(gridDays[0]!.date)
  const dayOfWeek = (firstDate.getDay() + 6) % 7 // 0 = Lundi
  for (let i = 0; i < dayOfWeek; i++) {
    gridDays.unshift(null)
  }

  return gridDays
}, [safeDays, byDate])
```

### Fix 3 — Tooltip enrichi avec répartition par plateforme

`LateDailyMetric` expose déjà `platforms: Record<string, number>` (ex: `{ tiktok: 2, instagram: 1 }`).
On enrichit l'attribut `title` de la cellule pour afficher le détail :

```
2026-02-22 — 3 posts
tiktok ×2 · instagram ×1
```

Logique de construction du tooltip :

```typescript
/**
 * Construit le texte du tooltip d'une cellule.
 * Ligne 1 : date + total posts
 * Ligne 2 : répartition par plateforme si plusieurs plateformes (optionnelle)
 *
 * @example
 *   buildTooltip('2026-02-22', 3, { tiktok: 2, instagram: 1 })
 *   // → "2026-02-22 — 3 posts\ntiktok ×2 · instagram ×1"
 */
function buildTooltip(
  date: string,
  count: number,
  platforms: Record<string, number>
): string {
  const total = `${date} — ${count} post${count !== 1 ? 's' : ''}`
  const breakdown = Object.entries(platforms)
    .filter(([, n]) => n > 0)
    .map(([p, n]) => `${p} ×${n}`)
    .join(' · ')
  return breakdown ? `${total}\n${breakdown}` : total
}
```

La cellule passe de :
```tsx
title={cell ? `${cell.date} — ${cell.count} post${cell.count !== 1 ? 's' : ''}` : ''}
```
à :
```tsx
title={cell && cell.count > 0 ? buildTooltip(cell.date, cell.count, cell.platforms ?? {}) : ''}
```

La grille doit aussi stocker `platforms` dans chaque cellule. Mise à jour du type interne :

```typescript
// Avant
Array<{ date: string; count: number } | null>

// Après
Array<{ date: string; count: number; platforms: Record<string, number> } | null>
```

Et dans la construction des cellules :
```typescript
gridDays.push({
  date: dateStr,
  count: metric?.postCount ?? 0,
  platforms: metric?.platforms ?? {},
})
```

---

## Vérification

1. `pnpm dev` → naviguer sur `/analytics`
2. La heatmap doit s'étirer sur toute la largeur de sa carte
3. Le premier jour affiché correspond à la date du plus ancien `day` retourné par l'API
4. Survoler une cellule avec des posts → tooltip multiligne :
   ```
   2026-02-22 — 3 posts
   tiktok ×2 · instagram ×1
   ```
5. Survoler une cellule vide → pas de tooltip
6. Redimensionner la fenêtre → les cellules s'adaptent (fluides)
