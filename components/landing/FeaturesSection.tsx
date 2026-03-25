/**
 * @file components/landing/FeaturesSection.tsx
 * @module landing
 * @description Section "Fonctionnalités" de la landing page d'ogolong.
 *
 *   Présente les 4 rubriques principales du dashboard (Compose, Analytics,
 *   Galerie, Paramètres) via des tabs interactifs animés avec
 *   Framer Motion :
 *   - Pill glissante sur le tab actif (layoutId)
 *   - Transition de contenu avec AnimatePresence (mode "wait")
 *   - Entrée de la section au scroll (whileInView)
 *   - Stagger des éléments texte (variants)
 *   - Screenshot réel du dashboard dans un faux chrome navigateur
 *
 *   Responsive :
 *   - Desktop (md+) : tabs horizontaux, texte à gauche | mockup à droite
 *   - Mobile : tabs scrollables horizontalement, contenu empilé verticalement
 *
 * @example
 * // app/page.tsx
 * import { FeaturesSection } from '@/components/landing/FeaturesSection'
 * <FeaturesSection />
 */

'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Variants } from 'framer-motion'
import {
  PenLine,
  BarChart2,
  Images,
  Settings2,
} from 'lucide-react'

import { FeatureMockup } from './FeatureMockup'

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Identifiants des tabs (correspond aux routes du dashboard).
 */
export type FeatureId = 'compose' | 'analytics' | 'gallery' | 'settings'

/**
 * Structure d'un tab de fonctionnalité.
 */
interface Feature {
  /** Identifiant unique — utilisé comme clé d'animation et pour le mockup */
  id: FeatureId
  /** Icône Lucide affichée dans le tab */
  icon: React.ComponentType<{ className?: string }>
  /** Libellé court du tab */
  label: string
  /** Titre de la section contenu */
  title: string
  /** Description marketing courte */
  description: string
  /** Liste des interactions clés présentées sous forme de bullet points */
  bullets: string[]
}

// ─── Données ──────────────────────────────────────────────────────────────────

/**
 * Les 5 fonctionnalités principales présentées dans cette section.
 * Ordre : importance produit décroissante (compose en premier).
 */
const FEATURES: Feature[] = [
  {
    id: 'compose',
    icon: PenLine,
    label: 'Compose',
    title: "Décrivez, l'IA publie à votre place",
    description:
      "Dites simplement ce que vous voulez publier — en texte ou à voix haute. L'IA génère automatiquement les posts adaptés à chaque réseau : ton, longueur, hashtags, tout est ajusté.",
    bullets: [
      "Instruction en langage naturel ou dictée vocale (« 2 photos TikTok et Instagram demain 9h »)",
      "L'IA crée un post optimisé par plateforme en un seul clic",
      "Ajoutez vos images et vidéos — l'agent les intègre selon les règles de chaque réseau",
      "Modifiez n'importe quel post avec une simple instruction (« rends-le plus court »)",
    ],
  },
  {
    id: 'analytics',
    icon: BarChart2,
    label: 'Analytics',
    title: 'Suivez vos performances',
    description:
      'Visualisez vos impressions, likes et taux d\'engagement par plateforme. Identifiez vos meilleurs créneaux de publication et vos contenus les plus efficaces.',
    bullets: [
      'Métriques clés : impressions, portée, likes, commentaires, partages',
      'Heatmap des meilleurs créneaux horaires par jour et plateforme',
      'Courbe d\'évolution des abonnés sur la période sélectionnée',
      'Analyse de la décroissance de contenu (content decay)',
    ],
  },
  {
    id: 'gallery',
    icon: Images,
    label: 'Galerie',
    title: 'Centralisez vos médias',
    description:
      'Tous vos visuels et vidéos uploadés sont organisés dans une bibliothèque. Réutilisez-les directement dans le compositeur sans re-uploader.',
    bullets: [
      'Bibliothèque centralisée de tous vos médias uploadés',
      'Filtres par type (image, vidéo) et par date d\'upload',
      'Réutilisation directe dans le compositeur en un clic',
      'Stockage sécurisé via Supabase Storage',
    ],
  },
  {
    id: 'settings',
    icon: Settings2,
    label: 'Paramétrages',
    title: 'Gérez vos comptes connectés',
    description:
      'Connectez et déconnectez vos comptes sociaux en un clic via OAuth. Gérez votre profil, vos préférences et votre abonnement.',
    bullets: [
      'Connexion OAuth sécurisée pour chaque réseau social',
      'Gestion du profil : nom, avatar, email et mot de passe',
      'Révocation d\'accès plateforme par plateforme sans friction',
      'Préférences de notifications et récapitulatifs hebdomadaires',
    ],
  },
]

// ─── Variants Framer Motion ───────────────────────────────────────────────────

/**
 * Variants pour le conteneur de texte : déclenche le stagger des enfants.
 * `hidden` : pas de styles — le stagger se gère via `transition.staggerChildren`.
 * `show`   : active l'animation sur les enfants avec un délai entre chacun.
 */
const containerVariants: Variants = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.05,
    },
  },
}

/**
 * Variants pour chaque élément texte enfant (titre, description, bullet).
 * Apparaît en montant légèrement depuis le bas avec un fondu.
 * `ease` est typé `as const` pour satisfaire le type `Easing` de Framer Motion.
 */
const itemVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' as const } },
}

// ─── Composant ────────────────────────────────────────────────────────────────

/**
 * Section "Fonctionnalités" de la landing page.
 *
 * Tabs interactifs avec animation Framer Motion :
 * - Pill glissante sur le tab actif via `layoutId="active-tab-indicator"`
 * - Transition contenu via `AnimatePresence mode="wait"` + `key={activeTab}`
 * - Entrée section au scroll avec `whileInView`
 * - Stagger du texte avec `containerVariants` / `itemVariants`
 *
 * @returns Élément JSX de la section fonctionnalités
 *
 * @example
 * <FeaturesSection />
 */
export function FeaturesSection(): React.JSX.Element {
  // Tab actif — par défaut "compose" (première fonctionnalité)
  const [activeTab, setActiveTab] = useState<FeatureId>('compose')

  // Feature actuellement affichée (dérivée du state, pas stockée séparément)
  const activeFeature = FEATURES.find((f) => f.id === activeTab)!

  return (
    /*
     * La section entière apparaît en fondu + slide quand elle entre dans le
     * viewport. `once: true` évite de rejouer l'animation si l'utilisateur
     * remonte. `margin: '-100px'` déclenche l'animation un peu avant que
     * la section soit totalement visible.
     */
    <motion.section
      className="bg-gray-50/60 py-24"
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-100px' }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
      aria-labelledby="features-heading"
    >
      <div className="mx-auto max-w-6xl px-6">

        {/* ── En-tête de section ─────────────────────────────────────────────── */}
        <div className="mb-12 text-center">
          <p className="mb-3 text-sm font-medium uppercase tracking-widest text-gray-400">
            Fonctionnalités
          </p>
          <h2
            id="features-heading"
            className="text-balance text-4xl font-bold tracking-tight text-gray-900 md:text-5xl"
          >
            Tout ce qu&apos;il vous faut pour{' '}
            <span className="bg-gradient-to-r from-gray-900 to-gray-500 bg-clip-text text-transparent">
              publier plus vite
            </span>
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-balance text-lg leading-relaxed text-gray-500">
            Du compositeur aux statistiques, en passant par la galerie — chaque
            outil est conçu pour les créateurs solo qui veulent aller à l&apos;essentiel.
          </p>
        </div>

        {/* ── Tabs ──────────────────────────────────────────────────────────── */}
        {/*
         * Conteneur scrollable horizontalement sur mobile.
         * `overflow-x-auto` + `-mx-6 px-6` pour que la scrollbar déborde
         * sur les bords sur mobile sans rogner le contenu.
         * Sur desktop les tabs tiennent en une ligne.
         */}
        <div className="-mx-2 mb-8 overflow-x-auto px-2 pb-1">
          <div
            className="relative mx-auto inline-flex min-w-max items-center gap-1 rounded-xl bg-gray-100 p-1.5"
            role="tablist"
            aria-label="Fonctionnalités du dashboard"
          >
            {FEATURES.map((feature) => {
              const Icon = feature.icon
              const isActive = activeTab === feature.id

              return (
                <button
                  key={feature.id}
                  role="tab"
                  aria-selected={isActive}
                  aria-controls={`tabpanel-${feature.id}`}
                  id={`tab-${feature.id}`}
                  onClick={() => setActiveTab(feature.id)}
                  className={[
                    'relative flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium',
                    'transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2',
                    'focus-visible:ring-gray-900 focus-visible:ring-offset-1',
                    isActive ? 'text-gray-900' : 'text-gray-500 hover:text-gray-700',
                  ].join(' ')}
                >
                  {/*
                   * Pill blanche animée derrière le tab actif.
                   * `layoutId` permet à Framer Motion de faire glisser la pill
                   * du tab précédent vers le nouveau tab actif (layout animation).
                   * `transition spring` → effet physique naturel.
                   */}
                  {isActive && (
                    <motion.span
                      layoutId="active-tab-indicator"
                      className="absolute inset-0 rounded-lg bg-white shadow-sm"
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                      aria-hidden="true"
                    />
                  )}
                  {/* Contenu du tab : icône + libellé — au-dessus de la pill (z-10) */}
                  <span className="relative z-10 flex items-center gap-2">
                    <Icon className="size-4 shrink-0" aria-hidden="true" />
                    <span>{feature.label}</span>
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* ── Contenu du tab actif ───────────────────────────────────────────── */}
        {/*
         * AnimatePresence mode="wait" : attend que l'animation de sortie du
         * contenu précédent soit terminée avant de monter le nouveau.
         * La `key={activeTab}` force React à démonter/remonter le composant
         * à chaque changement de tab, ce qui déclenche les animations.
         */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            id={`tabpanel-${activeTab}`}
            role="tabpanel"
            aria-labelledby={`tab-${activeTab}`}
            className="grid grid-cols-1 gap-8 md:grid-cols-2 md:gap-12"
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
          >
            {/* ── Colonne texte ─────────────────────────────────────────────── */}
            {/*
             * Le conteneur texte utilise le stagger pattern :
             * `variants={containerVariants}` déclenche les enfants en cascade.
             * `initial="hidden"` + `animate="show"` pilotent l'état global.
             */}
            <motion.div
              className="flex flex-col justify-center"
              variants={containerVariants}
              initial="hidden"
              animate="show"
            >
              {/* Titre de la feature */}
              <motion.h3
                className="text-2xl font-bold tracking-tight text-gray-900 md:text-3xl"
                variants={itemVariants}
              >
                {activeFeature.title}
              </motion.h3>

              {/* Description courte */}
              <motion.p
                className="mt-4 text-base leading-relaxed text-gray-500"
                variants={itemVariants}
              >
                {activeFeature.description}
              </motion.p>

              {/* Bullet points des interactions clés */}
              <motion.ul
                className="mt-6 space-y-3"
                variants={itemVariants}
                aria-label={`Fonctionnalités de ${activeFeature.label}`}
              >
                {activeFeature.bullets.map((bullet, index) => (
                  <motion.li
                    key={index}
                    className="flex items-start gap-3 text-sm text-gray-600"
                    variants={itemVariants}
                  >
                    {/*
                     * Checkmark décoratif — cercle gris avec check blanc.
                     * `shrink-0` évite que le cercle se rétrécisse si le texte
                     * est long sur mobile.
                     */}
                    <span
                      className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-gray-900"
                      aria-hidden="true"
                    >
                      <svg
                        className="size-3 text-white"
                        viewBox="0 0 12 12"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polyline points="2,6 5,9 10,3" />
                      </svg>
                    </span>
                    {bullet}
                  </motion.li>
                ))}
              </motion.ul>
            </motion.div>

            {/* ── Colonne mockup ────────────────────────────────────────────── */}
            {/*
             * Le mockup (screenshot dans faux chrome) apparaît légèrement
             * après le texte grâce au délai + scale depuis 0.97 → 1.
             * Sur mobile il s'affiche en dessous du texte (grid 1 colonne).
             */}
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.35, ease: 'easeOut', delay: 0.1 }}
            >
              <FeatureMockup featureId={activeTab} title={activeFeature.label} />
            </motion.div>
          </motion.div>
        </AnimatePresence>
      </div>
    </motion.section>
  )
}
