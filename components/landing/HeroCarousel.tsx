/**
 * @file components/landing/HeroCarousel.tsx
 * @module landing
 * @description Carousel rotatif de screenshots du dashboard pour le hero de la landing page.
 *
 *   Affiche 3 slides (Compose, Analytics, Galerie) dans un mockup navigateur
 *   avec rotation automatique toutes les 4 secondes. Pause au hover.
 *   Transitions animées via Framer Motion (AnimatePresence mode="wait").
 *   Dots indicateurs cliquables + label contextuel sous le mockup.
 *
 *   Structure :
 *   ```
 *   <div> ← conteneur principal
 *     <div> ← mockup navigateur (barre chrome + zone image)
 *       <AnimatePresence> ← transition entre slides
 *     <div> ← dots indicateurs + label
 *   ```
 *
 * @example
 * // Dans app/page.tsx (hero section)
 * import { HeroCarousel } from '@/components/landing/HeroCarousel'
 * <HeroCarousel />
 */

'use client'

import { useState, useEffect, useCallback } from 'react'
import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
import {
  PenLine,
  BarChart2,
  Images,

} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Structure d'un slide du carousel.
 */
interface Slide {
  /** Identifiant unique du slide */
  id: string
  /** Chemin vers le screenshot dans /public/screenshots/ */
  screenshot: string
  /** Label affiché sous le mockup */
  label: string
  /** URL factice affichée dans la barre chrome */
  url: string
  /** Icône Lucide pour le placeholder si le screenshot n'existe pas */
  icon: React.ComponentType<{ className?: string }>
}

// ─── Données des slides ───────────────────────────────────────────────────────

/**
 * Les 4 slides du carousel hero.
 * Ordre : Compose → Analytics → Galerie
 * Chaque slide correspond à une feature majeure du dashboard.
 */
const SLIDES: Slide[] = [
  {
    id: 'compose',
    screenshot: '/screenshots/compose.png',
    label: 'Éditeur multi-réseaux',
    url: 'ogolong.com/compose',
    icon: PenLine,
  },
  {
    id: 'analytics',
    screenshot: '/screenshots/analytics.png',
    label: 'Analytics en temps réel',
    url: 'ogolong.com/analytics',
    icon: BarChart2,
  },
  {
    id: 'gallery',
    screenshot: '/screenshots/gallery.png',
    label: 'Bibliothèque de médias',
    url: 'ogolong.com/gallery',
    icon: Images,
  },
]

/** Durée entre chaque rotation automatique (en ms) */
const AUTO_ROTATE_INTERVAL = 4000

// ─── Composant ────────────────────────────────────────────────────────────────

/**
 * Carousel rotatif de screenshots du dashboard dans un mockup navigateur.
 *
 * Fonctionnalités :
 * - Rotation automatique toutes les 4 secondes
 * - Pause au hover (onMouseEnter/onMouseLeave)
 * - Dots indicateurs cliquables
 * - Label contextuel qui change avec chaque slide
 * - Transition AnimatePresence mode="wait" entre les slides
 *
 * @returns Élément JSX du carousel hero
 *
 * @example
 * <HeroCarousel />
 */
export function HeroCarousel(): React.JSX.Element {
  // Index du slide actuellement affiché
  const [currentIndex, setCurrentIndex] = useState<number>(0)
  // Flag de pause (hover) — empêche la rotation automatique
  const [isPaused, setIsPaused] = useState<boolean>(false)

  const currentSlide = SLIDES[currentIndex]

  /**
   * Passe au slide suivant (cyclique).
   * Utilisé par le timer automatique et potentiellement par des contrôles manuels.
   */
  const goToNext = useCallback((): void => {
    setCurrentIndex((prev) => (prev + 1) % SLIDES.length)
  }, [])

  /**
   * Navigue vers un slide spécifique (clic sur un dot indicateur).
   * @param index - Index du slide cible (0-based)
   */
  const goToSlide = useCallback((index: number): void => {
    setCurrentIndex(index)
  }, [])

  // ── Rotation automatique ──────────────────────────────────────────────────
  // setInterval actif tant que `isPaused` est false.
  // Le cleanup évite les fuites mémoire quand le composant est démonté.
  useEffect(() => {
    if (isPaused) return

    const timer = setInterval(goToNext, AUTO_ROTATE_INTERVAL)
    return () => clearInterval(timer)
  }, [isPaused, goToNext])

  const Icon = currentSlide.icon

  return (
    <div
      className="w-full"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* ── Mockup navigateur ──────────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg">
        {/* Barre chrome navigateur (3 boutons macOS + URL factice) */}
        <div className="flex items-center gap-3 border-b border-gray-100 bg-gray-50/80 px-4 py-3">
          {/* Boutons macOS décoratifs */}
          <div className="flex items-center gap-1.5" aria-hidden="true">
            <span className="size-3 rounded-full bg-red-400/70" />
            <span className="size-3 rounded-full bg-yellow-400/70" />
            <span className="size-3 rounded-full bg-green-400/70" />
          </div>

          {/* Barre d'URL factice — centrée */}
          <div className="flex flex-1 items-center justify-center">
            <div className="flex items-center gap-1.5 rounded-md bg-white px-3 py-1.5 text-xs text-gray-400 shadow-sm ring-1 ring-gray-200/80">
              {/* Icône cadenas HTTPS */}
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
              <span className="font-mono">{currentSlide.url}</span>
            </div>
          </div>

          {/* Espace balancier pour centrer l'URL */}
          <div className="w-12" aria-hidden="true" />
        </div>

        {/* Zone de contenu : screenshot avec transition animée */}
        <div className="relative aspect-[16/10] w-full bg-gray-50">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentSlide.id}
              className="absolute inset-0"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.3, ease: 'easeInOut' }}
            >
              {/*
               * Screenshot réel du dashboard.
               * z-10 : recouvre le placeholder quand l'image charge.
               * onError : masque l'image si le fichier n'existe pas.
               */}
              <Image
                src={currentSlide.screenshot}
                alt={`Capture d'écran — ${currentSlide.label}`}
                fill
                className="z-10 object-cover object-top"
                sizes="(max-width: 768px) 100vw, 50vw"
                onError={(e) => {
                  const target = e.target as HTMLImageElement
                  target.style.display = 'none'
                }}
              />

              {/* Placeholder si le screenshot n'existe pas */}
              <div
                className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-gray-50"
                aria-hidden="true"
              >
                {/* Damier décoratif en arrière-plan */}
                <div
                  className="absolute inset-0 opacity-30"
                  style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg width='16' height='16' viewBox='0 0 16 16' xmlns='http://www.w3.org/2000/svg'%3E%3Crect x='0' y='0' width='8' height='8' fill='%23e5e7eb' /%3E%3Crect x='8' y='8' width='8' height='8' fill='%23e5e7eb' /%3E%3C/svg%3E")`,
                    backgroundRepeat: 'repeat',
                    backgroundSize: '16px 16px',
                  }}
                />
                {/* Icône centrée de la feature */}
                <div className="relative flex size-16 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-gray-200">
                  <Icon className="size-8 text-gray-300" />
                </div>
                <p className="relative text-sm font-medium text-gray-400">
                  {currentSlide.label}
                </p>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* ── Dots indicateurs + label ───────────────────────────────────────── */}
      <div className="mt-4 flex flex-col items-center gap-2">
        {/* Dots cliquables */}
        <div className="flex items-center gap-2" role="tablist" aria-label="Slides du carousel">
          {SLIDES.map((slide, index) => (
            <button
              key={slide.id}
              role="tab"
              aria-selected={index === currentIndex}
              aria-label={slide.label}
              onClick={() => goToSlide(index)}
              className={[
                'size-2.5 rounded-full transition-all duration-300',
                index === currentIndex
                  ? 'scale-110 bg-gray-900'
                  : 'bg-gray-300 hover:bg-gray-400',
              ].join(' ')}
            />
          ))}
        </div>

        {/* Label contextuel du slide actif */}
        <AnimatePresence mode="wait">
          <motion.p
            key={currentSlide.id}
            className="text-sm font-medium text-gray-500"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.2 }}
          >
            {currentSlide.label}
          </motion.p>
        </AnimatePresence>
      </div>
    </div>
  )
}
