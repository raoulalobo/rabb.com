/**
 * @file vitest.config.ts
 * @description Configuration Vitest pour les tests unitaires et d'intégration.
 *   - Environnement jsdom pour simuler le DOM (nécessaire pour @testing-library/react)
 *   - Globals activés : describe, it, expect, vi disponibles sans import
 *   - Alias @/ aligné sur tsconfig.json pour résoudre les imports du projet
 *   - setupFiles : initialise MSW, Testing Library, etc. avant chaque test
 *
 * @example
 *   // Lancer tous les tests
 *   pnpm vitest
 *
 *   // Mode watch (développement)
 *   pnpm vitest --watch
 *
 *   // Couverture de code
 *   pnpm vitest --coverage
 */

import path from 'path'

import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [
    // Plugin React pour transformer les fichiers JSX/TSX
    react(),
  ],
  test: {
    // Simule un environnement navigateur (window, document, etc.)
    environment: 'jsdom',

    // Rend describe/it/expect/vi disponibles globalement (sans import)
    globals: true,

    // Fichier d'initialisation exécuté avant chaque suite de tests
    setupFiles: ['./tests/setup.ts'],

    // Inclure uniquement les fichiers de tests dans ces dossiers
    include: ['tests/**/*.{test,spec}.{ts,tsx}'],
  },
  resolve: {
    // Alias @/ → racine du projet (identique à tsconfig.json paths)
    alias: { '@': path.resolve(__dirname, '.') },
  },
})
