/**
 * @file modules/biolink/components/BioPagePublic/BioLinksRenderer.tsx
 * @module biolink
 * @description Composant partagé pour le rendu des liens d'une BioPage.
 *   Encapsule le switch sur `link.type` (link, header, separator, video, music)
 *   pour éviter la duplication entre BioPageView et LivePreview.
 *
 *   En mode preview (`isPreview=true`), affiche des placeholders simplifiés
 *   pour les embeds vidéo/musique et n'active pas le tracking de clics.
 *
 * @example
 *   <BioLinksRenderer
 *     links={activeLinks}
 *     bioPageId="bp_1"
 *     buttonVariantClass="bg-gray-100 hover:bg-gray-200"
 *     buttonShapeClass="rounded-lg"
 *     hoverClass="hover:scale-105"
 *     linkColor={null}
 *     spacingClass="space-y-3"
 *   />
 */

'use client'

import type { BioLink } from '@/modules/biolink/types'

import { BioHeader } from './BioHeader'
import { BioLinkButton } from './BioLinkButton'
import { BioMusicEmbed } from './BioMusicEmbed'
import { BioSeparator } from './BioSeparator'
import { BioVideoEmbed } from './BioVideoEmbed'

// ─── Props ────────────────────────────────────────────────────────────────────

interface BioLinksRendererProps {
  /** Liste des liens actifs à afficher */
  links: BioLink[]
  /** ID de la BioPage (pour le tracking des clics — absent en preview) */
  bioPageId?: string
  /** Classes Tailwind de la variante de bouton (filled/outline/shadow) */
  buttonVariantClass: string
  /** Classes Tailwind de la forme de bouton (rounded-lg/full/none) */
  buttonShapeClass: string
  /** Classes Tailwind de l'animation au survol */
  hoverClass: string
  /** Couleur hex personnalisée du texte des liens (null = thème) */
  linkColor: string | null
  /** Classes Tailwind d'espacement entre les liens (space-y-2/3/4) */
  spacingClass: string
  /** Mode aperçu miniature — placeholders simplifiés, pas de tracking */
  isPreview?: boolean
}

// ─── Composant ────────────────────────────────────────────────────────────────

/**
 * Rendu de la liste des liens d'une BioPage.
 * Switch sur le type de chaque lien pour afficher le composant adéquat :
 * - link      → BioLinkButton (avec tracking si bioPageId fourni)
 * - header    → BioHeader (titre de section)
 * - separator → BioSeparator (ligne horizontale)
 * - video     → BioVideoEmbed ou placeholder en preview
 * - music     → BioMusicEmbed ou placeholder en preview
 *
 * @param links              - Liens actifs triés par position
 * @param bioPageId          - ID de la page (tracking — optionnel en preview)
 * @param buttonVariantClass - Classes CSS de la variante de bouton
 * @param buttonShapeClass   - Classes CSS de la forme de bouton
 * @param hoverClass         - Classes CSS de l'animation hover
 * @param linkColor          - Couleur hex personnalisée des liens
 * @param spacingClass       - Classes CSS d'espacement vertical
 * @param isPreview          - Si true, affiche des placeholders simplifiés
 * @returns Conteneur avec tous les liens rendus
 */
export function BioLinksRenderer({
  links,
  bioPageId,
  buttonVariantClass,
  buttonShapeClass,
  hoverClass,
  linkColor,
  spacingClass,
  isPreview = false,
}: BioLinksRendererProps): React.JSX.Element {
  // Message vide si aucun lien (uniquement en mode preview)
  if (links.length === 0 && isPreview) {
    return (
      <div className={spacingClass}>
        <p className="text-xs opacity-40 py-4 text-center">
          Ajoutez des liens pour les voir ici
        </p>
      </div>
    )
  }

  return (
    <div className={spacingClass}>
      {links.map((link) => {
        switch (link.type) {
          // Titre de section
          case 'header':
            return isPreview ? (
              <div key={link.id} className="py-1 text-xs font-bold opacity-90">
                {link.title}
              </div>
            ) : (
              <BioHeader key={link.id} title={link.title} />
            )

          // Séparateur horizontal
          case 'separator':
            return isPreview ? (
              <hr key={link.id} className="border-current opacity-20 my-1" />
            ) : (
              <BioSeparator key={link.id} />
            )

          // Embed vidéo YouTube/TikTok
          case 'video':
            if (!link.url) return null
            return isPreview ? (
              <div
                key={link.id}
                className="w-full rounded-lg bg-black/20 flex items-center justify-center text-xs opacity-60"
                style={{ aspectRatio: '16/9' }}
              >
                ▶ {link.title}
              </div>
            ) : (
              <BioVideoEmbed key={link.id} url={link.url} title={link.title} />
            )

          // Embed musique Spotify
          case 'music':
            if (!link.url) return null
            return isPreview ? (
              <div
                key={link.id}
                className="w-full h-[40px] rounded-lg bg-black/20 flex items-center justify-center text-xs opacity-60"
              >
                ♫ {link.title}
              </div>
            ) : (
              <BioMusicEmbed key={link.id} url={link.url} title={link.title} />
            )

          // Bouton-lien classique (défaut)
          case 'link':
          default:
            if (!link.url) return null
            // En preview : pas de tracking, rendu simplifié
            if (isPreview) {
              return (
                <div
                  key={link.id}
                  className={`w-full px-3 py-2 text-center text-xs font-medium transition-all ${buttonVariantClass} ${buttonShapeClass} ${hoverClass}`}
                  style={linkColor ? { color: linkColor } : undefined}
                >
                  <span className="flex items-center justify-center gap-1.5">
                    {link.icon && <span>{link.icon}</span>}
                    <span className="truncate">{link.title}</span>
                  </span>
                </div>
              )
            }
            // En page publique : BioLinkButton avec tracking
            return (
              <BioLinkButton
                key={link.id}
                link={link}
                bioPageId={bioPageId ?? ''}
                className={`${buttonVariantClass} ${buttonShapeClass} ${hoverClass}`}
                linkColor={linkColor}
              />
            )
        }
      })}
    </div>
  )
}
