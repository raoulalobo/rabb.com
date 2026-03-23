/**
 * @file components/landing/FeatureCarousel.tsx
 * @description Carrousel swipable des fonctionnalités avec illustrations animées.
 *   Chaque slide contient une illustration HTML/CSS/Framer Motion (pas de screenshots).
 *   CSS scroll-snap pour un swipe natif sur mobile.
 *
 * @example
 *   <FeatureCarousel />
 */

'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import { motion } from 'framer-motion'
import {
  BarChart2,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  FileSignature,
  Image as ImageIcon,
  Images,
  ListOrdered,
  Play,
  Settings,
} from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────────────

interface Feature {
  id: string
  label: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  accent: string
  accentBg: string
  illustration: React.ComponentType<Record<string, never>>
}

// ─── Illustrations ───────────────────────────────────────────────────────────

/** 1. Calendrier — grille 5 jours avec des mini-posts colorés */
function CalendarIllustration(): React.JSX.Element {
  const days = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven']
  const posts = [
    { day: 0, color: 'bg-pink-400', label: 'IG' },
    { day: 0, color: 'bg-pink-300', label: 'IG' },
    { day: 1, color: 'bg-cyan-400', label: 'TK' },
    { day: 2, color: 'bg-red-400', label: 'YT' },
    { day: 3, color: 'bg-pink-400', label: 'IG' },
    { day: 4, color: 'bg-cyan-400', label: 'TK' },
    { day: 4, color: 'bg-blue-400', label: 'FB' },
  ]

  return (
    <div className="flex flex-col gap-2 p-4">
      {/* En-tête jours */}
      <div className="grid grid-cols-5 gap-1.5">
        {days.map((day) => (
          <div key={day} className="text-center text-[10px] font-medium text-gray-400">
            {day}
          </div>
        ))}
      </div>
      {/* Grille avec posts */}
      <div className="grid grid-cols-5 gap-1.5">
        {days.map((_, dayIndex) => (
          <div key={dayIndex} className="flex min-h-[60px] flex-col gap-1 rounded-lg border border-gray-100 bg-white p-1">
            {posts
              .filter((p) => p.day === dayIndex)
              .map((post, i) => (
                <motion.div
                  key={i}
                  className={`rounded px-1.5 py-0.5 text-[8px] font-bold text-white ${post.color}`}
                  initial={{ opacity: 0, scale: 0.8 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.1 + i * 0.08 + dayIndex * 0.05 }}
                >
                  {post.label}
                </motion.div>
              ))}
          </div>
        ))}
      </div>
    </div>
  )
}

/** 2. File d'attente — créneaux empilés avec flèches */
function QueueIllustration(): React.JSX.Element {
  const slots = [
    { day: 'Lun', hour: '9h', platform: 'IG', color: 'border-pink-300 bg-pink-50' },
    { day: 'Mer', hour: '14h', platform: 'TK', color: 'border-cyan-300 bg-cyan-50' },
    { day: 'Ven', hour: '18h', platform: 'YT', color: 'border-red-300 bg-red-50' },
    { day: 'Sam', hour: '11h', platform: 'FB', color: 'border-blue-300 bg-blue-50' },
  ]

  return (
    <div className="flex flex-col items-center gap-2 p-4">
      {slots.map((slot, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, x: -20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 + i * 0.1 }}
        >
          <div className={`flex items-center gap-3 rounded-xl border px-4 py-2 ${slot.color}`}>
            <span className="text-xs font-semibold text-gray-700">{slot.day} {slot.hour}</span>
            <span className="rounded bg-white px-1.5 py-0.5 text-[9px] font-bold text-gray-500 shadow-sm">
              {slot.platform}
            </span>
            <div className="h-1.5 w-12 rounded-full bg-gray-200" />
          </div>
          {i < slots.length - 1 && (
            <div className="flex justify-center py-0.5">
              <div className="h-3 w-px bg-gray-200" />
            </div>
          )}
        </motion.div>
      ))}
    </div>
  )
}

/** 3. Analytics — bar chart avec ligne de tendance */
function AnalyticsIllustration(): React.JSX.Element {
  const bars = [35, 55, 40, 70, 60, 85, 75]

  return (
    <div className="flex flex-col gap-3 p-4">
      {/* Badges KPI */}
      <div className="flex justify-center gap-2">
        <motion.span
          className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700"
          initial={{ opacity: 0, y: -5 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3 }}
        >
          ↑ 12%
        </motion.span>
        <motion.span
          className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700"
          initial={{ opacity: 0, y: -5 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.4 }}
        >
          ER 4.2%
        </motion.span>
      </div>
      {/* Barres */}
      <div className="flex items-end justify-center gap-2">
        {bars.map((height, i) => (
          <motion.div
            key={i}
            className="w-6 rounded-t-md bg-emerald-400"
            style={{ height: 0 }}
            whileInView={{ height: `${height}px` }}
            viewport={{ once: true }}
            transition={{ delay: 0.05 + i * 0.06, duration: 0.4, ease: 'easeOut' }}
          />
        ))}
      </div>
      {/* Ligne de base */}
      <div className="h-px w-full bg-gray-200" />
    </div>
  )
}

/** 4. Galerie média — grille de miniatures */
function GalleryIllustration(): React.JSX.Element {
  const items = [
    { type: 'image', color: 'bg-pink-100' },
    { type: 'image', color: 'bg-amber-100' },
    { type: 'video', color: 'bg-violet-100' },
    { type: 'image', color: 'bg-blue-100' },
    { type: 'image', color: 'bg-emerald-100' },
    { type: 'image', color: 'bg-rose-100' },
  ]

  return (
    <div className="grid grid-cols-3 gap-2 p-4">
      {items.map((item, i) => (
        <motion.div
          key={i}
          className={`flex aspect-square items-center justify-center rounded-xl ${item.color}`}
          initial={{ opacity: 0, scale: 0.85 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.05 + i * 0.06 }}
        >
          {item.type === 'video' ? (
            <Play className="size-5 text-violet-400" />
          ) : (
            <ImageIcon className="size-5 text-gray-300" />
          )}
        </motion.div>
      ))}
    </div>
  )
}

/** 5. Hashtags — chips + bloc signature */
function HashtagsIllustration(): React.JSX.Element {
  const tags = ['#fyp', '#lifestyle', '#viral', '#explore', '#trending']

  return (
    <div className="flex flex-col gap-3 p-4">
      {/* Chips */}
      <div className="flex flex-wrap justify-center gap-1.5">
        {tags.map((tag, i) => (
          <motion.span
            key={tag}
            className="rounded-full border border-cyan-200 bg-cyan-50 px-2.5 py-1 text-[11px] font-semibold text-cyan-700"
            initial={{ opacity: 0, x: -10 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.05 + i * 0.07 }}
          >
            {tag}
          </motion.span>
        ))}
      </div>
      {/* Bloc signature simulé */}
      <motion.div
        className="mx-auto w-4/5 space-y-1.5 rounded-lg border border-gray-100 bg-white p-3"
        initial={{ opacity: 0, y: 10 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ delay: 0.4 }}
      >
        <div className="h-1.5 w-3/4 rounded bg-gray-200" />
        <div className="h-1.5 w-1/2 rounded bg-gray-200" />
        <div className="h-1.5 w-2/3 rounded bg-cyan-200" />
      </motion.div>
    </div>
  )
}

/** 6. Réseaux connectés — icônes en cercle autour d'un hub */
function NetworkIllustration(): React.JSX.Element {
  const platforms = [
    { label: 'IG', color: 'bg-pink-400', angle: 0 },
    { label: 'TK', color: 'bg-gray-800', angle: 72 },
    { label: 'YT', color: 'bg-red-500', angle: 144 },
    { label: 'FB', color: 'bg-blue-500', angle: 216 },
    { label: 'X', color: 'bg-gray-900', angle: 288 },
  ]

  return (
    <div className="relative mx-auto flex aspect-square w-48 items-center justify-center">
      {/* Hub central */}
      <motion.div
        className="z-10 flex size-12 items-center justify-center rounded-full bg-gray-900 text-[10px] font-bold text-white shadow-lg"
        initial={{ scale: 0 }}
        whileInView={{ scale: 1 }}
        viewport={{ once: true }}
        transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
      >
        ogo
      </motion.div>

      {/* Icônes en cercle */}
      {platforms.map((p, i) => {
        const radius = 70
        const rad = (p.angle * Math.PI) / 180
        const x = Math.cos(rad) * radius
        const y = Math.sin(rad) * radius

        return (
          <motion.div
            key={p.label}
            className={`absolute flex size-9 items-center justify-center rounded-full text-[9px] font-bold text-white shadow-md ${p.color}`}
            style={{ left: `calc(50% + ${x}px - 18px)`, top: `calc(50% + ${y}px - 18px)` }}
            initial={{ scale: 0, opacity: 0 }}
            whileInView={{ scale: 1, opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 + i * 0.08, type: 'spring', stiffness: 200 }}
          >
            {p.label}
          </motion.div>
        )
      })}
    </div>
  )
}

// ─── Données des features ────────────────────────────────────────────────────

const FEATURES: Feature[] = [
  {
    id: 'calendar',
    label: 'Calendrier & Compositeur',
    description: 'Planifiez vos posts sur un mois et composez directement depuis le calendrier avec l\'éditeur multi-plateforme.',
    icon: CalendarDays,
    accent: '#7c3aed',
    accentBg: 'bg-violet-50',
    illustration: CalendarIllustration,
  },
  {
    id: 'queue',
    label: 'File d\'attente',
    description: 'Définissez des créneaux récurrents. Vos posts se programment automatiquement chaque semaine.',
    icon: ListOrdered,
    accent: '#d97706',
    accentBg: 'bg-amber-50',
    illustration: QueueIllustration,
  },
  {
    id: 'analytics',
    label: 'Analytics',
    description: '11 visualisations, comparaison périodique, export CSV et créneaux recommandés.',
    icon: BarChart2,
    accent: '#059669',
    accentBg: 'bg-emerald-50',
    illustration: AnalyticsIllustration,
  },
  {
    id: 'gallery',
    label: 'Galerie média',
    description: 'Bibliothèque centralisée de vos photos et vidéos avec dossiers et tags.',
    icon: Images,
    accent: '#db2777',
    accentBg: 'bg-pink-50',
    illustration: GalleryIllustration,
  },
  {
    id: 'signatures',
    label: 'Hashtags & Signatures',
    description: 'Blocs de texte réutilisables par plateforme : hashtags, CTAs, mentions.',
    icon: FileSignature,
    accent: '#0891b2',
    accentBg: 'bg-cyan-50',
    illustration: HashtagsIllustration,
  },
  {
    id: 'settings',
    label: 'Réseaux connectés',
    description: 'Connectez Instagram, TikTok, YouTube, Facebook et 6 autres en quelques secondes.',
    icon: Settings,
    accent: '#6b7280',
    accentBg: 'bg-gray-100',
    illustration: NetworkIllustration,
  },
]

const AUTOPLAY_INTERVAL = 5000

// ─── Composant principal ─────────────────────────────────────────────────────

export function FeatureCarousel(): React.JSX.Element {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const [isPaused, setIsPaused] = useState(false)

  const scrollToIndex = useCallback((index: number): void => {
    const container = scrollRef.current
    if (!container) return
    const slide = container.children[index] as HTMLElement | undefined
    if (!slide) return
    container.scrollTo({ left: slide.offsetLeft - container.offsetLeft, behavior: 'smooth' })
  }, [])

  const goNext = useCallback((): void => {
    scrollToIndex((activeIndex + 1) % FEATURES.length)
  }, [activeIndex, scrollToIndex])

  const goPrev = useCallback((): void => {
    scrollToIndex((activeIndex - 1 + FEATURES.length) % FEATURES.length)
  }, [activeIndex, scrollToIndex])

  // IntersectionObserver pour détecter la slide visible
  useEffect(() => {
    const container = scrollRef.current
    if (!container) return
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const index = Array.from(container.children).indexOf(entry.target as HTMLElement)
            if (index >= 0) setActiveIndex(index)
          }
        }
      },
      { root: container, threshold: 0.6 },
    )
    for (const child of Array.from(container.children)) observer.observe(child)
    return () => observer.disconnect()
  }, [])

  // Auto-play
  useEffect(() => {
    if (isPaused) return
    const timer = setInterval(goNext, AUTOPLAY_INTERVAL)
    return () => clearInterval(timer)
  }, [isPaused, goNext])

  return (
    <motion.div
      className="mx-auto max-w-5xl px-6"
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
    >
      {/* Titre */}
      <div className="mb-10 text-center">
        <p className="mb-3 text-sm font-medium uppercase tracking-widest text-gray-400">
          Fonctionnalités
        </p>
        <h2 className="text-3xl font-bold tracking-tight text-gray-900 lg:text-4xl">
          Tout ce dont vous avez besoin
        </h2>
      </div>

      {/* Carrousel */}
      <div
        className="relative"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
        onTouchStart={() => setIsPaused(true)}
        onTouchEnd={() => setIsPaused(false)}
      >
        {/* Zone scrollable */}
        <div
          ref={scrollRef}
          className="flex snap-x snap-mandatory gap-5 overflow-x-auto scroll-smooth pb-4"
          style={{ scrollbarWidth: 'none' }}
        >
          {FEATURES.map((feature) => {
            const Icon = feature.icon
            const Illustration = feature.illustration

            return (
              <div
                key={feature.id}
                className="w-full flex-shrink-0 snap-center sm:w-[85%] lg:w-[70%]"
              >
                <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition-shadow hover:shadow-md">
                  {/* Illustration animée */}
                  <div className={`flex items-center justify-center ${feature.accentBg}`} style={{ minHeight: '220px' }}>
                    <Illustration />
                  </div>

                  {/* Texte */}
                  <div className="p-5 sm:p-6">
                    <div className="mb-2 flex items-center gap-2.5">
                      <div
                        className="flex size-8 items-center justify-center rounded-lg"
                        style={{ backgroundColor: `${feature.accent}15`, color: feature.accent }}
                      >
                        <Icon className="size-4" />
                      </div>
                      <h3 className="text-base font-semibold text-gray-900 sm:text-lg">
                        {feature.label}
                      </h3>
                    </div>
                    <p className="text-sm leading-relaxed text-gray-500 sm:text-base">
                      {feature.description}
                    </p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Flèches desktop */}
        <button
          type="button"
          onClick={goPrev}
          className="absolute left-0 top-1/3 -translate-x-3 hidden items-center justify-center rounded-full border border-gray-200 bg-white p-2 shadow-md transition-all hover:shadow-lg hover:scale-105 lg:flex"
          aria-label="Slide précédente"
        >
          <ChevronLeft className="size-5 text-gray-700" />
        </button>
        <button
          type="button"
          onClick={goNext}
          className="absolute right-0 top-1/3 translate-x-3 hidden items-center justify-center rounded-full border border-gray-200 bg-white p-2 shadow-md transition-all hover:shadow-lg hover:scale-105 lg:flex"
          aria-label="Slide suivante"
        >
          <ChevronRight className="size-5 text-gray-700" />
        </button>
      </div>

      {/* Dots */}
      <div className="mt-6 flex items-center justify-center gap-2" role="tablist">
        {FEATURES.map((feature, index) => (
          <button
            key={feature.id}
            type="button"
            onClick={() => scrollToIndex(index)}
            role="tab"
            aria-selected={index === activeIndex}
            aria-label={feature.label}
            className={`rounded-full transition-all duration-300 ${
              index === activeIndex
                ? 'h-2.5 w-6 bg-gray-900'
                : 'size-2.5 bg-gray-300 hover:bg-gray-400'
            }`}
          />
        ))}
      </div>

      {/* Hide scrollbar webkit */}
      <style jsx>{`
        div::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </motion.div>
  )
}
