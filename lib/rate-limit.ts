/**
 * @file lib/rate-limit.ts
 * @description Utilitaire central de rate limiting pour les routes API coûteuses.
 *
 *   Deux modes selon la présence de UPSTASH_REDIS_REST_URL :
 *   - **Upstash** (@upstash/ratelimit, sliding window) — production multi-instances Vercel
 *   - **In-memory Map** — développement local ou fallback (non distribué, mono-instance)
 *
 *   Catégories et limites :
 *   - `ai`     : 10 req / 1 min  — create-posts, edit-post (coût Claude API)
 *   - `filter` : 30 req / 1 min  — posts/filter-ai (moins coûteux)
 *   - `upload` : 20 req / 1 min  — posts/upload-url (anti-abus Storage)
 *
 *   Usage dans une route API (après le check de session) :
 *   ```typescript
 *   const rl = await rateLimiters.ai(session.user.id)
 *   if (!rl.success) return rateLimitResponse(rl.reset)
 *   ```
 *
 * @see https://upstash.com/docs/oss/sdks/ts/ratelimit/overview
 */

import { Redis } from '@upstash/redis'
import { Ratelimit } from '@upstash/ratelimit'
import { NextResponse } from 'next/server'

// ─── Types partagés ───────────────────────────────────────────────────────────

/**
 * Résultat d'une vérification de rate limit.
 * Compatible avec le retour de @upstash/ratelimit et l'implémentation in-memory.
 */
export interface RateLimitResult {
  /** true si la requête est autorisée, false si le quota est dépassé */
  success: boolean
  /** Nombre de requêtes restantes dans la fenêtre courante */
  remaining: number
  /** Timestamp Unix (ms) de réinitialisation du compteur */
  reset: number
}

// ─── Implémentation Upstash (production) ─────────────────────────────────────

/**
 * Crée un limiteur Upstash (sliding window) si les variables d'environnement
 * UPSTASH_REDIS_REST_URL et UPSTASH_REDIS_REST_TOKEN sont définies.
 *
 * Retourne null si les clés sont absentes → fallback in-memory activé.
 *
 * @param limit  - Nombre maximal de requêtes autorisées dans la fenêtre
 * @param window - Durée de la fenêtre en secondes
 * @returns Limiteur Upstash ou null
 *
 * @example
 *   const limiter = createUpstashLimiter(10, 60)
 *   if (limiter) {
 *     const result = await limiter.limit('user:abc123')
 *   }
 */
function createUpstashLimiter(
  limit: number,
  window: number,
): { limit: (key: string) => Promise<RateLimitResult> } | null {
  // Vérification de la présence des clés Upstash
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return null
  }

  const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  })

  const ratelimit = new Ratelimit({
    redis,
    // Sliding window : la fenêtre glisse avec le temps, pas de "burst" en début de fenêtre
    limiter: Ratelimit.slidingWindow(limit, `${window} s`),
    // Préfixe pour isoler les clés de ce projet dans le Redis Upstash
    prefix: 'ogolong:rl',
  })

  return {
    limit: async (key: string): Promise<RateLimitResult> => {
      const result = await ratelimit.limit(key)
      return {
        success: result.success,
        remaining: result.remaining,
        // Upstash retourne reset en ms
        reset: result.reset,
      }
    },
  }
}

// ─── Implémentation In-Memory (développement / fallback) ─────────────────────

/**
 * Entrée dans la Map in-memory pour un userId + catégorie.
 */
interface MemoryEntry {
  /** Nombre de requêtes effectuées dans la fenêtre courante */
  count: number
  /** Timestamp Unix (ms) de réinitialisation de la fenêtre */
  resetAt: number
}

/** Map in-memory partagée entre les instances (attention : mono-process) */
const memoryStore = new Map<string, MemoryEntry>()

/**
 * Crée un limiteur in-memory basé sur une Map.
 * Non distribué → uniquement valable en développement ou environnement mono-instance.
 * En production multi-instances Vercel, préférer le limiteur Upstash.
 *
 * @param limit  - Nombre maximal de requêtes dans la fenêtre
 * @param window - Durée de la fenêtre en secondes
 * @returns Limiteur in-memory
 *
 * @example
 *   const limiter = createMemoryLimiter(10, 60)
 *   const result = await limiter.limit('user:abc123:ai')
 */
function createMemoryLimiter(
  limit: number,
  window: number,
): { limit: (key: string) => Promise<RateLimitResult> } {
  return {
    limit: async (key: string): Promise<RateLimitResult> => {
      const now = Date.now()
      const windowMs = window * 1000
      const entry = memoryStore.get(key)

      // Fenêtre expirée ou première requête → nouvelle entrée
      if (!entry || now >= entry.resetAt) {
        const resetAt = now + windowMs
        memoryStore.set(key, { count: 1, resetAt })
        return { success: true, remaining: limit - 1, reset: resetAt }
      }

      // Quota dépassé dans la fenêtre courante
      if (entry.count >= limit) {
        return { success: false, remaining: 0, reset: entry.resetAt }
      }

      // Incrément du compteur
      entry.count++
      return { success: true, remaining: limit - entry.count, reset: entry.resetAt }
    },
  }
}

// ─── Limiteurs par catégorie ───────────────────────────────────────────────────

/**
 * Config des limiteurs par catégorie.
 * Modifer ici pour ajuster les limites sans toucher aux routes.
 */
const LIMITS = {
  /** Agents IA (Claude API) — coût élevé */
  ai: { limit: 10, window: 60 },
  /** Filtres IA (Claude Haiku) — moins coûteux */
  filter: { limit: 30, window: 60 },
  /** Génération d'URLs d'upload — anti-abus Storage */
  upload: { limit: 20, window: 60 },
} as const

/**
 * Crée le bon limiteur selon la config : Upstash si disponible, sinon in-memory.
 *
 * @param category - Clé de la catégorie dans LIMITS
 * @returns Fonction de vérification acceptant un userId
 */
function buildLimiter(
  category: keyof typeof LIMITS,
): (userId: string) => Promise<RateLimitResult> {
  const { limit, window } = LIMITS[category]

  // Tentative d'utilisation d'Upstash (production)
  const upstash = createUpstashLimiter(limit, window)
  if (upstash) {
    return (userId: string) => upstash.limit(`${category}:${userId}`)
  }

  // Fallback in-memory (développement)
  const memory = createMemoryLimiter(limit, window)
  return (userId: string) => memory.limit(`${category}:${userId}`)
}

/**
 * Limiteurs prêts à l'emploi par catégorie.
 * Chaque entrée est une fonction qui reçoit un userId et retourne un RateLimitResult.
 *
 * @example
 *   // Dans une route API, après le check de session :
 *   const rl = await rateLimiters.ai(session.user.id)
 *   if (!rl.success) return rateLimitResponse(rl.reset)
 */
export const rateLimiters = {
  /** Agents IA — 10 req / 1 min (create-posts, edit-post) */
  ai: buildLimiter('ai'),
  /** Filtres IA — 30 req / 1 min (posts/filter-ai) */
  filter: buildLimiter('filter'),
  /** Upload URLs — 20 req / 1 min (posts/upload-url) */
  upload: buildLimiter('upload'),
}

// ─── Réponse 429 standardisée ─────────────────────────────────────────────────

/**
 * Construit une réponse HTTP 429 standardisée avec le header `Retry-After`.
 * À utiliser dans les routes API quand le rate limit est dépassé.
 *
 * @param reset - Timestamp Unix (ms) de réinitialisation du compteur
 * @returns NextResponse 429 avec header Retry-After et body JSON
 *
 * @example
 *   const rl = await rateLimiters.ai(session.user.id)
 *   if (!rl.success) return rateLimitResponse(rl.reset)
 */
export function rateLimitResponse(reset: number): NextResponse {
  // Délai en secondes avant réinitialisation (arrondi au supérieur)
  const retryAfterSeconds = Math.ceil((reset - Date.now()) / 1000)

  return NextResponse.json(
    {
      error: 'Trop de requêtes. Veuillez patienter avant de réessayer.',
      retryAfter: retryAfterSeconds,
    },
    {
      status: 429,
      headers: {
        // Indique aux clients (et à Vercel Edge) le délai avant réessai
        'Retry-After': String(Math.max(retryAfterSeconds, 1)),
      },
    },
  )
}
