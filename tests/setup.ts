/**
 * @file tests/setup.ts
 * @description Fichier d'initialisation global des tests (chargé avant chaque suite via vitest.config.ts).
 *   - Importe @testing-library/jest-dom pour les matchers DOM étendus (toBeInTheDocument, etc.)
 *   - Ce fichier peut être enrichi pour initialiser MSW (mock service worker) plus tard
 *
 * @example
 *   // Dans un test, les matchers DOM sont automatiquement disponibles :
 *   expect(element).toBeInTheDocument()
 *   expect(button).toBeDisabled()
 */

import '@testing-library/jest-dom'
