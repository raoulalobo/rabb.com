/**
 * @file app/(dashboard)/compose/PostComposerCard.tsx
 * @description Assemblage du PostComposer dans une card.
 *   Composant CLIENT séparé car il accède aux sous-composants du PostComposer
 *   (PostComposer.Editor, PostComposer.Platforms, etc.) qui sont des propriétés
 *   statiques d'un Client Component — non accessibles depuis un Server Component.
 *
 *   Ce fichier est importé par la page /compose (Server Component) et wrappé
 *   dans un <Suspense> pour le streaming SSR.
 */

'use client'

import { PostComposer } from '@/modules/posts/components/PostComposer'

/**
 * Card complète du PostComposer avec tous ses sous-composants assemblés.
 * Rendu exclusivement côté client (hooks Zustand, contexte React).
 */
export function PostComposerCard(): React.JSX.Element {
  return (
    <PostComposer className="rounded-xl border border-border bg-card shadow-sm">
      {/* En-tête de la card */}
      <div className="border-b border-border px-5 py-4">
        <span className="text-sm font-medium text-muted-foreground">Rédiger</span>
      </div>

      {/* Corps principal */}
      <div className="space-y-5 px-5 py-4">
        {/* Onglets par plateforme (visibles uniquement si au moins une plateforme est sélectionnée) */}
        <PostComposer.PlatformTabs />

        {/* Zone de texte principale */}
        <PostComposer.Editor
          placeholder="Quoi de neuf ? Partagez quelque chose d'intéressant..."
          rows={8}
        />

        {/* Séparateur entre l'éditeur et les options */}
        <div className="border-t border-border/60" />

        {/* Sélection des plateformes cibles */}
        <PostComposer.Platforms />

        {/* Upload de médias (images/vidéos) */}
        <PostComposer.MediaUpload />

        {/* Planification de la publication */}
        <PostComposer.Schedule />
      </div>

      {/* Footer avec les boutons d'action */}
      <div className="border-t border-border px-5 py-4">
        <PostComposer.Footer />
      </div>
    </PostComposer>
  )
}
