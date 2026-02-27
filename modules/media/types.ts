/**
 * @file modules/media/types.ts
 * @module media
 * @description Types TypeScript du module Galerie de médias.
 *   Utilisés dans les composants (MediaCard, MediaGrid, MediaPicker),
 *   les Server Actions (saveMedia, deleteMedia, listMedia) et les routes API.
 */

// ─── Types de domaine ─────────────────────────────────────────────────────────

/**
 * Représentation d'un média stocké en DB et dans Supabase Storage.
 * Correspond au modèle Prisma `Media`.
 *
 * @example
 *   const item: MediaItem = {
 *     id: 'clx123',
 *     userId: 'usr_abc',
 *     url: 'https://....supabase.co/storage/v1/object/public/post-media/usr_abc/gallery/...',
 *     filename: 'photo.jpg',
 *     mimeType: 'image/jpeg',
 *     size: 204800,
 *     createdAt: new Date('2026-02-27'),
 *   }
 */
export interface MediaItem {
  /** Identifiant unique (cuid) */
  id: string
  /** ID de l'utilisateur propriétaire */
  userId: string
  /** URL publique permanente dans Supabase Storage */
  url: string
  /** Nom du fichier affiché dans la galerie */
  filename: string
  /** Type MIME : "image/jpeg", "image/png", "video/mp4", etc. */
  mimeType: string
  /** Taille du fichier en octets */
  size: number
  /** Date de création de l'entrée en DB */
  createdAt: Date
}

/**
 * Réponse paginée de listMedia().
 * Utilisée par MediaGrid pour l'infinite scroll.
 *
 * @example
 *   const page: MediaPage = {
 *     items: [...],
 *     nextCursor: 'clx456', // null si dernière page
 *   }
 */
export interface MediaPage {
  /** Liste des médias de la page courante */
  items: MediaItem[]
  /** Curseur vers la page suivante (id du dernier item), null si fin */
  nextCursor: string | null
}
