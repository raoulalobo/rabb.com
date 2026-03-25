/**
 * @file components/landing/FeatureGrid.tsx
 * @description Bento grid asymétrique des fonctionnalités pour la homepage.
 *   Layout inspiré du style "bento box" : cards de tailles variables
 *   créant une hiérarchie visuelle naturelle.
 *
 *   - 2 grandes cards (calendrier, analytics) — 2 colonnes de large
 *   - 4 cards standard (queue, galerie, hashtags, réseaux)
 *   - Screenshots plein cadre sans mini-navigateur
 *   - Fond sombre sur les grandes cards pour le contraste
 *
 * @example
 *   <FeatureGrid />
 */

'use client'

import { motion } from 'framer-motion'
import {
  BarChart2,
  CalendarDays,
  Images,
  ListOrdered,
  Settings,
} from 'lucide-react'
import Image from 'next/image'

// ─── Données des features ────────────────────────────────────────────────────

interface Feature {
  id: string
  label: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  screenshot: string
  /** Si true, la card prend 2 colonnes (grande) */
  wide: boolean
  /** Style de la card */
  style: 'dark' | 'light'
}

const FEATURES: Feature[] = [
  {
    id: 'calendar',
    label: 'Calendrier & Compositeur',
    description: 'Planifiez vos posts sur un mois. Composez directement depuis le calendrier avec l\'éditeur multi-plateforme intégré.',
    icon: CalendarDays,
    screenshot: '/screenshots/compose.png',
    wide: true,
    style: 'dark',
  },
  {
    id: 'queue',
    label: 'File d\'attente',
    description: 'Créneaux récurrents pour publier automatiquement chaque semaine.',
    icon: ListOrdered,
    screenshot: '/screenshots/settings.png',
    wide: false,
    style: 'light',
  },
  {
    id: 'gallery',
    label: 'Galerie média',
    description: 'Bibliothèque de photos et vidéos réutilisables avec dossiers et tags.',
    icon: Images,
    screenshot: '/screenshots/gallery.png',
    wide: false,
    style: 'light',
  },
  {
    id: 'analytics',
    label: 'Analytics',
    description: '11 visualisations, comparaison périodique, export CSV, créneaux recommandés — comprenez ce qui fonctionne.',
    icon: BarChart2,
    screenshot: '/screenshots/analytics.png',
    wide: true,
    style: 'dark',
  },
  {
    id: 'settings',
    label: 'Réseaux connectés',
    description: 'Connectez Instagram, TikTok, YouTube, Facebook et 6 autres en 30 secondes.',
    icon: Settings,
    screenshot: '/screenshots/settings.png',
    wide: false,
    style: 'light',
  },
]

// ─── Composant ────────────────────────────────────────────────────────────────

/**
 * Bento grid des fonctionnalités avec cards asymétriques.
 * Les features principales (calendrier, analytics) sont en grand format (2 colonnes).
 */
export function FeatureGrid(): React.JSX.Element {
  return (
    <div className="mx-auto max-w-6xl px-6">
      {/* Titre de section */}
      <motion.div
        className="mb-12 text-center"
        initial={{ opacity: 0, y: 10 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.4 }}
      >
        <p className="mb-3 text-sm font-medium uppercase tracking-widest text-gray-400">
          Fonctionnalités
        </p>
        <h2 className="text-3xl font-bold tracking-tight text-gray-900 lg:text-4xl">
          Tout ce dont vous avez besoin
        </h2>
      </motion.div>

      {/* Bento grid : 4 colonnes desktop, 2 tablette, 1 mobile */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {FEATURES.map((feature, index) => {
          const Icon = feature.icon
          const isDark = feature.style === 'dark'
          const colSpan = feature.wide ? 'sm:col-span-2' : ''

          return (
            <motion.div
              key={feature.id}
              className={`group relative overflow-hidden rounded-2xl border ${colSpan} ${
                isDark
                  ? 'border-gray-800 bg-gray-950 text-white'
                  : 'border-gray-200 bg-white text-gray-900'
              }`}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: index * 0.06 }}
            >
              {/* ── Contenu texte ──────────────────────────────────────── */}
              <div className="p-5 pb-3">
                {/* Icône + label */}
                <div className="mb-2 flex items-center gap-2.5">
                  <Icon className={`size-5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
                  <h3 className="text-sm font-semibold">{feature.label}</h3>
                </div>

                {/* Description */}
                <p className={`text-sm leading-relaxed ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  {feature.description}
                </p>
              </div>

              {/* ── Screenshot plein cadre ─────────────────────────────── */}
              {/* Mobile : bord à bord (pas de mx) + aspect 16/10 (screenshot bien visible)
                  Desktop : petites marges + aspect adapté (2/1 pour les larges, 4/3 pour les standard) */}
              <div className={`relative overflow-hidden border-t sm:mx-3 sm:mb-3 sm:rounded-lg sm:border ${
                isDark ? 'border-gray-800' : 'border-gray-100'
              } transition-transform duration-300 group-hover:scale-[1.01]`}>
                <div className={`relative ${feature.wide ? 'aspect-[16/10] sm:aspect-[2/1]' : 'aspect-[16/10] sm:aspect-[4/3]'}`}>
                  <Image
                    src={feature.screenshot}
                    alt={`${feature.label} — capture d'écran`}
                    fill
                    className="object-cover object-top"
                    sizes={feature.wide
                      ? '(max-width: 640px) 100vw, (max-width: 1024px) 100vw, 50vw'
                      : '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw'
                    }
                  />
                </div>
              </div>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}
