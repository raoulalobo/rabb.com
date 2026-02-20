/**
 * @file eslint.config.mjs
 * @description Configuration ESLint au format flat config (ESLint v9+).
 *   - Étend next/core-web-vitals et next/typescript pour les règles Next.js
 *   - Ajoute eslint-plugin-import pour imposer l'ordre strict des imports (cf. CLAUDE.md §4.5)
 *   - Désactive les règles de formatage conflictuelles avec Prettier (eslint-config-prettier)
 *   - Interdit l'usage de `any` et impose le typage explicite des retours de fonctions
 *   - Ignore les fichiers générés automatiquement (shadcn/ui, prisma, etc.)
 */

import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'
import prettier from 'eslint-config-prettier'
import importPlugin from 'eslint-plugin-import'

const eslintConfig = defineConfig([
  // ─── Règles Next.js (Core Web Vitals + TypeScript) ───────────────────────
  ...nextVitals,
  ...nextTs,

  // ─── Ignorés : fichiers générés ou hors de notre contrôle ────────────────
  globalIgnores([
    // Fichiers générés par Next.js
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    // Dépendances
    'node_modules/**',
    // Fichiers générés par shadcn/ui — on ne les modifie pas
    'components/ui/**',
    // Fichier utilitaire généré par shadcn/ui
    'lib/utils.ts',
    // Code généré par Prisma/ZenStack
    'prisma/generated/**',
  ]),

  // ─── Règles personnalisées ─────────────────────────────────────────────────
  {
    plugins: {
      import: importPlugin,
    },
    rules: {
      // Ordre des imports : builtin → external → internal (@/) → parent → sibling → index → types
      // Correspond exactement à CLAUDE.md §4.5
      'import/order': [
        'error',
        {
          groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index', 'type'],
          pathGroups: [
            {
              // Les imports @/ sont des imports internes (alias TypeScript)
              pattern: '@/**',
              group: 'internal',
            },
          ],
          'newlines-between': 'always',
          alphabetize: { order: 'asc', caseInsensitive: true },
        },
      ],

      // Interdit `any` — utiliser `unknown` + assertion de type si nécessaire
      '@typescript-eslint/no-explicit-any': 'error',

      // Impose le typage explicite du retour des fonctions exportées
      '@typescript-eslint/explicit-function-return-type': [
        'warn',
        {
          // Exclure les expressions fléchées simples (callbacks, JSX) pour éviter le bruit
          allowExpressions: true,
          allowTypedFunctionExpressions: true,
          allowHigherOrderFunctions: true,
          allowDirectConstAssertionInArrowFunctions: true,
        },
      ],
    },
  },

  // ─── Prettier en dernier — désactive les règles de formatage conflictuelles ─
  prettier,
])

export default eslintConfig
