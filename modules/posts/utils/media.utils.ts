/**
 * @file modules/posts/utils/media.utils.ts
 * @module posts
 * @description Utilitaires partagés pour la gestion des médias dans les posts.
 *   Extrait de AgentModalEdit pour être réutilisé dans AgentModalCreate et MediaPicker.
 *
 * @example
 *   import { isVideoUrl, formatFileSize } from '@/modules/posts/utils/media.utils'
 *
 *   isVideoUrl('https://...video.mp4')  // true
 *   isVideoUrl('https://...photo.jpg')  // false
 *   formatFileSize(1048576)             // "1,00 Mo"
 */

// ─── Constantes ────────────────────────────────────────────────────────────────

/**
 * Extensions de fichiers vidéo reconnues.
 * Utilisées pour détecter le type depuis l'URL (quand le mimeType n'est pas disponible).
 */
const VIDEO_EXTENSIONS = /\.(mp4|mov|avi|webm|mkv|m4v|ogv)$/i

// ─── Fonctions utilitaires ─────────────────────────────────────────────────────

/**
 * Détermine si une URL pointe vers un fichier vidéo selon son extension.
 * Les paramètres de query string sont ignorés (ex: ?token=…).
 *
 * @param url - URL du fichier (ex: "https://…/video.mp4?token=abc")
 * @returns `true` si l'extension correspond à une vidéo connue
 *
 * @example
 *   isVideoUrl('https://storage.supabase.co/…/clip.mp4')  // true
 *   isVideoUrl('https://storage.supabase.co/…/photo.jpg') // false
 *   isVideoUrl('https://storage.supabase.co/…/film.MOV')  // true (insensible à la casse)
 */
export function isVideoUrl(url: string): boolean {
  // Supprimer les paramètres de query string avant de tester l'extension
  return VIDEO_EXTENSIONS.test(url.split('?')[0])
}

/**
 * Formate une taille en octets en chaîne lisible (Ko, Mo, Go).
 *
 * @param bytes - Taille en octets
 * @returns Chaîne formatée avec l'unité appropriée
 *
 * @example
 *   formatFileSize(500)       // "500 o"
 *   formatFileSize(2048)      // "2,00 Ko"
 *   formatFileSize(1048576)   // "1,00 Mo"
 *   formatFileSize(1073741824) // "1,00 Go"
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} Ko`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} Mo`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} Go`
}
