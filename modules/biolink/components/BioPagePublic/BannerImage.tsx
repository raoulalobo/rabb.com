/**
 * @file modules/biolink/components/BioPagePublic/BannerImage.tsx
 * @module biolink
 * @description Image bannière pleine largeur affichée en haut de la page
 *   publique Bio Link. L'image est rendue en ratio 16/5 (format panoramique)
 *   avec un recadrage automatique (object-cover) et un chargement différé
 *   (lazy loading) pour optimiser les performances.
 *
 *   Ce composant est utilisé quand la BioPage a un `bannerUrl` défini.
 *   Il est positionné au-dessus de l'avatar et du titre dans BioPageView.
 *
 * @example
 *   // Bannière simple
 *   <BannerImage url="https://example.com/banner.jpg" />
 *
 * @example
 *   // Bannière avec texte alternatif personnalisé
 *   <BannerImage url="https://example.com/banner.jpg" alt="Ma bannière de profil" />
 *
 * @example
 *   // Intégration conditionnelle dans BioPageView
 *   {page.bannerUrl && <BannerImage url={page.bannerUrl} alt={page.title ?? 'Bannière'} />}
 */

'use client'

// ─── Props ────────────────────────────────────────────────────────────────────

interface BannerImageProps {
  /** URL de l'image bannière à afficher */
  url: string
  /** Texte alternatif pour l'accessibilite (defaut: "Banniere") */
  alt?: string
}

// ─── Composant ────────────────────────────────────────────────────────────────

/**
 * Image bannière panoramique en haut de la page Bio Link.
 * Rendue en ratio 16/5, pleine largeur, avec coins arrondis et lazy loading.
 *
 * @param url - URL de l'image bannière
 * @param alt - Texte alternatif pour l'accessibilite (defaut: "Banniere")
 * @returns Element img stylise en banniere panoramique
 */
export function BannerImage({ url, alt = 'Bannière' }: BannerImageProps): React.JSX.Element {
  return (
    // Image bannière avec ratio panoramique 16:5 et recadrage automatique
    <img
      src={url}
      alt={alt}
      loading="lazy"
      className="w-full rounded-lg object-cover"
      // Ratio 16/5 pour un format bannière panoramique (plus large que 16:9)
      style={{ aspectRatio: '16/5' }}
    />
  )
}
