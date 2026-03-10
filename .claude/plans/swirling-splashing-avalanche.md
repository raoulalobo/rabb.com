# Plan : Unification des footers → composant SiteFooter partagé

## Contexte

3 footers différents coexistent dans le projet avec des structures et styles incohérents :

| Footer | Fichier | Structure actuelle |
|---|---|---|
| **Auth** | `app/(auth)/layout.tsx` | Liens seulement, centré, `text-muted-foreground` |
| **Légal** | `app/(legal)/layout.tsx` | Liens + copyright, centré, `border-t`, `max-w-3xl` |
| **Landing** | `app/page.tsx` | Copyright gauche + liens droite, `border-t border-gray-100 bg-white`, `max-w-6xl` |

**Résultat attendu** : Un seul composant `<SiteFooter />` qui correspond au design
de la capture d'écran fournie par l'utilisateur.

---

## Design cible (capture d'écran)

Structure 3 colonnes, pleine largeur avec bordure haute :

```
┌─────────────────────────────────────────────────────────────┐  ← border-t
│  [●N]     © 2026 ogolong.com — Tous droits réservés     [liens légaux]  │
└─────────────────────────────────────────────────────────────┘
  logo left         copyright center              links right
```

**Caractéristiques** :
- `border-t` : séparateur discret en haut
- Colonne gauche : icône/logo (cercle sombre avec initiale)
- Colonne centre : copyright dynamique `© {année} ogolong.com — Tous droits réservés`
- Colonne droite : 3 liens légaux sans séparateur "·", espacés par `gap-x-6`
- Texte : `text-xs text-muted-foreground`, hover : `hover:text-foreground`
- Responsive : flex-col centré sur mobile → flex-row justify-between sur `sm+`

---

## Solution

### Nouveau fichier à créer

**`components/shared/SiteFooter.tsx`** — Composant serveur partagé

```tsx
/**
 * @file components/shared/SiteFooter.tsx
 * @description Footer global du site ogolong.com.
 *   Utilisé dans les layouts : auth, légal, et la landing page.
 *   Structure 3 colonnes : logo | copyright | liens légaux
 *   Responsive : colonne centrée sur mobile → row justify-between sur sm+
 */
import Link from 'next/link'

export function SiteFooter() {
  return (
    <footer className="border-t">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-6 py-4 sm:flex-row">
        {/* Logo — cercle sombre avec initiale (remplaçable par un SVG) */}
        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-foreground text-background text-xs font-semibold select-none">
          N
        </div>

        {/* Copyright dynamique */}
        <p className="text-xs text-muted-foreground">
          © {new Date().getFullYear()} ogolong.com — Tous droits réservés
        </p>

        {/* Navigation légale */}
        <nav className="flex flex-wrap justify-center gap-x-6 gap-y-1" aria-label="Liens légaux">
          <Link href="/privacy" className="text-xs text-muted-foreground transition-colors hover:text-foreground">
            Politique de confidentialité
          </Link>
          <Link href="/terms" className="text-xs text-muted-foreground transition-colors hover:text-foreground">
            CGU
          </Link>
          <Link href="/legal" className="text-xs text-muted-foreground transition-colors hover:text-foreground">
            Mentions légales
          </Link>
        </nav>
      </div>
    </footer>
  )
}
```

---

## Fichiers à modifier

| Fichier | Action |
|---|---|
| `components/shared/SiteFooter.tsx` | **CRÉER** — composant partagé |
| `app/(auth)/layout.tsx` | **MODIFIER** — remplacer `<footer>…</footer>` inline par `<SiteFooter />` |
| `app/(legal)/layout.tsx` | **MODIFIER** — remplacer `<footer>…</footer>` inline par `<SiteFooter />` |
| `app/page.tsx` | **MODIFIER** — remplacer `<footer>…</footer>` inline par `<SiteFooter />` |

### Changements concrets

**`app/(auth)/layout.tsx`** :
```diff
+ import { SiteFooter } from '@/components/shared/SiteFooter'
  ...
- <footer className="pb-6 text-center text-xs text-muted-foreground">
-   <nav className="flex flex-wrap justify-center gap-x-3 gap-y-1">
-     ...
-   </nav>
- </footer>
+ <SiteFooter />
```

**`app/(legal)/layout.tsx`** :
```diff
+ import { SiteFooter } from '@/components/shared/SiteFooter'
  ...
- <footer className="border-t">
-   <div className="mx-auto max-w-3xl px-4 py-6 text-center text-xs text-muted-foreground">
-     <nav>...</nav>
-     <p className="mt-3">© ... ogolong.com — Tous droits réservés</p>
-   </div>
- </footer>
+ <SiteFooter />
```

**`app/page.tsx`** :
```diff
+ import { SiteFooter } from '@/components/shared/SiteFooter'
  ...
- <footer className="border-t border-gray-100 bg-white">
-   <div className="mx-auto flex max-w-6xl ...">
-     <p>© ...</p>
-     <nav>...</nav>
-   </div>
- </footer>
+ <SiteFooter />
```

---

## Vérification

1. `/login` ou `/register` → footer en bas avec logo + copyright + liens
2. `/privacy`, `/terms`, `/legal` → même footer
3. `/` (landing page) → même footer
4. Redimensionner à 375px → footer passe en colonne centrée
5. `npx tsc --noEmit` → 0 erreur TypeScript
