/**
 * @file next.config.ts
 * @description Configuration Next.js pour rabb.com.
 *   - Turbopack : définit la racine du workspace pour éviter le warning de détection
 *   - Peut être enrichi au fil des phases (images, headers, redirections, etc.)
 */

import path from 'path'

import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  turbopack: {
    // Racine du workspace — évite l'ambiguïté avec d'autres lockfiles parents
    // (cf. https://nextjs.org/docs/app/api-reference/config/next-config-js/turbopack#root-directory)
    root: path.resolve(__dirname),
  },
}

export default nextConfig
