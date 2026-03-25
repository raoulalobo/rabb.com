/**
 * @file app/api/user/export/route.ts
 * @module user
 * @description Route GET pour l'export des données personnelles de l'utilisateur (RGPD — droit à la portabilité).
 *
 *   Conforme à l'article 20 du RGPD : fournit une copie des données personnelles
 *   dans un format structuré, couramment utilisé et lisible par machine (JSON).
 *
 *   Protection : session obligatoire via better-auth (auth.api.getSession).
 *   Données exportées (sans informations sensibles) :
 *   - Profil utilisateur (sans mot de passe ni tokens)
 *   - Posts (brouillons, planifiés, publiés)
 *   - Plateformes connectées
 *   - Signatures
 *   - Médias (liste avec URLs publiques)
 *   - Préférences de notifications
 *
 *   Le header Content-Disposition déclenche le téléchargement automatique
 *   du fichier dans le navigateur.
 *
 * @example
 *   // Déclenchement côté client :
 *   <a href="/api/user/export" download>Exporter mes données</a>
 *   // → Télécharge : ogolong-data-2025-03-15.json
 */

import { headers } from 'next/headers'
import { NextResponse } from 'next/server'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/user/export
 * Génère et retourne un fichier JSON contenant toutes les données personnelles
 * de l'utilisateur connecté, propres à être téléchargées directement.
 *
 * @returns 200 + JSON attaché en téléchargement
 * @returns 401 si aucune session valide
 * @returns 500 en cas d'erreur Prisma
 */
export async function GET(): Promise<NextResponse> {
  // ── 1. Vérification de session ─────────────────────────────────────────────
  const session = await auth.api.getSession({ headers: await headers() })

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  const userId = session.user.id

  try {
    // ── 2. Collecte des données en parallèle ────────────────────────────────
    // Toutes les requêtes sont exécutées simultanément pour minimiser la latence.
    const [user, posts, platforms, signatures, media, notifPrefs] = await Promise.all([
      // Profil utilisateur (sans champs sensibles — never expose password/tokens)
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          name: true,
          avatarUrl: true,
          description: true,
          emailVerified: true,
          createdAt: true,
          updatedAt: true,
          // lateWorkspaceId exclu — identifiant interne sans valeur pour l'utilisateur
        },
      }),

      // Posts stockés chez Zernio (source de vérité unique) — non inclus dans l'export DB locale.
      // L'utilisateur peut exporter ses posts depuis le dashboard Zernio.
      Promise.resolve([]),

      // Plateformes sociales connectées
      prisma.connectedPlatform.findMany({
        where: { userId },
        select: {
          id: true,
          platform: true,
          accountName: true,
          avatarUrl: true,
          isActive: true,
          connectedAt: true,
        },
      }),

      // Signatures réutilisables
      prisma.signature.findMany({
        where: { userId },
        select: {
          id: true,
          name: true,
          text: true,
          platform: true,
          isDefault: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      }),

      // Médias de la galerie (liste avec URLs publiques)
      prisma.media.findMany({
        where: { userId },
        select: {
          id: true,
          url: true,
          filename: true,
          mimeType: true,
          size: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      }),

      // Préférences de notifications
      prisma.notificationPrefs.findUnique({
        where: { userId },
        select: {
          emailOnFailure: true,
          emailWeeklyRecap: true,
        },
      }),
    ])

    // ── 3. Construction de l'objet d'export ────────────────────────────────
    const exportData = {
      // Métadonnées de l'export (traçabilité RGPD)
      _export: {
        service: 'ogolong.com',
        exportedAt: new Date().toISOString(),
        rgpdArticle: 'Art. 20 RGPD — Droit à la portabilité des données',
        contact: 'privacy@ogolong.com',
      },
      // Données utilisateur
      profile: user,
      preferences: {
        notifications: notifPrefs,
      },
      // Données de contenu
      posts: {
        count: posts.length,
        items: posts,
      },
      connectedPlatforms: {
        count: platforms.length,
        items: platforms,
      },
      signatures: {
        count: signatures.length,
        items: signatures,
      },
      media: {
        count: media.length,
        items: media,
      },
    }

    // ── 4. Nom du fichier avec date du jour (YYYY-MM-DD) ──────────────────
    const date = new Date().toISOString().slice(0, 10)
    const filename = `ogolong-data-${date}.json`

    // ── 5. Retour JSON avec header de téléchargement ───────────────────────
    // Content-Disposition: attachment → le navigateur télécharge plutôt qu'afficher
    return new NextResponse(JSON.stringify(exportData, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        // Empêche la mise en cache du fichier d'export (données personnelles sensibles)
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    })
  } catch (error) {
    console.error('[/api/user/export] Erreur lors de l\'export des données :', error)
    return NextResponse.json(
      { error: 'Erreur interne lors de l\'export des données.' },
      { status: 500 }
    )
  }
}
