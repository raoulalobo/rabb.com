/**
 * @file lib/supabase/server.ts
 * @description Clients Supabase pour le serveur (Server Components, Server Actions,
 *   API Routes). Expose deux clients :
 *
 *   - `createClient()`        → anon key + cookies (session Supabase Auth)
 *                               Pour les requêtes soumises à la RLS standard.
 *
 *   - `createServiceClient()` → service role key (bypass RLS complet)
 *                               Pour les opérations serveur déjà authentifiées
 *                               via better-auth (Storage uploads, etc.).
 *
 *   ⚠️  Ne jamais utiliser createClient() dans les Client Components → lib/supabase/client.ts
 *   ⚠️  Ne jamais utiliser createServiceClient() dans le code accessible au client
 *   ⚠️  Ne jamais exposer SUPABASE_SERVICE_ROLE_KEY côté client
 *
 * @example
 *   // API Route avec auth better-auth déjà vérifiée → bypass RLS Storage
 *   import { createServiceClient } from '@/lib/supabase/server'
 *   const supabase = createServiceClient()
 *   await supabase.storage.from('post-media').createSignedUploadUrl(path)
 */

import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'


/**
 * Crée un client Supabase pour le serveur (async car cookies() est async en Next.js 15+).
 * Lit et écrit les cookies de session via next/headers.
 *
 * @returns Client Supabase server avec gestion des cookies de session
 */
/**
 * Crée un client Supabase avec la **Service Role Key** (bypass RLS complet).
 *
 * À utiliser UNIQUEMENT dans les API Routes et Server Actions **après avoir
 * vérifié l'authentification via better-auth**. Ce client voit toutes les
 * données sans restriction de RLS.
 *
 * Cas d'usage typiques :
 * - Génération de presigned URLs pour Supabase Storage (upload médias)
 * - Opérations administratives sur la DB depuis le serveur
 *
 * ⚠️  JAMAIS dans un Client Component, JAMAIS exposé au navigateur.
 *
 * @returns Client Supabase avec droits administrateur (service role)
 *
 * @example
 *   // app/api/posts/upload-url/route.ts
 *   const supabase = createServiceClient()
 *   const { data, error } = await supabase.storage
 *     .from('post-media')
 *     .createSignedUploadUrl(path)
 */
export function createServiceClient(): ReturnType<typeof createSupabaseClient> {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    // La service role key bypass toute RLS — accès complet en lecture/écriture
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

/**
 * Crée un client Supabase pour le serveur avec gestion des cookies de session.
 * Utilise la clé anon + la session Supabase Auth des cookies Next.js.
 *
 * À utiliser pour les Server Components/Actions qui interrogent la DB
 * sous l'identité de l'utilisateur (RLS active).
 */
export async function createClient(): Promise<ReturnType<typeof createServerClient>> {
  // cookies() est async en Next.js 15+ (breaking change vs Next.js 14)
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        // Lecture de tous les cookies de session
        getAll: () => cookieStore.getAll(),
        // Écriture des cookies de session (après login, refresh token, etc.)
        setAll: (cookiesToSet) => {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // setAll peut échouer dans les Server Components (lecture seule)
            // C'est acceptable car le middleware gère le rafraîchissement des cookies
          }
        },
      },
    }
  )
}
