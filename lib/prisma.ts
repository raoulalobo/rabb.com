/**
 * @file lib/prisma.ts
 * @description Client Prisma singleton pour l'application.
 *
 *   Prisma 7 : le PrismaClient exige un adapter de driver (ici @prisma/adapter-pg).
 *   L'adapter reçoit DATABASE_URL (connection pooler PgBouncer port 6543) pour
 *   la mise en pool des connexions en production.
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

// Typage de l'extension de globalThis pour TypeScript
declare global {

  var prisma: PrismaClient | undefined
}

/**
 * Crée une nouvelle instance PrismaClient avec l'adapter pg.
 * Utilise DATABASE_URL (pooler PgBouncer port 6543) pour le runtime.
 *
 * @returns Instance PrismaClient prête à l'emploi
 */
function createPrismaClient(): PrismaClient {
  // Adapter pg : gère la mise en pool des connexions PostgreSQL via PgBouncer
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL,
  })

  return new PrismaClient({ adapter })
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
