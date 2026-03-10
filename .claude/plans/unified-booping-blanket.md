# Plan — Revert landing page au design original (badges "Compatible avec")

## Contexte

Les tentatives d'animation (orbite, icônes flottantes) n'ont pas convaincu.
L'utilisateur souhaite revenir au design d'origine : la section **"Compatible avec"**
affichant les 9 plateformes sous forme de badges horizontaux (icône + nom).

---

## Modifications à effectuer

### 1. `app/page.tsx`

**Supprimer** l'import `OrbitingPlatforms` :
```tsx
// Supprimer cette ligne :
import { OrbitingPlatforms } from '@/components/landing/OrbitingPlatforms'
```

**Revenir** à la `<section>` sans `relative` ni `overflow-hidden` :
```tsx
<section
  className="flex min-h-screen flex-col items-center justify-center px-6 pb-16 pt-32 text-center"
  aria-labelledby="hero-heading"
>
```

**Supprimer** le composant `<OrbitingPlatforms>` et son commentaire.

**Remettre** le disclaimer à `mt-10` :
```tsx
<p className="mt-10 text-sm text-gray-400">
```

**Restaurer** le bloc "Compatible avec" entre le CTA et le disclaimer :
```tsx
<div
  className="mt-14 flex flex-col items-center gap-4"
  aria-label="Plateformes supportées"
>
  <p className="text-sm text-gray-400">Compatible avec</p>
  <div className="flex flex-wrap items-center justify-center gap-3">
    {PLATFORMS.map((platform) => (
      <div
        key={platform.name}
        className="flex items-center gap-2 rounded-lg border border-gray-100 bg-white px-3 py-2 shadow-sm transition-shadow hover:shadow-md"
        title={platform.name}
      >
        <Image
          src={platform.icon}
          alt={`Logo ${platform.name}`}
          className="size-5 shrink-0"
          width={20}
          height={20}
        />
        <span className="hidden text-sm font-medium text-gray-700 sm:inline">
          {platform.name}
        </span>
      </div>
    ))}
  </div>
</div>
```

### 2. `components/landing/OrbitingPlatforms.tsx`

**Supprimer** ce fichier (devenu inutilisé).

---

## Fichiers critiques

| Fichier | Action |
|---|---|
| `app/page.tsx` | Modifier (revert section + import + bloc plateformes + disclaimer) |
| `components/landing/OrbitingPlatforms.tsx` | Supprimer |

---

## Vérification

1. `bun dev` → `http://localhost:3000`
2. La section "Compatible avec" avec les 9 badges apparaît sous les CTAs
3. Aucune animation en arrière-plan
4. Le fichier `OrbitingPlatforms.tsx` n'existe plus
5. Pas d'erreur TypeScript
