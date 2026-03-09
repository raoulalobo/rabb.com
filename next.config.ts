/**
 * @file next.config.ts
 * @description Configuration Next.js pour ogolong.com.
 *
 *   Stratégie bundler :
 *   - `next dev`   → Turbopack (par défaut Next.js 16). `turbopack.root` fixe la racine
 *     du workspace pour éviter le warning "multiple lockfiles detected" (bun.lock dans
 *     ce projet vs package-lock.json dans /home/alobo/Bureau). Turbopack ignore
 *     silencieusement les modules natifs optionnels (ex: canvas).
 *
 *   - `next build` → Webpack forcé via le flag `--webpack` dans package.json.
 *     Nécessaire car `react-filerobot-image-editor → konva` tente d'importer 'canvas'
 *     (module natif Node.js absent sur Vercel). L'alias `canvas: false` produit un
 *     module vide, évitant l'erreur "Module not found" en production.
 *
 *   Problème workspace root :
 *   Un package.json existe à /home/alobo/Bureau/ (dossier parent). Webpack's
 *   enhanced-resolve remonte l'arborescence et le détecte comme racine workspace,
 *   cherchant tailwindcss dans /home/alobo/Bureau/node_modules (inexistant).
 *   Fix : `resolve.modules` force Webpack à chercher dans le node_modules du projet.
 */

import path from 'path'
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Autorise les requêtes cross-origin vers /_next/* en développement.
  // Nécessaire quand l'app est accédée depuis une autre machine du réseau local
  // (ex: 10.187.189.160 → localhost). Sans cette config, Next.js affiche un warning
  // et bloquera ces requêtes dans une future version majeure.
  allowedDevOrigins: ['10.187.189.160'],

  // Config Turbopack — déclare explicitement l'usage de Turbopack pour `next dev`.
  // `root: __dirname` pointe sur /home/alobo/Bureau/NextJS/rsx/rsxv1 pour que
  // Turbopack ne remonte pas jusqu'au package.json de /home/alobo/Bureau/.
  turbopack: {
    root: __dirname,
  },

  webpack: (config) => {
    // Fix workspace root : Webpack détecte /home/alobo/Bureau/package.json comme
    // racine et cherche les modules dans /home/alobo/Bureau/node_modules (inexistant).
    // On insère le node_modules du projet en tête de liste pour que la résolution
    // parte toujours du bon endroit, avant de remonter vers les ancêtres.
    config.resolve.modules = [
      path.resolve(__dirname, 'node_modules'),
      'node_modules',
    ]

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
