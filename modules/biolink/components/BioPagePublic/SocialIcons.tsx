/**
 * @file modules/biolink/components/BioPagePublic/SocialIcons.tsx
 * @module biolink
 * @description Barre d'icônes de réseaux sociaux affichée en bas de la BioPage publique.
 *   Chaque icône est un lien externe vers le profil de l'utilisateur sur la plateforme.
 *   Les icônes utilisent Lucide React pour les plateformes supportées.
 *
 * @example
 *   <SocialIcons
 *     links={[
 *       { platform: 'instagram', url: 'https://instagram.com/monpseudo' },
 *       { platform: 'youtube', url: 'https://youtube.com/@monpseudo' },
 *     ]}
 *     iconClassName="text-gray-500 hover:text-gray-700"
 *   />
 */

'use client'

import {
  Facebook,
  Globe,
  Instagram,
  Twitter,
  Youtube,
} from 'lucide-react'

import type { BioSocialLink } from '@/modules/biolink/types'

// ─── Mapping plateforme → icône ───────────────────────────────────────────────

/**
 * Dictionnaire associant chaque identifiant de plateforme à son icône Lucide.
 * Les plateformes non listées utilisent l'icône Globe (générique).
 */
const PLATFORM_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  instagram: Instagram,
  youtube: Youtube,
  facebook: Facebook,
  twitter: Twitter,
  // TikTok et autres n'ont pas d'icône Lucide native → Globe par défaut
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface SocialIconsProps {
  /** Tableau de liens sociaux à afficher */
  links: BioSocialLink[]
  /** Classes Tailwind appliquées sur chaque icône (couleur, hover) */
  iconClassName?: string
}

// ─── Composant ────────────────────────────────────────────────────────────────

/**
 * Barre d'icônes de réseaux sociaux pour la page publique Bio Link.
 * Chaque icône est un lien externe (target="_blank") vers le profil de la plateforme.
 *
 * @param links         - Tableau de { platform, url }
 * @param iconClassName - Classes Tailwind pour les icônes (style du thème)
 * @returns Div flex contenant les icônes, ou null si aucun lien
 */
export function SocialIcons({ links, iconClassName = '' }: SocialIconsProps): React.JSX.Element | null {
  if (!links.length) return null

  return (
    <div className="flex items-center justify-center gap-2 sm:gap-4 pt-6">
      {links.map(({ platform, url, color }) => {
        // Icône spécifique ou Globe par défaut
        const Icon = PLATFORM_ICONS[platform] ?? Globe

        return (
          <a
            key={`${platform}-${url}`}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Profil ${platform}`}
            className={`transition-colors ${color ? '' : iconClassName}`}
            style={color ? { color } : undefined}
          >
            <Icon className="size-5" />
          </a>
        )
      })}
    </div>
  )
}
