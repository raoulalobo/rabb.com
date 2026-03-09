/**
 * @file modules/media/types.ts
 * @module media
 * @description Types TypeScript du module Galerie de médias (Media Library).
 *   Utilisés dans les composants (MediaCard, MediaLibraryContent, MediaPicker),
 *   les Server Actions (saveMedia, deleteMedia, listMedia, etc.) et les routes API.
 *
 *   Nouveaux types v2 : MediaFolder, MediaTag, MediaSortBy, MediaTypeFilter, MediaViewMode.
 */

// ─── Types de domaine ─────────────────────────────────────────────────────────

/**
 * Dossier virtuel pour organiser les médias de la galerie.
 * Correspond au modèle Prisma `MediaFolder`.
 *
 * @example
 *   const folder: MediaFolder = {
 *     id: 'clf123',
 *     userId: 'usr_abc',
 *     name: 'Campagne Printemps',
 *     createdAt: new Date('2026-03-01'),
 *     _count: { media: 12 },
 *   }
 */
export interface MediaFolder {
  /** Identifiant unique (cuid) */
  id: string
  /** ID de l'utilisateur propriétaire */
  userId: string
  /** Nom affiché dans les tabs de la galerie */
  name: string
  /** Date de création */
  createdAt: Date
  /** Compteur de médias dans ce dossier (inclus si Prisma `_count` est demandé) */
  _count?: { media: number }
}

/**
 * Tag coloré pour étiqueter les médias.
 * Correspond au modèle Prisma `MediaTag`.
 *
 * @example
 *   const tag: MediaTag = {
 *     id: 'clt456',
 *     userId: 'usr_abc',
 *     name: 'Printemps',
 *     color: '#22c55e',
 *   }
 */
export interface MediaTag {
  /** Identifiant unique (cuid) */
  id: string
  /** ID de l'utilisateur propriétaire */
  userId: string
  /** Nom affiché sur le badge */
  name: string
  /** Couleur hexadécimale du badge (ex: "#6366f1") */
  color: string
}

/**
 * Représentation d'un média stocké en DB et dans Supabase Storage.
 * Correspond au modèle Prisma `Media` (avec relations folder + tags).
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
 *     folderId: null,
 *     folder: null,
 *     tags: [],
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
  /** ID du dossier parent (null = racine / sans dossier) */
  folderId?: string | null
  /** Objet dossier parent (inclus si Prisma `include: { folder: true }`) */
  folder?: MediaFolder | null
  /** Tags associés à ce média */
  tags: MediaTag[]
}

/**
 * Réponse paginée de listMedia().
 * Utilisée par MediaLibraryContent pour l'infinite scroll.
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

// ─── Types de filtres / tri ────────────────────────────────────────────────────

/**
 * Critère de tri pour la liste de médias.
 * - newest : plus récent en premier (défaut)
 * - oldest : plus ancien en premier
 * - name   : tri alphabétique par nom de fichier
 * - size   : du plus lourd au plus léger
 */
export type MediaSortBy = 'newest' | 'oldest' | 'name' | 'size'

/**
 * Filtre par type de média.
 * - all   : tous les types (défaut)
 * - image : images uniquement (mimeType commence par "image/")
 * - video : vidéos uniquement (mimeType commence par "video/")
 */
export type MediaTypeFilter = 'all' | 'image' | 'video'

/**
 * Vue d'affichage de la galerie.
 * - grid : grille de miniatures
 * - list : tableau avec colonnes (nom, dossier, tags, type, taille, date)
 */
export type MediaViewMode = 'grid' | 'list'
