/**
 * @file app/(dashboard)/gallery/page.tsx
 * @description Page Galerie de médias — Server Component.
 *
 *   Charge la première page de médias côté serveur (SSR) et passe les données
 *   à MediaGrid (Client Component) qui gère l'infinite scroll et les interactions.
 *
 *   Route : /gallery (protégée par le layout du dashboard)
 *   Auth  : vérifiée par le layout parent — si l'utilisateur n'est pas connecté,
 *           il est redirigé vers /login avant d'atteindre ce composant.
 *
 * @example
 *   // Accessible via : http://localhost:3000/gallery
 */

import { listMedia } from '@/modules/media/actions/media.action'
import { MediaGrid } from '@/modules/media/components/MediaGrid'

// ─── Métadonnées ───────────────────────────────────────────────────────────────

export const metadata = {
  title: 'Galerie — rabb',
  description: 'Gérez vos images et vidéos réutilisables dans vos posts.',
}

// ─── Page ──────────────────────────────────────────────────────────────────────

/**
 * Page principale de la galerie de médias.
 * Charge la première page en SSR pour un affichage instantané.
 */
export default async function GalleryPage(): Promise<React.JSX.Element> {
  // Charge les 40 premiers médias côté serveur (sans cursor = première page)
  const { data, error } = await listMedia()

  // En cas d'erreur (ex: non authentifié — normalement géré par le layout),
  // on affiche une grille vide plutôt que de crasher
  const initialItems = data?.items ?? []
  const initialNextCursor = data?.nextCursor ?? null

  return (
    <div className="space-y-6">
      {/* ── En-tête de la page ──────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Galerie</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Importez et gérez vos images et vidéos pour les réutiliser dans vos posts.
        </p>
      </div>

      {/* Message d'erreur serveur (rare — normalement l'auth est vérifiée avant) */}
      {error && (
        <div className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Impossible de charger la galerie : {error}
        </div>
      )}

      {/* ── Grille interactive (Client Component) ──────────────────────── */}
      <MediaGrid
        initialItems={initialItems}
        initialNextCursor={initialNextCursor}
      />
    </div>
  )
}
