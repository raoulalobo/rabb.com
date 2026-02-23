/**
 * @file app/(dashboard)/compose/page.tsx
 * @description Page /compose — liste des posts DRAFT+SCHEDULED de l'utilisateur.
 *
 *   Charge les 25 premiers posts côté serveur (Server Component) via Prisma direct.
 *   Rend PostComposeList (Client Component) avec les posts et le curseur initiaux.
 *   L'infinite scroll prend le relais côté client via useInfiniteQuery.
 *
 *   Architecture :
 *   - page.tsx : Server Component (authentification + chargement DB + métadonnées)
 *   - PostComposeList : Client Component (infinite scroll + filtres + gestion des modales)
 *
 *   Tri : scheduledFor DESC NULLS LAST, puis createdAt DESC.
 *   Les posts planifiés apparaissent en premier, les brouillons sans date ensuite.
 *
 * @example
 *   // Route : GET /compose
 *   // Rendu SSR des 25 premiers posts → hydratation + infinite scroll côté client
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

// ─── Chargement SSR des 25 premiers posts ─────────────────────────────────────

/**
 * Résultat du chargement SSR : première page + curseur pour l'infinite scroll.
 */
interface InitialPostsResult {
  posts: Post[]
  /** Curseur vers la page suivante, ou null si tous les posts tiennent sur une page */
  nextCursor: string | null
}

/**
 * Charge les 25 premiers posts DRAFT+SCHEDULED de l'utilisateur.
 * Tri : scheduledFor DESC NULLS LAST, puis createdAt DESC (cohérent avec l'API).
 *
 * Retourne également le curseur pour que le client puisse charger
 * les pages suivantes via useInfiniteQuery sans re-charger les 25 premiers.
 *
 * @param userId - ID de l'utilisateur connecté
 * @returns Premiers posts + curseur pour la page suivante
 */
async function fetchInitialPosts(userId: string): Promise<InitialPostsResult> {
  const posts = await prisma.post.findMany({
    where: {
      userId,
      // Charger tous les statuts : brouillons, planifiés, publiés et échoués
      status: { in: ['DRAFT', 'SCHEDULED', 'PUBLISHED', 'FAILED'] },
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
    orderBy: [
      // Posts planifiés d'abord (nulls en dernier), puis par création décroissante
      { scheduledFor: { sort: 'desc', nulls: 'last' } },
      { createdAt: 'desc' },
    ],
    // Récupérer 25 posts — même limite que l'API en mode compose
    take: 25,
  })

  return {
    posts: posts as unknown as Post[],
    // nextCursor = ID du dernier post si la page est complète, null si tous les posts rentrent
    nextCursor: posts.length === 25 ? posts[posts.length - 1].id : null,
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

/**
 * Page /compose : liste des brouillons + planifiés avec infinite scroll.
 * Server Component — charge les 25 premiers posts côté serveur avant le rendu.
 */
export default async function ComposePage(): Promise<React.JSX.Element> {
  // ── Authentification ───────────────────────────────────────────────────────
  // Rediriger si non connecté (double protection — proxy.ts gère déjà le cas général)
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) redirect('/login')

  // ── Chargement des 25 premiers posts ──────────────────────────────────────
  const { posts: initialPosts, nextCursor: initialNextCursor } =
    await fetchInitialPosts(session.user.id)

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6">
      {/* ── En-tête de page ──────────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Brouillons</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {initialPosts.length > 0
            ? 'Gérez vos brouillons et planifiés — créez de nouveaux posts avec l\'agent IA.'
            : 'Créez vos premiers posts avec l\'agent IA.'}
        </p>
      </div>

      {/* ── Liste des posts (Client Component) ───────────────────────────── */}
      {/*
       * PostComposeList est un Client Component qui :
       * - Hydrate les posts initiaux (passés depuis ce Server Component)
       * - Continue le chargement en infinite scroll via useInfiniteQuery
       * - Gère les filtres serveur (platform, dateRange) et client (status)
       * - Gère l'ouverture de l'AgentModal (création / édition)
       * - Met à jour la liste optimistiquement via queryClient.setQueryData
       *
       * initialNextCursor permet au client de savoir s'il y a des pages suivantes
       * sans faire de requête supplémentaire au démarrage.
       */}
      <Suspense fallback={<PostComposeListSkeleton />}>
        <PostComposeList
          initialPosts={initialPosts}
          initialNextCursor={initialNextCursor}
        />
      </Suspense>
    </div>
  )
}
