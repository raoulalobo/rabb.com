/**
 * @file app/(dashboard)/compose/page.tsx
 * @description Page de composition d'un post.
 *   Affiche le PostComposer avec tous ses sous-composants assemblés.
 *   Protégée par le layout dashboard (authentification requise).
 *
 *   Architecture :
 *   - Ce fichier est un Server Component (pas de 'use client')
 *   - PostComposerCard est un Client Component (fichier séparé)
 *   - Suspense affiche le skeleton pendant le rendu du client component
 *
 * @example
 *   // Route : GET /compose
 *   // Rendu côté serveur, PostComposerCard rendu côté client
 */

import { Suspense } from 'react'

import type { Metadata } from 'next'

import { PostComposerSkeleton } from '@/modules/posts/components/PostComposer/PostComposerSkeleton'

import { PostComposerCard } from './PostComposerCard'

// ─── Métadonnées ──────────────────────────────────────────────────────────────

export const metadata: Metadata = {
  title: 'Composer un post — rabb',
  description: 'Rédigez et planifiez votre contenu sur tous vos réseaux en un seul endroit.',
}

// ─── Page ─────────────────────────────────────────────────────────────────────

/**
 * Page /compose : interface de création et planification de posts.
 * Wrapping de PostComposerCard (Client Component) dans Suspense pour le streaming SSR.
 */
export default function ComposePage(): React.JSX.Element {
  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6">
      {/* ── En-tête de page ───────────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Nouveau post</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Rédigez, planifiez et publiez sur tous vos réseaux en un clic.
        </p>
      </div>

      {/* ── PostComposerCard (Client Component) ───────────────────────────── */}
      {/*
       * PostComposerCard est dans un fichier séparé marqué 'use client' car
       * les propriétés statiques d'un Client Component (PostComposer.Editor, etc.)
       * ne sont pas accessibles depuis un Server Component.
       */}
      <Suspense fallback={<PostComposerSkeleton />}>
        <PostComposerCard />
      </Suspense>
    </div>
  )
}
