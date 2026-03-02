/**
 * @file next.config.ts
 * @description Configuration Next.js pour ogolong.com.
 *   - Pas de config Turbopack : on utilise Webpack pour `next build` (production).
 *     Turbopack ne génère pas le fichier .next/trace attendu par Vercel,
 *     ce qui cause un fallback de tracing mémoire-intensif qui OOM sur Vercel.
 *   - Turbopack reste utilisé pour `next dev` automatiquement dans Next.js 16.
 */

import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  webpack: (config) => {
    // react-filerobot-image-editor → konva → tente d'importer 'canvas' (module natif Node.js).
    // 'canvas' n'existe pas sur Vercel et n'est pas nécessaire côté browser (konva utilise
    // le Canvas API natif du navigateur). On résout 'canvas' vers false pour que Webpack
    // génère un module vide au lieu de lever une erreur "Module not found".
    config.resolve.alias = {
      ...(config.resolve.alias as Record<string, unknown>),
      canvas: false,
    }
    return config
  },
}

export default nextConfig
