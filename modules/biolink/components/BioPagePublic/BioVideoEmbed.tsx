/**
 * @file modules/biolink/components/BioPagePublic/BioVideoEmbed.tsx
 * @module biolink
 * @description Embed vidéo responsive (YouTube / TikTok) affiché sur la page
 *   publique Bio Link. Correspond au type de lien "video".
 *
 *   Le composant extrait automatiquement l'identifiant de la vidéo depuis l'URL
 *   fournie, puis génère l'URL d'embed appropriée selon la plateforme.
 *
 *   Formats YouTube supportés :
 *   - https://www.youtube.com/watch?v=VIDEO_ID
 *   - https://youtu.be/VIDEO_ID
 *   - https://www.youtube.com/shorts/VIDEO_ID
 *
 *   Format TikTok supporté :
 *   - https://www.tiktok.com/@username/video/VIDEO_ID
 *
 *   Si l'URL n'est pas reconnue, un lien de secours cliquable est affiché.
 *
 * @example
 *   // Embed YouTube classique
 *   <BioVideoEmbed url="https://www.youtube.com/watch?v=dQw4w9WgXcQ" title="Ma vidéo" />
 *
 * @example
 *   // Embed YouTube Short
 *   <BioVideoEmbed url="https://www.youtube.com/shorts/abc123" title="Mon short" />
 *
 * @example
 *   // Embed TikTok
 *   <BioVideoEmbed url="https://www.tiktok.com/@user/video/7123456789" title="Mon TikTok" />
 */

'use client'

// ─── Props ────────────────────────────────────────────────────────────────────

interface BioVideoEmbedProps {
  /** URL de la vidéo YouTube ou TikTok à intégrer */
  url: string
  /** Titre de la vidéo (utilisé pour l'attribut title de l'iframe et le lien de secours) */
  title: string
}

// ─── Utilitaires d'extraction ─────────────────────────────────────────────────

/**
 * Extrait l'identifiant de la vidéo YouTube depuis différents formats d'URL.
 * Supporte les formats watch, youtu.be et shorts.
 *
 * @param url - URL YouTube complète
 * @returns Identifiant de la vidéo ou null si non reconnu
 *
 * @example
 *   extractYouTubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ') // → 'dQw4w9WgXcQ'
 *   extractYouTubeId('https://youtu.be/dQw4w9WgXcQ')                // → 'dQw4w9WgXcQ'
 *   extractYouTubeId('https://www.youtube.com/shorts/abc123')        // → 'abc123'
 */
function extractYouTubeId(url: string): string | null {
  // Pattern 1 : youtube.com/watch?v=VIDEO_ID (paramètre v dans la query string)
  const watchMatch = url.match(/(?:youtube\.com\/watch\?.*v=)([a-zA-Z0-9_-]{11})/)
  if (watchMatch) return watchMatch[1]

  // Pattern 2 : youtu.be/VIDEO_ID (URL courte partagée)
  const shortMatch = url.match(/(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/)
  if (shortMatch) return shortMatch[1]

  // Pattern 3 : youtube.com/shorts/VIDEO_ID (YouTube Shorts)
  const shortsMatch = url.match(/(?:youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/)
  if (shortsMatch) return shortsMatch[1]

  return null
}

/**
 * Extrait l'identifiant de la vidéo TikTok depuis l'URL.
 * Format attendu : tiktok.com/@username/video/VIDEO_ID
 *
 * @param url - URL TikTok complète
 * @returns Identifiant numérique de la vidéo ou null si non reconnu
 *
 * @example
 *   extractTikTokId('https://www.tiktok.com/@user/video/7123456789') // → '7123456789'
 */
function extractTikTokId(url: string): string | null {
  // Pattern : tiktok.com/@user/video/ID (l'ID est un nombre long)
  const match = url.match(/tiktok\.com\/@[^/]+\/video\/(\d+)/)
  return match ? match[1] : null
}

// ─── Composant ────────────────────────────────────────────────────────────────

/**
 * Embed vidéo responsive pour YouTube et TikTok.
 * Tente d'extraire l'identifiant de la vidéo depuis l'URL fournie,
 * puis affiche un iframe en ratio 16:9 avec l'URL d'embed correspondante.
 *
 * Si l'URL n'est pas reconnue comme YouTube ou TikTok, un lien de secours
 * cliquable est affiché à la place de l'iframe.
 *
 * @param url   - URL de la vidéo source (YouTube ou TikTok)
 * @param title - Titre affiché dans l'attribut title de l'iframe
 * @returns Iframe responsive ou lien de secours
 */
export function BioVideoEmbed({ url, title }: BioVideoEmbedProps): React.JSX.Element {
  // Tenter d'extraire l'ID YouTube en premier
  const youtubeId = extractYouTubeId(url)

  // Si ce n'est pas YouTube, tenter TikTok
  const tiktokId = !youtubeId ? extractTikTokId(url) : null

  // Construire l'URL d'embed selon la plateforme détectée
  const embedUrl = youtubeId
    ? `https://www.youtube.com/embed/${youtubeId}`
    : tiktokId
      ? `https://www.tiktok.com/embed/v2/${tiktokId}`
      : null

  // ── Lien de secours si aucune plateforme reconnue ──────────────────────
  if (!embedUrl) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="block w-full rounded-lg px-4 py-3 text-center text-sm opacity-80 underline"
      >
        {/* Afficher le titre comme texte du lien de secours */}
        {title}
      </a>
    )
  }

  // ── Iframe responsive en ratio 16:9 ───────────────────────────────────
  return (
    <div className="w-full overflow-hidden rounded-lg">
      {/* Conteneur avec aspect-ratio 16:9 pour un rendu responsive */}
      <div className="relative w-full" style={{ aspectRatio: '16/9' }}>
        <iframe
          src={embedUrl}
          title={title}
          className="absolute inset-0 h-full w-full"
          // Permissions minimales pour la sécurité et les fonctionnalités d'embed
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    </div>
  )
}
