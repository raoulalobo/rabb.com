/**
 * @file prisma.config.ts
 * @description Configuration Prisma 7 pour les commandes CLI (migrate, generate, introspect).
 *
 *   Prisma 7 Breaking Change :
 *   - Les URLs de connexion sont sorties de schema.prisma
 *   - Ce fichier configure les URLs uniquement pour le CLI Prisma (migrations)
 *   - Le runtime utilise @prisma/adapter-pg passé au constructeur PrismaClient
 *
 *   Variables d'environnement :
 *   - DIRECT_URL : connexion directe PostgreSQL (port 5432) — contourne PgBouncer
 *     Obligatoire pour les migrations (pgBouncer ne supporte pas les transactions DDL).
 *
 * @see https://pris.ly/d/config-datasource
 * @see https://pris.ly/d/prisma7-client-config
 */

import { defineConfig } from 'prisma/config'

export default defineConfig({
  // URL utilisée uniquement par le CLI Prisma (migrate, generate, introspect).
  // Doit pointer vers la connexion directe (port 5432) pour éviter les limites PgBouncer.
  //
  // process.env avec fallback (au lieu de env() strict) : prisma generate n'a pas
  // besoin d'une vraie connexion DB — il lit seulement le schéma. Le fallback évite
  // le crash PrismaConfigEnvError dans les environnements sans DIRECT_URL (ex: Vercel build).
  datasource: {
    url: process.env.DIRECT_URL ?? 'postgresql://localhost:5432/placeholder',
  },
})
