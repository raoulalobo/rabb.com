/**
 * @file modules/biolink/components/BioPagePublic/layouts/LayoutRouter.tsx
 * @module biolink
 * @description Routeur de layout pour la BioPage.
 *   Switch sur le champ `headerStyle` de la page pour rendre le layout approprié.
 *   Composant central qui connecte le choix de layout aux composants concrets.
 *
 *   Layouts disponibles :
 *   - classic  → ClassicLayout (défaut historique)
 *   - hero     → HeroLayout (image/gradient plein écran + overlay)
 *   - banner   → BannerLayout (image 16:9 + carte flottante)
 *   - minimal  → MinimalLayout (texte-first, pas d'avatar, social en bas)
 *   - card     → CardLayout (carte glassmorphism centrée)
 *
 * @example
 *   <LayoutRouter
 *     headerStyle="hero"
 *     page={page}
 *     links={activeLinks}
 *     theme={theme}
 *     avatarShapeClass="rounded-full"
 *     spacingClass="space-y-3"
 *     buttonShapeClass="rounded-lg"
 *     hoverClass="hover:scale-105"
 *     buttonVariantClass="bg-gray-100 hover:bg-gray-200"
 *     isPreview={false}
 *   />
 */

'use client'

import type { BioHeaderStyle } from '@/modules/biolink/schemas/biolink.schema'

import { BannerLayout } from './BannerLayout'
import { CardLayout } from './CardLayout'
import { ClassicLayout } from './ClassicLayout'
import { HeroLayout } from './HeroLayout'
import { MinimalLayout } from './MinimalLayout'
import type { LayoutProps } from './types'

// ─── Props ────────────────────────────────────────────────────────────────────

interface LayoutRouterProps extends LayoutProps {
  /** Style de layout à utiliser (classic, hero, banner, minimal, card) */
  headerStyle: string
}

// ─── Composant ────────────────────────────────────────────────────────────────

/**
 * Routeur de layout : sélectionne le composant de layout selon headerStyle.
 * Fallback sur ClassicLayout si la valeur est inconnue ou indéfinie.
 *
 * @param headerStyle - Identifiant du layout (classic, hero, banner, minimal, card)
 * @param props       - Props communes transmises au layout sélectionné
 * @returns Le composant de layout approprié
 */
export function LayoutRouter({ headerStyle, ...props }: LayoutRouterProps): React.JSX.Element {
  switch (headerStyle as BioHeaderStyle) {
    case 'hero':
      return <HeroLayout {...props} />
    case 'banner':
      return <BannerLayout {...props} />
    case 'minimal':
      return <MinimalLayout {...props} />
    case 'card':
      return <CardLayout {...props} />
    case 'classic':
    default:
      return <ClassicLayout {...props} />
  }
}
