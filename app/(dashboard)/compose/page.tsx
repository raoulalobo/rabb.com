/**
 * @file app/(dashboard)/compose/page.tsx
 * @description Page de composition d'un post via l'AgentComposer IA.
 *   L'utilisateur donne une instruction en texte ou en voix, uploade des médias,
 *   et l'agent Claude génère un plan de publication adapté à chaque plateforme.
 *
 *   Architecture :
 *   - Ce fichier est un Server Component (pas de 'use client')
 *   - AgentComposerCard est un Client Component (fichier séparé)
 *   - Suspense affiche le skeleton pendant le rendu du client component
 *
 * @example
 *   // Route : GET /compose
 *   // Rendu côté serveur, AgentComposerCard rendu côté client
 */

import { Suspense } from 'react'


import { AgentComposerSkeleton } from '@/modules/posts/components/AgentComposer/AgentComposerSkeleton'

import { AgentComposerCard } from './AgentComposerCard'

import type { Metadata } from 'next'

// ─── Métadonnées ──────────────────────────────────────────────────────────────

export const metadata: Metadata = {
  title: 'Composer un post — rabb',
  description: 'Donnez vos instructions à l\'agent IA qui planifie votre contenu sur chaque réseau.',
}

// ─── Page ─────────────────────────────────────────────────────────────────────

/**
 * Page /compose : interface de création et planification de posts pilotée par l'IA.
 * Wrapping de AgentComposerCard (Client Component) dans Suspense pour le streaming SSR.
 */
export default function ComposePage(): React.JSX.Element {
  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6">
      {/* ── En-tête de page ───────────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Nouveau post</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Donnez vos instructions, l&apos;agent adapte et planifie votre contenu sur chaque réseau.
        </p>
      </div>

      {/* ── AgentComposerCard (Client Component) ──────────────────────────── */}
      {/*
       * AgentComposerCard est dans un fichier séparé marqué 'use client' car
       * l'AgentComposer utilise des hooks React (state, router, callbacks).
       * Même pattern que l'ancien PostComposerCard.
       */}
      <Suspense fallback={<AgentComposerSkeleton />}>
        <AgentComposerCard />
      </Suspense>
    </div>
  )
}
