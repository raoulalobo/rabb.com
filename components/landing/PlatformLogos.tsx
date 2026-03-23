/**
 * @file components/landing/PlatformLogos.tsx
 * @description Grille de logos des plateformes supportées + CTA final.
 *   Affiche les 13 plateformes avec leurs icônes SVG.
 *   Animation d'entrée au scroll.
 *
 * @example
 *   <PlatformLogos />
 */

'use client'

import { motion } from 'framer-motion'
import Image from 'next/image'
import Link from 'next/link'

import { Button } from '@/components/ui/button'

// ─── Données ─────────────────────────────────────────────────────────────────

const PLATFORMS = [
  { name: 'Instagram', icon: '/icons/instagram.svg' },
  { name: 'TikTok', icon: '/icons/tiktok.svg' },
  { name: 'YouTube', icon: '/icons/youtube.svg' },
  { name: 'Facebook', icon: '/icons/facebook.svg' },
  { name: 'X (Twitter)', icon: '/icons/twitter.svg' },
  { name: 'LinkedIn', icon: '/icons/linkedin.svg' },
  { name: 'Snapchat', icon: '/icons/snapchat.svg' },
  { name: 'Pinterest', icon: '/icons/pinterest.svg' },
  { name: 'Threads', icon: '/icons/threads.svg' },
  { name: 'Reddit', icon: '/icons/reddit.svg' },
] as const

// ─── Composant ────────────────────────────────────────────────────────────────

/**
 * Section finale : logos des 13 plateformes + CTA "Commencer gratuitement".
 */
export function PlatformLogos(): React.JSX.Element {
  return (
    <motion.section
      className="mx-auto max-w-4xl px-6 text-center"
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
    >
      {/* Titre */}
      <h2 className="text-3xl font-bold tracking-tight text-gray-900 lg:text-4xl">
        Tous vos réseaux, un seul outil
      </h2>
      <p className="mx-auto mt-4 max-w-xl text-base text-gray-500">
        Publiez sur 10 plateformes depuis un seul tableau de bord.
        Connectez vos comptes en 30 secondes.
      </p>

      {/* Grille de logos */}
      <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
        {PLATFORMS.map((platform, index) => (
          <motion.div
            key={platform.name}
            className="flex items-center gap-2 rounded-xl border border-gray-100 bg-white px-2.5 py-2 sm:px-4 sm:py-2.5 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5"
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.3, delay: index * 0.03 }}
            title={platform.name}
          >
            <Image
              src={platform.icon}
              alt={platform.name}
              width={20}
              height={20}
              className="size-5"
            />
            <span className="hidden text-sm font-medium text-gray-700 sm:inline">{platform.name}</span>
          </motion.div>
        ))}
      </div>

      {/* CTA final */}
      <div className="mt-12 space-y-4">
        <Button size="lg" className="h-12 rounded-xl px-8 text-base font-medium" asChild>
          <Link href="/register">
            Commencer gratuitement
            <span aria-hidden="true" className="ml-1">&rarr;</span>
          </Link>
        </Button>
        <p className="text-sm text-gray-400">
          Aucune carte bancaire requise &middot; Gratuit pendant le lancement
        </p>
      </div>
    </motion.section>
  )
}
