/**
 * @file components/landing/FeatureCarousel.tsx
 * @description Carrousel swipable des fonctionnalités pour la homepage.
 *   Utilise CSS scroll-snap (pas de librairie) pour un swipe natif sur mobile.
 *   Chaque slide : screenshot pleine largeur + titre + description.
 *
 *   Comportement :
 *   - Mobile : une slide visible, swipe horizontal natif
 *   - Desktop : même carrousel + flèches gauche/droite
 *   - Auto-play : rotation toutes les 5s, pause au hover/touch
 *   - Dots indicateurs de la slide active (IntersectionObserver)
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
    description: 'Planifiez vos posts sur un mois et composez directement depuis le calendrier avec l\'éditeur multi-plateforme.',
    icon: CalendarDays,
    screenshot: '/screenshots/compose.png',
    accent: '#7c3aed',
  },
  {
    id: 'queue',
    label: 'File d\'attente',
    description: 'Définissez des créneaux récurrents (lundi 9h, mercredi 14h…). Vos posts se programment automatiquement.',
    icon: ListOrdered,
    screenshot: '/screenshots/settings.png',
    accent: '#d97706',
  },
  {
    id: 'analytics',
    label: 'Analytics',
    description: '11 visualisations, comparaison périodique, export CSV et créneaux recommandés pour optimiser vos publications.',
    icon: BarChart2,
    screenshot: '/screenshots/analytics.png',
    accent: '#059669',
  },
  {
    id: 'gallery',
    label: 'Galerie média',
    description: 'Bibliothèque centralisée de vos photos et vidéos. Organisez avec des dossiers et des tags.',
    icon: Images,
    screenshot: '/screenshots/gallery.png',
    accent: '#db2777',
  },
  {
    id: 'signatures',
    label: 'Hashtags & Signatures',
    description: 'Blocs de texte réutilisables par plateforme : hashtags, CTAs, mentions. Un clic pour les insérer.',
    icon: FileSignature,
    screenshot: '/screenshots/signatures.png',
    accent: '#0891b2',
  },
  {
    id: 'settings',
    label: 'Réseaux connectés',
    description: 'Connectez Instagram, TikTok, YouTube, Facebook et 6 autres plateformes en quelques secondes.',
    icon: Settings,
    screenshot: '/screenshots/settings.png',
    accent: '#6b7280',
  },
] as const

/** Durée en ms entre chaque rotation automatique */
const AUTOPLAY_INTERVAL = 5000

// ─── Composant ────────────────────────────────────────────────────────────────

/**
 * Carrousel swipable des fonctionnalités.
 * CSS scroll-snap pour le swipe natif + IntersectionObserver pour les dots.
 */
export function FeatureCarousel(): React.JSX.Element {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const [isPaused, setIsPaused] = useState(false)

  // ── Scroll vers une slide ──────────────────────────────────────────────────

  const scrollToIndex = useCallback((index: number): void => {
    const container = scrollRef.current
    if (!container) return
    const slide = container.children[index] as HTMLElement | undefined
    if (!slide) return
    container.scrollTo({ left: slide.offsetLeft - container.offsetLeft, behavior: 'smooth' })
  }, [])

  // ── Flèches navigation ────────────────────────────────────────────────────

  const goNext = useCallback((): void => {
    const next = (activeIndex + 1) % FEATURES.length
    scrollToIndex(next)
  }, [activeIndex, scrollToIndex])

  const goPrev = useCallback((): void => {
    const prev = (activeIndex - 1 + FEATURES.length) % FEATURES.length
    scrollToIndex(prev)
  }, [activeIndex, scrollToIndex])

  // ── IntersectionObserver pour détecter la slide visible ────────────────────

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

    for (const child of Array.from(container.children)) {
      observer.observe(child)
    }

    return () => observer.disconnect()
  }, [])

  // ── Auto-play ─────────────────────────────────────────────────────────────

  useEffect(() => {
    if (isPaused) return
    const timer = setInterval(goNext, AUTOPLAY_INTERVAL)
    return () => clearInterval(timer)
  }, [isPaused, goNext])

  // ── Rendu ─────────────────────────────────────────────────────────────────

  return (
    <motion.div
      className="mx-auto max-w-5xl px-6"
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
    >
      {/* Titre de section */}
      <div className="mb-10 text-center">
        <p className="mb-3 text-sm font-medium uppercase tracking-widest text-gray-400">
          Fonctionnalités
        </p>
        <h2 className="text-3xl font-bold tracking-tight text-gray-900 lg:text-4xl">
          Tout ce dont vous avez besoin
        </h2>
      </div>

      {/* Conteneur du carrousel */}
      <div
        className="relative"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
        onTouchStart={() => setIsPaused(true)}
        onTouchEnd={() => setIsPaused(false)}
      >
        {/* ── Zone scrollable (scroll-snap) ─────────────────────────────── */}
        <div
          ref={scrollRef}
          className="flex snap-x snap-mandatory gap-5 overflow-x-auto scroll-smooth pb-4"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {FEATURES.map((feature) => {
            const Icon = feature.icon

            return (
              <div
                key={feature.id}
                className="w-full flex-shrink-0 snap-center sm:w-[85%] lg:w-[70%]"
              >
                {/* Card de la slide */}
                <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition-shadow hover:shadow-md">
                  {/* Screenshot — prend toute la largeur, dominant visuellement */}
                  <div className="relative aspect-[16/9] w-full overflow-hidden bg-gray-50">
                    <Image
                      src={feature.screenshot}
                      alt={`${feature.label} — capture d'écran`}
                      fill
                      className="object-cover object-top"
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 85vw, 70vw"
                      priority
                    />
                  </div>

                  {/* Texte sous le screenshot */}
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

        {/* ── Flèches (desktop uniquement) ─────────────────────────────── */}
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

      {/* ── Dots indicateurs ───────────────────────────────────────────── */}
      <div className="mt-6 flex items-center justify-center gap-2" role="tablist" aria-label="Slides des fonctionnalités">
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

      {/* Masquer la scrollbar (webkit) */}
      <style jsx>{`
        div::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </motion.div>
  )
}
