/**
 * @file app/(dashboard)/compose/page.tsx
 * @description Page /compose — liste des posts DRAFT de l'utilisateur.
 *
 *   Charge les brouillons côté serveur (Server Component) via Prisma direct.
 *   Rend PostComposeList (Client Component) avec les posts initiaux.
 *   L'utilisateur peut créer de nouveaux posts via le bouton "Nouveau post"
 *   qui ouvre l'AgentModal en mode création.
 *
 *   Architecture :
 *   - page.tsx : Server Component (authentification + chargement DB + métadonnées)
 *   - PostComposeList : Client Component (liste interactive + gestion des modales)
 *
 * @example
 *   // Route : GET /compose
 *   // Rendu SSR → hydratation côté client
 */

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PostComposeList } from '@/modules/posts/components/PostComposeList'
import { PostComposeListSkeleton } from '@/modules/posts/components/PostComposeList/PostComposeListSkeleton'
import type { Post } from '@/modules/posts/types'

import type { Metadata } from 'next'

// ─── Métadonnées ──────────────────────────────────────────────────────────────

export const metadata: Metadata = {
  title: 'Brouillons — rabb',
  description: 'Gérez vos brouillons et créez de nouveaux posts avec l\'agent IA.',
}

// ─── Chargement des posts DRAFT ───────────────────────────────────────────────

/**
 * Charge les posts DRAFT de l'utilisateur connecté.
 * Les posts sont triés par date de création décroissante (plus récents en premier).
 *
 * @param userId - ID de l'utilisateur connecté
 * @returns Liste des posts DRAFT
 */
async function fetchDraftPosts(userId: string): Promise<Post[]> {
  const posts = await prisma.post.findMany({
    where: {
      userId,
      // Charger les brouillons ET les posts planifiés (pas encore publiés)
      status: { in: ['DRAFT', 'SCHEDULED'] },
    },
    select: {
      id: true,
      userId: true,
      text: true,
      platform: true,
      mediaUrls: true,
      status: true,
      scheduledFor: true,
      publishedAt: true,
      latePostId: true,
      failureReason: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { createdAt: 'desc' },
    // Limite raisonnable pour éviter des performances dégradées sur la page
    take: 50,
  })

  // Cast explicite : Prisma retourne PostStatus comme string, on force le type union
  return posts as unknown as Post[]
}

// ─── Page ─────────────────────────────────────────────────────────────────────

/**
 * Page /compose : liste des brouillons + bouton de création via l'agent IA.
 * Server Component — charge les posts côté serveur avant le rendu.
 */
export default async function ComposePage(): Promise<React.JSX.Element> {
  // ── Authentification ───────────────────────────────────────────────────────
  // Rediriger si non connecté (double protection — proxy.ts gère déjà le cas général)
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) redirect('/login')

  // ── Chargement des posts DRAFT ────────────────────────────────────────────
  const initialPosts = await fetchDraftPosts(session.user.id)

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6">
      {/* ── En-tête de page ──────────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Brouillons</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {initialPosts.length > 0
            ? `${initialPosts.length} post${initialPosts.length > 1 ? 's' : ''} — créez de nouveaux posts avec l'agent IA.`
            : 'Créez vos premiers posts avec l\'agent IA.'}
        </p>
      </div>

      {/* ── Liste des posts (Client Component) ───────────────────────────── */}
      {/*
       * PostComposeList est un Client Component qui :
       * - Affiche les posts initiaux (passés depuis ce Server Component)
       * - Gère l'ouverture de l'AgentModal (création / édition)
       * - Met à jour la liste optimistiquement sans rechargement de page
       *
       * Suspense est requis car PostComposeList est un Client Component
       * imbriqué dans un Server Component avec Suspense streaming.
       */}
      <Suspense fallback={<PostComposeListSkeleton />}>
        <PostComposeList initialPosts={initialPosts} />
      </Suspense>
    </div>
  )
}
