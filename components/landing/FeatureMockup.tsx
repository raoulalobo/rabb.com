/**
 * @file components/landing/FeatureMockup.tsx
 * @module landing
 * @description Mockup visuel pour chaque fonctionnalité de la landing page.
 *
 *   Affiche une capture d'écran réelle du dashboard dans un "faux chrome"
 *   navigateur minimaliste (barre d'URL stylisée + trois boutons macOS).
 *
 *   Si la capture n'existe pas encore (`/public/screenshots/<id>.png`),
 *   un placeholder stylisé avec l'icône Lucide correspondante est affiché
 *   à la place — ce qui évite une erreur 404 ou un layout cassé.
 *
 *   Structure HTML :
 *   ```
 *   <div> ← conteneur carte (border, shadow, rounded)
 *     <div> ← barre chrome navigateur (3 boutons + URL factice)
 *     <div> ← zone screenshot ou placeholder
 *       <Image> ou <PlaceholderContent>
 *   ```
 *
 * @example
 * // Dans FeaturesSection.tsx
 * <FeatureMockup featureId="analytics" title="Analytics" />
 */

'use client'

import Image from 'next/image'
import {
  PenLine,
  BarChart2,
  Images,
  Settings2,
} from 'lucide-react'

import type { FeatureId } from './FeaturesSection'

// ─── Types ────────────────────────────────────────────────────────────────────

interface FeatureMockupProps {
  /** Identifiant de la fonctionnalité — détermine le screenshot à charger */
  featureId: FeatureId
  /** Libellé court utilisé pour l'attribut alt de l'image et l'URL factice */
  title: string
}

// ─── Données de configuration par feature ─────────────────────────────────────

/**
 * Configuration visuelle de chaque feature pour le mockup.
 * `path` : chemin relatif depuis /public vers le screenshot.
 * `url`  : URL factice affichée dans la barre chrome navigateur.
 * `icon` : composant Lucide affiché dans le placeholder quand le screenshot
 *          n'est pas encore disponible.
 */
const FEATURE_CONFIG: Record<
  FeatureId,
  {
    path: string
    url: string
    icon: React.ComponentType<{ className?: string }>
  }
> = {
  compose: {
    path: '/screenshots/compose.png',
    url: 'ogolong.com/compose',
    icon: PenLine,
  },
  analytics: {
    path: '/screenshots/analytics.png',
    url: 'ogolong.com/analytics',
    icon: BarChart2,
  },
  gallery: {
    path: '/screenshots/gallery.png',
    url: 'ogolong.com/gallery',
    icon: Images,
  },
  settings: {
    path: '/screenshots/settings.png',
    url: 'ogolong.com/settings',
    icon: Settings2,
  },
}

// ─── Sous-composant : barre chrome navigateur ─────────────────────────────────

/**
 * Barre chrome navigateur minimaliste style macOS.
 * Affiche les trois boutons de fenêtre (rouge/jaune/vert) et une URL factice.
 *
 * @param url - URL à afficher dans la barre d'adresse fictive
 */
function BrowserChrome({ url }: { url: string }): React.JSX.Element {
  return (
    <div className="flex items-center gap-3 border-b border-gray-100 bg-gray-50/80 px-4 py-3">
      {/* Trois boutons macOS (décoratifs, non interactifs) */}
      <div className="flex items-center gap-1.5" aria-hidden="true">
        <span className="size-3 rounded-full bg-red-400/70" />
        <span className="size-3 rounded-full bg-yellow-400/70" />
        <span className="size-3 rounded-full bg-green-400/70" />
      </div>

      {/* Barre d'URL factice — centrée visuellement grâce à flex-1 */}
      <div className="flex flex-1 items-center justify-center">
        <div className="flex items-center gap-1.5 rounded-md bg-white px-3 py-1.5 text-xs text-gray-400 shadow-sm ring-1 ring-gray-200/80">
          {/* Icône cadenas — indique HTTPS (décoratif) */}
          <svg
            className="size-3 shrink-0 text-gray-300"
            viewBox="0 0 12 12"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect x="2" y="5.5" width="8" height="5.5" rx="1" />
            <path d="M4 5.5V4a2 2 0 0 1 4 0v1.5" />
          </svg>
          {/* URL affichée */}
          <span className="font-mono">{url}</span>
        </div>
      </div>

      {/* Espace balancier à droite pour centrer la barre d'URL */}
      <div className="w-12" aria-hidden="true" />
    </div>
  )
}

// ─── Composant principal ──────────────────────────────────────────────────────

/**
 * Mockup navigateur affichant la capture d'écran d'une page du dashboard.
 *
 * Si le screenshot `/public/screenshots/<featureId>.png` n'existe pas,
 * affiche un placeholder avec l'icône Lucide de la feature.
 *
 * @param featureId - Identifiant de la feature (détermine screenshot + config)
 * @param title     - Libellé court pour l'attribut alt et la barre chrome
 * @returns Élément JSX du mockup navigateur
 *
 * @example
 * <FeatureMockup featureId="compose" title="Compose" />
 */
export function FeatureMockup({ featureId, title }: FeatureMockupProps): React.JSX.Element {
  const config = FEATURE_CONFIG[featureId]
  const Icon = config.icon

  return (
    /*
     * Carte conteneur : bord léger, ombre subtile, coins arrondis.
     * `overflow-hidden` empêche le screenshot de dépasser les coins arrondis.
     * `bg-white` contraste avec le fond gris de la section.
     */
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      {/* Barre chrome navigateur avec URL factice */}
      <BrowserChrome url={config.url} />

      {/* Zone de contenu : screenshot ou placeholder */}
      <div className="relative aspect-[16/10] w-full bg-gray-50">
        {/*
         * next/image avec `unoptimized={false}` (défaut) → WebP auto, lazy loading.
         * `fill` + `object-cover` : l'image remplit le conteneur sans distorsion.
         * En cas d'erreur (fichier manquant), onError remplace par le placeholder.
         *
         * NOTE : les screenshots sont générés par le script browser automation
         * et placés dans /public/screenshots/. S'ils n'existent pas encore,
         * le placeholder ci-dessous est affiché.
         */}
        {/*
         * z-10 obligatoire : l'image et le placeholder sont tous deux
         * `position: absolute` (fill). Le placeholder étant plus bas dans
         * le DOM, il apparaît par-dessus sans z-index explicite.
         * z-10 sur l'image → elle recouvre le placeholder quand elle charge.
         * onError → display:none → le placeholder (z-0 implicite) redevient visible.
         */}
        <Image
          src={config.path}
          alt={`Capture d'écran de la page ${title} du dashboard ogolong`}
          fill
          className="z-10 object-cover object-top"
          sizes="(max-width: 768px) 100vw, 50vw"
          // En cas d'erreur de chargement, on masque l'image (le placeholder apparaît)
          onError={(e) => {
            const target = e.target as HTMLImageElement
            target.style.display = 'none'
          }}
        />

        {/*
         * Placeholder : toujours présent dans le DOM (z-0 implicite).
         * Visible uniquement si l'image n'a pas encore chargé ou a échoué.
         */}
        <div
          className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-gray-50"
          aria-hidden="true"
        >
          {/* Damier décoratif en SVG data URI — très léger, pas de requête réseau */}
          <div
            className="absolute inset-0 opacity-30"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='16' height='16' viewBox='0 0 16 16' xmlns='http://www.w3.org/2000/svg'%3E%3Crect x='0' y='0' width='8' height='8' fill='%23e5e7eb' /%3E%3Crect x='8' y='8' width='8' height='8' fill='%23e5e7eb' /%3E%3C/svg%3E")`,
              backgroundRepeat: 'repeat',
              backgroundSize: '16px 16px',
            }}
          />
          {/* Icône centrée */}
          <div className="relative flex size-16 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-gray-200">
            <Icon className="size-8 text-gray-300" />
          </div>
          {/* Label discret */}
          <p className="relative text-sm font-medium text-gray-400">
            Capture bientôt disponible
          </p>
        </div>
      </div>
    </div>
  )
}
