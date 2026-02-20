/**
 * @file lib/supabase/client.ts
 * @description Client Supabase pour les composants côté navigateur (Client Components).
 *   Utilise createBrowserClient de @supabase/ssr pour maintenir la session via cookies.
 *
 *   ⚠️  À utiliser uniquement dans les Client Components ('use client').
 *   Pour les Server Components et Actions, utiliser lib/supabase/server.ts.
 *
 * @example
 *   // Dans un Client Component
 *   import { createClient } from '@/lib/supabase/client'
 *   const supabase = createClient()
 *   const { data } = await supabase.storage.from('media').upload(path, file)
 */

import { createBrowserClient } from '@supabase/ssr'

/**
 * Crée un client Supabase pour le navigateur.
 * Utilise les variables d'environnement publiques (préfixées NEXT_PUBLIC_).
 *
 * @returns Client Supabase browser avec gestion automatique des cookies de session
 */
export function createClient(): ReturnType<typeof createBrowserClient> {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
