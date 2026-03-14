/**
 * @file modules/biolink/components/BioPagePublic/BioMusicEmbed.tsx
 * @module biolink
 * @description Embed Spotify compact affiché sur la page publique Bio Link.
 *   Correspond au type de lien "music". Le composant extrait le type de contenu
 *   (track, album, playlist, episode) et l'identifiant depuis l'URL Spotify,
 *   puis génère un lecteur intégré compact (hauteur 80px).
 *
 *   Format supporté :
 *   - https://open.spotify.com/{type}/{id}
 *     avec type = track | album | playlist | episode
 *
 *   Si l'URL n'est pas reconnue comme une URL Spotify valide,
 *   un lien de secours cliquable est affiché.
 *
 * @example
 *   // Embed d'un track Spotify
 *   <BioMusicEmbed url="https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC" title="Ma chanson" />
 *
 * @example
 *   // Embed d'une playlist Spotify
 *   <BioMusicEmbed url="https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M" title="Ma playlist" />
 */

'use client'

// ─── Props ────────────────────────────────────────────────────────────────────

interface BioMusicEmbedProps {
  /** URL Spotify du contenu à intégrer (track, album, playlist ou episode) */
  url: string
  /** Titre du contenu (utilisé pour l'attribut title de l'iframe et le lien de secours) */
  title: string
}

// ─── Utilitaire d'extraction ──────────────────────────────────────────────────

/**
 * Extrait le type de contenu et l'identifiant depuis une URL Spotify.
 * Les types reconnus : track, album, playlist, episode.
 *
 * @param url - URL Spotify complète (ex: https://open.spotify.com/track/ABC123)
 * @returns Objet { type, id } ou null si l'URL n'est pas reconnue
 *
 * @example
 *   extractSpotifyUri('https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC')
 *   // → { type: 'track', id: '4uLU6hMCjMI75M1A2tKUQC' }
 *
 *   extractSpotifyUri('https://example.com/not-spotify')
 *   // → null
 */
function extractSpotifyUri(url: string): { type: string; id: string } | null {
  // Pattern : open.spotify.com/{type}/{id} — le type doit être l'un des 4 reconnus
  // L'ID Spotify est une chaîne alphanumérique (base62)
  const match = url.match(/open\.spotify\.com\/(track|album|playlist|episode)\/([a-zA-Z0-9]+)/)

  if (!match) return null

  return {
    type: match[1],  // track, album, playlist ou episode
    id: match[2],    // identifiant Spotify unique
  }
}

// ─── Composant ────────────────────────────────────────────────────────────────

/**
 * Lecteur Spotify compact intégré à la page Bio Link.
 * Affiche un iframe de 80px de hauteur avec le lecteur embed Spotify.
 *
 * Le composant tente d'extraire le type et l'ID depuis l'URL fournie.
 * Si l'URL n'est pas une URL Spotify valide, un lien de secours est affiché.
 *
 * @param url   - URL Spotify du contenu (track, album, playlist, episode)
 * @param title - Titre affiché dans l'attribut title de l'iframe
 * @returns Iframe Spotify compact ou lien de secours
 */
export function BioMusicEmbed({ url, title }: BioMusicEmbedProps): React.JSX.Element {
  // Extraire le type de contenu et l'identifiant depuis l'URL
  const spotify = extractSpotifyUri(url)

  // ── Lien de secours si l'URL Spotify n'est pas reconnue ────────────────
  if (!spotify) {
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

  // Construire l'URL d'embed Spotify : open.spotify.com/embed/{type}/{id}
  const embedUrl = `https://open.spotify.com/embed/${spotify.type}/${spotify.id}`

  // ── Iframe compact Spotify (hauteur 80px) ──────────────────────────────
  return (
    <div className="w-full overflow-hidden rounded-lg">
      <iframe
        src={embedUrl}
        title={title}
        width="100%"
        height={80}
        className="rounded-lg"
        // Permissions nécessaires pour le lecteur Spotify intégré
        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
        loading="lazy"
      />
    </div>
  )
}
