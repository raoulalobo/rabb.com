/**
 * @file lib/prisma.ts
 * @description Client Prisma singleton pour l'application.
 *
 *   Prisma 7 : le PrismaClient exige un adapter de driver (ici @prisma/adapter-pg).
 *   L'adapter reçoit un pg.Pool configuré avec DATABASE_URL (port 5432, session mode).
 *
 *   Stratégie de résilience face aux connexions périmées (PgBouncer) :
 *   - On ne tente PAS de maintenir les connexions en vie artificiellement.
 *   - PgBouncer ferme les connexions idle côté serveur : c'est son rôle.
 *   - pool.on('error') empêche un crash Node.js quand pg détecte une connexion morte.
 *   - Une extension Prisma retry automatiquement si la 1re requête tombe sur une
 *     connexion périmée (race condition : pg ne sait pas encore qu'elle est morte).
 *   - max: 3 → limite les connexions actives (adapté au plan Supabase free).
 *
 *   Évite la création de multiples connexions en développement
 *   (le Hot Module Replacement de Next.js recharge les modules,
 *   ce qui crée de nouvelles instances sans singleton).
 *
 *   En production, instancie une seule fois au démarrage du processus.
 *   En développement, réutilise l'instance stockée dans globalThis.
 *
 * @example
 *   // Dans une Server Action ou un Route Handler :
 *   import { prisma } from '@/lib/prisma'
 *   const user = await prisma.user.findUnique({ where: { id } })
 */

import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'
import { Pool } from 'pg'

// Typage de l'extension de globalThis pour TypeScript
declare global {
  var prisma: PrismaClient | undefined
}

/**
 * Détermine si une erreur provient d'une connexion pg périmée (fermée par PgBouncer).
 * Ces erreurs sont transitoires : une retry avec une connexion fraîche suffit.
 *
 * @param err - L'erreur attrapée dans le bloc catch
 * @returns true si l'erreur est due à une connexion morte, false sinon
 *
 * @example
 *   isStaleConnectionError(new Error('Server has closed the connection')) // → true
 *   isStaleConnectionError(new Error('Invalid query'))                     // → false
 */
function isStaleConnectionError(err: unknown): boolean {
  if (!(err instanceof Error)) return false
  return (
    err.message.includes('Server has closed the connection') ||
    err.message.includes('Connection terminated unexpectedly') ||
    // Certaines versions de pg lèvent ce message quand le socket est détruit
    err.message.includes('Cannot read properties of undefined')
  )
}

/**
 * Délai en millisecondes avant de rejouer une requête bloquée par un pool PgBouncer saturé.
 * 150ms laisse le temps à PgBouncer de libérer un slot sans délai perceptible pour l'utilisateur.
 */
const POOL_SATURATED_RETRY_DELAY_MS = 150

/**
 * Détermine si une erreur provient d'un pool PgBouncer saturé (nombre max de clients atteint).
 * Ce type d'erreur est levé par @prisma/adapter-pg sous la forme d'un DriverAdapterError
 * quand PgBouncer refuse une nouvelle connexion en session mode.
 *
 * Exportée pour permettre aux Server Actions et Route Handlers de retourner un message
 * utilisateur friendly si le retry automatique de l'extension Prisma échoue lui aussi.
 *
 * @param err - L'erreur attrapée dans le bloc catch
 * @returns true si l'erreur indique un pool saturé, false sinon
 *
 * @example
 *   isPgPoolSaturatedError(new Error('MaxClientsInSessionMode: max clients reached')) // → true
 *   isPgPoolSaturatedError(new Error('Invalid query'))                                  // → false
 */
export function isPgPoolSaturatedError(err: unknown): boolean {
  if (!(err instanceof Error)) return false
  return (
    err.message.includes('MaxClientsInSessionMode') ||
    // Variante générique PgBouncer (transaction mode ou message tronqué)
    (err.message.includes('max clients reached') && !err.message.includes('Server has closed')) ||
    // DriverAdapterError wrappé par Prisma 7 contenant la mention du mode session
    (err.message.includes('DriverAdapterError') && err.message.includes('Session mode'))
  )
}

/**
 * Crée une nouvelle instance PrismaClient avec l'adapter pg et une extension retry.
 *
 * @returns Instance PrismaClient étendue, prête à l'emploi
 */
function createPrismaClient(): PrismaClient {
  // Pool pg minimal : PgBouncer gère la durée de vie des connexions.
  // On n'utilise pas keepAlive ni idleTimeoutMillis car on préfère laisser
  // PgBouncer fermer les connexions idle naturellement, et gérer le retry côté Prisma.
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 3, // max 3 connexions simultanées (adapté au plan Supabase free)
    // Pas de keepAlive ni idleTimeoutMillis :
    // PgBouncer gère la durée de vie des connexions — c'est son rôle.
  })

  // Gestionnaire d'erreur pool : évite un crash Node.js quand PgBouncer ferme
  // une connexion idle côté serveur (le client pg reçoit une notification d'erreur).
  // pg retire silencieusement le client défaillant du pool → prochaine requête = connexion fraîche.
  pool.on('error', (_err) => {
    // Intentionnellement vide : pg gère déjà le retrait du client mort du pool.
    // Sans ce handler, Node.js lèverait un uncaughtException qui crasherait le process.
  })

  // PrismaPg accepte une instance Pool directement (Prisma 7).
  // Cast nécessaire : @prisma/adapter-pg bundle sa propre copie de @types/pg,
  // qui peut diverger structurellement de @types/pg racine (ex: connect() → void vs ClientBase).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adapter = new PrismaPg(pool as any)
  const client = new PrismaClient({ adapter })

  // Extension Prisma : retry transparent sur toutes les opérations en cas de connexion périmée.
  // Race condition typique : pg sort du pool une connexion que PgBouncer vient de fermer,
  // mais pg ne l'a pas encore détecté. La 1re tentative échoue → la 2e obtient une connexion fraîche.
  return client.$extends({
    query: {
      $allModels: {
        /**
         * Intercepte toutes les opérations Prisma.
         * En cas d'erreur de connexion périmée, rejoue la requête une seule fois.
         *
         * @param args - Arguments de la requête Prisma
         * @param query - Fonction de requête originale
         * @returns Résultat de la requête (1re ou 2e tentative)
         */
        async $allOperations({ args, query }) {
          try {
            return await query(args)
          } catch (err) {
            if (isStaleConnectionError(err)) {
              // 2e tentative : pg a retiré la connexion morte du pool,
              // cette requête obtient une connexion fraîche.
              return await query(args)
            }
            if (isPgPoolSaturatedError(err)) {
              // Pool saturé : attendre que PgBouncer libère un slot avant de réessayer.
              // 150ms suffisent généralement pour qu'une connexion active se libère.
              await new Promise<void>((resolve) => setTimeout(resolve, POOL_SATURATED_RETRY_DELAY_MS))
              return await query(args)
            }
            // Toute autre erreur est relancée telle quelle
            throw err
          }
        },
      },
    },
  }) as unknown as PrismaClient
}

/**
 * Singleton Prisma Client.
 * - Production : nouvelle instance à chaque démarrage du processus
 * - Développement : instance réutilisée via globalThis pour éviter les fuites
 */
export const prisma = globalThis.prisma ?? createPrismaClient()

// En développement uniquement : stocker l'instance dans globalThis
// pour la réutiliser après un Hot Module Replacement
if (process.env.NODE_ENV !== 'production') {
  globalThis.prisma = prisma
}
