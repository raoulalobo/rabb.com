/**
 * @file next.config.ts
 * @description Configuration Next.js pour ogolong.com.
 *   - Pas de config Turbopack : on utilise Webpack pour `next build` (production).
 *     Turbopack ne génère pas le fichier .next/trace attendu par Vercel,
 *     ce qui cause un fallback de tracing mémoire-intensif qui OOM sur Vercel.
 *   - Turbopack reste utilisé pour `next dev` automatiquement dans Next.js 16.
 */

import type { NextConfig } from 'next'

const nextConfig: NextConfig = {}

export default nextConfig
