/**
 * @file components/landing/FeatureGrid.tsx
 * @description Grille de cards features pour la homepage.
 *   Affiche les 7 fonctionnalités principales avec icône, label, description
 *   et screenshot dans un cadre navigateur. Animation d'entrée au scroll.
 *
 *   Layout : 4 colonnes desktop, 2 tablette, 1 mobile.
 *   Première ligne : 4 cards (composer, calendar, queue, analytics)
 *   Deuxième ligne : 3 cards centrées (gallery, signatures, settings)
 *
 * @example
 *   <FeatureGrid />
 */

'use client'

import { motion } from 'framer-motion'
import {
  BarChart2,
  CalendarDays,
  FileSignature,
  Images,
  ListOrdered,
  Settings,
} from 'lucide-react'
import Image from 'next/image'

// ─── Données des features ────────────────────────────────────────────────────

const FEATURES = [
  {
    id: 'calendar',
    label: 'Calendrier & Compositeur',
    description: 'Planifiez vos posts sur un mois et composez directement depuis le calendrier',
    icon: CalendarDays,
    screenshot: '/screenshots/compose.png',
    color: 'from-violet-500/20 to-violet-600/5',
    iconColor: 'text-violet-600',
  },
  {
    id: 'queue',
    label: 'File d\'attente',
    description: 'Programmez vos créneaux récurrents automatiques',
    icon: ListOrdered,
    screenshot: '/screenshots/compose.png',
    color: 'from-amber-500/20 to-amber-600/5',
    iconColor: 'text-amber-600',
  },
  {
    id: 'analytics',
    label: 'Analytics',
    description: '11 visualisations de vos performances',
    icon: BarChart2,
    screenshot: '/screenshots/analytics.png',
    color: 'from-emerald-500/20 to-emerald-600/5',
    iconColor: 'text-emerald-600',
  },
  {
    id: 'gallery',
    label: 'Galerie média',
    description: 'Centralisez vos photos et vidéos',
    icon: Images,
    screenshot: '/screenshots/gallery.png',
    color: 'from-pink-500/20 to-pink-600/5',
    iconColor: 'text-pink-600',
  },
  {
    id: 'signatures',
    label: 'Hashtags',
    description: 'Blocs réutilisables par plateforme',
    icon: FileSignature,
    screenshot: '/screenshots/signatures.png',
    color: 'from-cyan-500/20 to-cyan-600/5',
    iconColor: 'text-cyan-600',
  },
  {
    id: 'settings',
    label: 'Réseaux',
    description: 'Connectez Instagram, TikTok, YouTube, Facebook...',
    icon: Settings,
    screenshot: '/screenshots/settings.png',
    color: 'from-gray-500/20 to-gray-600/5',
    iconColor: 'text-gray-600',
  },
] as const

// ─── Composant ────────────────────────────────────────────────────────────────

/**
 * Grille de cards features avec screenshots et animations d'entrée au scroll.
 */
export function FeatureGrid(): React.JSX.Element {
  return (
    <div className="mx-auto max-w-6xl px-6">
      {/* Titre de section */}
      <motion.p
        className="mb-8 text-center text-sm font-medium uppercase tracking-widest text-gray-400"
        initial={{ opacity: 0, y: 10 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.4 }}
      >
        Tout ce dont vous avez besoin
      </motion.p>

      {/* Grille responsive */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {FEATURES.map((feature, index) => {
          const Icon = feature.icon
          return (
            <motion.div
              key={feature.id}
              className={`group relative overflow-hidden rounded-2xl border border-gray-100 bg-gradient-to-b ${feature.color} p-5 transition-shadow hover:shadow-lg`}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: index * 0.06 }}
            >
              {/* En-tête : icône + label */}
              <div className="mb-3 flex items-center gap-2.5">
                <div className={`flex size-8 items-center justify-center rounded-lg bg-white shadow-sm ${feature.iconColor}`}>
                  <Icon className="size-4" />
                </div>
                <h3 className="text-sm font-semibold text-gray-900">{feature.label}</h3>
              </div>

              {/* Description */}
              <p className="mb-4 text-xs leading-relaxed text-gray-500">
                {feature.description}
              </p>

              {/* Screenshot dans un mini cadre */}
              <div className="overflow-hidden rounded-lg border border-gray-200/60 bg-white shadow-sm transition-transform duration-300 group-hover:scale-[1.02]">
                {/* Barre de titre mini */}
                <div className="flex items-center gap-1 border-b border-gray-100 px-2 py-1">
                  <div className="size-1.5 rounded-full bg-red-400" />
                  <div className="size-1.5 rounded-full bg-amber-400" />
                  <div className="size-1.5 rounded-full bg-green-400" />
                </div>
                {/* Image */}
                <div className="relative aspect-[16/10]">
                  <Image
                    src={feature.screenshot}
                    alt={`Capture d'écran ${feature.label}`}
                    fill
                    className="object-cover object-top"
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
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
