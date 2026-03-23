/**
 * @file components/landing/FeatureHighlight.tsx
 * @description Blocs détaillés alternés (image + texte) pour les 3 features clés.
 *   Chaque bloc alterne la position image/texte (gauche/droite).
 *   Animation d'entrée au scroll avec Framer Motion.
 *
 * @example
 *   <FeatureHighlights />
 */

'use client'

import { motion } from 'framer-motion'
import {
  BarChart2,
  CalendarDays,
  Check,
  PenLine,
} from 'lucide-react'
import Image from 'next/image'

// ─── Données des highlights ──────────────────────────────────────────────────

const HIGHLIGHTS = [
  {
    id: 'composer',
    title: 'Compositeur intelligent',
    subtitle: 'Un post, tous vos réseaux.',
    description:
      'Écrivez une fois, personnalisez par plateforme. L\'IA adapte votre contenu aux contraintes de chaque réseau.',
    bullets: [
      'Posts, Stories, Reels, Threads, Carrousels',
      'Contenu personnalisé par plateforme',
      'Assistance IA pour la rédaction',
      'Upload média avec drag & drop',
    ],
    screenshot: '/screenshots/compose.png',
    icon: PenLine,
    gradient: 'from-violet-600 to-indigo-600',
  },
  {
    id: 'analytics',
    title: 'Analytics complets',
    subtitle: 'Comprenez ce qui fonctionne.',
    description:
      'Suivez vos performances avec 11 visualisations. Comparez les périodes, exportez en CSV, découvrez vos meilleurs créneaux.',
    bullets: [
      '11 visualisations (heatmap, graphiques, tableaux)',
      'Comparaison vs période précédente',
      'Export CSV en un clic',
      'Créneaux de publication recommandés',
    ],
    screenshot: '/screenshots/analytics.png',
    icon: BarChart2,
    gradient: 'from-emerald-600 to-teal-600',
  },
  {
    id: 'planning',
    title: 'Planification automatique',
    subtitle: 'Publiez sans y penser.',
    description:
      'Calendrier mensuel + file d\'attente récurrente. Définissez vos créneaux, remplissez la file, les posts se programment tout seuls.',
    bullets: [
      'Calendrier mensuel avec vue complète',
      'Créneaux horaires récurrents (lundi 9h, mercredi 14h...)',
      'Création rapide par clic sur un jour',
      'Publication automatique via file d\'attente',
    ],
    screenshot: '/screenshots/compose.png',
    icon: CalendarDays,
    gradient: 'from-blue-600 to-sky-600',
  },
] as const

// ─── Composant ────────────────────────────────────────────────────────────────

/**
 * Blocs détaillés alternés pour les 3 features clés.
 * Position image/texte alternée pour créer du rythme visuel.
 */
export function FeatureHighlights(): React.JSX.Element {
  return (
    <div className="mx-auto max-w-6xl space-y-24 px-6">
      {HIGHLIGHTS.map((highlight, index) => {
        const Icon = highlight.icon
        const isReversed = index % 2 === 1

        return (
          <motion.div
            key={highlight.id}
            className={`flex flex-col items-center gap-12 lg:flex-row ${isReversed ? 'lg:flex-row-reverse' : ''}`}
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            {/* ── Texte ──────────────────────────────────────────────────────── */}
            <div className="flex-1 space-y-5">
              {/* Badge icône */}
              <div className={`inline-flex items-center gap-2 rounded-full bg-gradient-to-r ${highlight.gradient} px-3 py-1 text-xs font-medium text-white`}>
                <Icon className="size-3.5" />
                {highlight.title}
              </div>

              {/* Titre */}
              <h3 className="text-3xl font-bold tracking-tight text-gray-900 lg:text-4xl">
                {highlight.subtitle}
              </h3>

              {/* Description */}
              <p className="text-base leading-relaxed text-gray-500">
                {highlight.description}
              </p>

              {/* Bullets */}
              <ul className="space-y-2.5">
                {highlight.bullets.map((bullet) => (
                  <li key={bullet} className="flex items-start gap-2.5 text-sm text-gray-600">
                    <Check className="mt-0.5 size-4 shrink-0 text-emerald-500" />
                    {bullet}
                  </li>
                ))}
              </ul>
            </div>

            {/* ── Screenshot ─────────────────────────────────────────────────── */}
            <div className="flex-1">
              <motion.div
                className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl"
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: 0.2 }}
              >
                {/* Barre de titre navigateur */}
                <div className="flex items-center gap-1.5 border-b border-gray-100 px-3 py-2">
                  <div className="size-2.5 rounded-full bg-red-400" />
                  <div className="size-2.5 rounded-full bg-amber-400" />
                  <div className="size-2.5 rounded-full bg-green-400" />
                  <span className="ml-3 text-[10px] text-gray-400">ogolong.com</span>
                </div>
                {/* Image */}
                <div className="relative aspect-[16/10]">
                  <Image
                    src={highlight.screenshot}
                    alt={`${highlight.title} — capture d'écran`}
                    fill
                    className="object-cover object-top"
                    sizes="(max-width: 1024px) 100vw, 50vw"
                  />
                </div>
              </motion.div>
            </div>
          </motion.div>
        )
      })}
    </div>
  )
}
