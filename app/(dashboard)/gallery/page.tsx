/**
 * @file app/(dashboard)/gallery/page.tsx
 * @description Page Media Library — Server Component.
 *
 *   Charge la première page de médias côté serveur (SSR) et passe les données
 *   à MediaLibraryContent (Client Component) qui gère les filtres, la vue,
 *   l'infinite scroll, le mode sélection et les interactions.
 *
 *   Route : /gallery (protégée par le layout du dashboard)
 *
 * @example
 *   // Accessible via : http://localhost:3000/gallery
 */

import { listMedia } from '@/modules/media/actions/media.action'
import { MediaLibraryContent } from '@/modules/media/components/MediaLibraryContent'

// ─── Métadonnées ───────────────────────────────────────────────────────────────

export const metadata = {
  title: 'Media Library — ogolong',
  description: 'Organisez vos images et vidéos dans des dossiers et taguez-les pour les retrouver facilement.',
}

// ─── Page ──────────────────────────────────────────────────────────────────────

/**
 * Page principale de la Media Library.
 * Charge la première page en SSR pour un affichage instantané.
 */
export default async function GalleryPage(): Promise<React.JSX.Element> {
  // Charge les 40 premiers médias côté serveur (sans cursor = première page)
  const { data } = await listMedia()

  const initialItems = data?.items ?? []
  const initialNextCursor = data?.nextCursor ?? null

  return (
    <div className="space-y-6">
      {/* ── En-tête de la page ──────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Media Library</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Organisez vos images et vidéos avec des dossiers et des tags.
        </p>
      </div>

      {/* ── Contenu interactif (Client Component) ──────────────────────── */}
      <MediaLibraryContent
        initialItems={initialItems}
        initialNextCursor={initialNextCursor}
      />
    </div>
  )
}
