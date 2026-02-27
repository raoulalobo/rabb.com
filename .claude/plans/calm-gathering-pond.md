# Analyse : règles de plateformes visibles ou non

## Contexte

Question : les règles par plateforme (ex: nombre max d'images) ne sont-elles plus affichées
aux utilisateurs ? Y a-t-il eu un choix délibéré ?

Réponse : **non, ce n'est pas un choix délibéré — c'est une limitation de l'implémentation.**

---

## État actuel du code

### Source de vérité (toujours présente)

`modules/platforms/config/platform-rules.ts` — contient `PLATFORM_RULES` complet pour 13 plateformes.

### Ce qui est affiché dans le PostComposer

| Règle | Où | Condition |
|---|---|---|
| Limite caractères | Compteur circulaire + texte | **Toujours** (onglet "Tous" = min des plateformes sélectionnées) |
| Max photos / vidéos / média requis | Info-ligne sous l'éditeur | **Uniquement sur un onglet plateforme spécifique** (pas sur "Tous") |
| Trop de photos/vidéos | Badge ⚠️ sur l'onglet | Seulement si violation détectée |
| Mixte non autorisé | Toast | Au moment de l'upload |

### La limitation identifiée

Dans `Editor.tsx` (lignes 80-82) :
```typescript
const platformInfo = activePlatformTab
  ? getPlatformInfoText(activePlatformTab)
  : null  // ← "Tous" tab → aucune règle affichée
```

L'info-ligne (`"Max 2 200 car. · 10 photos max · 1 vidéo max"`) n'apparaît que lorsque
l'utilisateur navigue sur un onglet plateforme spécifique. Sur l'onglet par défaut "Tous",
aucune règle n'est précisée.

---

## Conclusion

Pas de suppression volontaire. Les règles existent et sont utilisées pour la validation,
mais leur affichage est partiel : visible uniquement par onglet plateforme, invisible
sur l'onglet "Tous" (état par défaut à l'ouverture du composer).

**Aucune action requise** — diagnostic uniquement.
