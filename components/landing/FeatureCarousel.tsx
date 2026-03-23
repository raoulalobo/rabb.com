/**
 * @file components/landing/FeatureCarousel.tsx
 * @description Carrousel swipable des fonctionnalités — texte + icône, sobre.
 *   CSS scroll-snap pour swipe natif sur mobile.
 *   Chaque slide : icône + titre + description + bullets.
 *
 * @example
 *   <FeatureCarousel />
 */

'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

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

// ─── Données ─────────────────────────────────────────────────────────────────

const FEATURES = [
  {
    id: 'calendar',
    label: 'Calendrier & Compositeur',
    description: 'Planifiez vos posts sur une periode directement depuis le calendrier.',
    bullets: ['Vue mensuelle complète', 'Éditeur multi-plateforme intégré', 'Création rapide par clic sur un jour', 'Stories, Reels, Threads, Carrousels'],
    icon: CalendarDays,
    accent: '#7c3aed',
  },
  {
    id: 'queue',
    label: 'File d\'attente',
    description: 'Définissez des créneaux récurrents pour publier automatiquement.',
    bullets: ['Créneaux par jour et heure', 'Publication automatique chaque semaine', 'Filtrable par plateforme', 'Activable / désactivable par créneau'],
    icon: ListOrdered,
    accent: '#d97706',
  },
  {
    id: 'analytics',
    label: 'Analytics',
    description: 'Suivez vos performances avec des visualisations détaillées.',
    bullets: ['11 visualisations (heatmap, graphiques, tableaux)', 'Comparaison vs période précédente', 'Export CSV en un clic', 'Créneaux de publication recommandés'],
    icon: BarChart2,
    accent: '#059669',
  },
  {
    id: 'gallery',
    label: 'Galerie média',
    description: 'Centralisez vos photos et vidéos pour les réutiliser.',
    bullets: ['Dossiers et tags pour organiser', 'Drag & drop pour uploader', 'Sélection rapide dans le compositeur', 'Images et vidéos supportées'],
    icon: Images,
    accent: '#db2777',
  },
  {
    id: 'signatures',
    label: 'Hashtags & Signatures',
    description: 'Blocs de texte réutilisables par plateforme.',
    bullets: ['Hashtags, CTAs, mentions', 'Un clic pour insérer dans un post', 'Différents blocs par plateforme', 'Illimité'],
    icon: FileSignature,
    accent: '#0891b2',
  },
  {
    id: 'settings',
    label: 'Réseaux connectés',
    description: 'Connectez vos comptes sociaux en quelques secondes.',
    bullets: ['Instagram, TikTok, YouTube, Facebook', 'LinkedIn, Snapchat, Pinterest, Threads', 'Reddit et plus encore', 'Connexion OAuth sécurisée'],
    icon: Settings,
    accent: '#6b7280',
  },
] as const

const AUTOPLAY_INTERVAL = 5000

// ─── Composant ────────────────────────────────────────────────────────────────

export function FeatureCarousel(): React.JSX.Element {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const [isPaused, setIsPaused] = useState(false)
  // Ref pour l'index courant — lu par goNext/goPrev sans dépendance au state
  // Évite les closures stale et les recréations d'interval
  const activeIndexRef = useRef(0)
  activeIndexRef.current = activeIndex

  const scrollToIndex = useCallback((index: number): void => {
    const container = scrollRef.current
    if (!container) return
    const slide = container.children[index] as HTMLElement | undefined
    if (!slide) return
    // scrollIntoView fonctionne nativement avec scroll-snap (pas de conflit d'offset)
    slide.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
    // Mettre à jour l'index immédiatement (pas attendre l'IntersectionObserver)
    setActiveIndex(index)
  }, [])

  const goNext = useCallback((): void => {
    scrollToIndex((activeIndexRef.current + 1) % FEATURES.length)
  }, [scrollToIndex])

  const goPrev = useCallback((): void => {
    scrollToIndex((activeIndexRef.current - 1 + FEATURES.length) % FEATURES.length)
  }, [scrollToIndex])

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

  useEffect(() => {
    if (isPaused) return
    const timer = setInterval(goNext, AUTOPLAY_INTERVAL)
    return () => clearInterval(timer)
  }, [isPaused, goNext])

  return (
    <div className="mx-auto max-w-5xl px-6">
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
        <div
          ref={scrollRef}
          className="flex snap-x snap-mandatory gap-5 overflow-x-auto pb-4"
          style={{ scrollbarWidth: 'none' }}
        >
          {FEATURES.map((feature) => {
            const Icon = feature.icon

            return (
              <div
                key={feature.id}
                className="w-full flex-shrink-0 snap-center sm:w-[80%] lg:w-[60%]"
              >
                <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md sm:p-8">
                  {/* Icône + titre */}
                  <div className="mb-4 flex items-center gap-3">
                    <div
                      className="flex size-10 items-center justify-center rounded-xl"
                      style={{ backgroundColor: `${feature.accent}12`, color: feature.accent }}
                    >
                      <Icon className="size-5" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {feature.label}
                    </h3>
                  </div>

                  {/* Description */}
                  <p className="mb-5 text-sm leading-relaxed text-gray-500 sm:text-base">
                    {feature.description}
                  </p>

                  {/* Bullets */}
                  <ul className="space-y-2">
                    {feature.bullets.map((bullet) => (
                      <li key={bullet} className="flex items-start gap-2 text-sm text-gray-600">
                        <span className="mt-1.5 size-1.5 shrink-0 rounded-full" style={{ backgroundColor: feature.accent }} />
                        {bullet}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )
          })}
        </div>

        {/* Flèches desktop */}
        <button
          type="button"
          onClick={goPrev}
          className="absolute left-0 top-1/2 -translate-x-3 -translate-y-1/2 hidden items-center justify-center rounded-full border border-gray-200 bg-white p-2 shadow-md transition-all hover:shadow-lg hover:scale-105 lg:flex"
          aria-label="Slide précédente"
        >
          <ChevronLeft className="size-5 text-gray-700" />
        </button>
        <button
          type="button"
          onClick={goNext}
          className="absolute right-0 top-1/2 translate-x-3 -translate-y-1/2 hidden items-center justify-center rounded-full border border-gray-200 bg-white p-2 shadow-md transition-all hover:shadow-lg hover:scale-105 lg:flex"
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

      <style jsx>{`
        div::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  )
}
