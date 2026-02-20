/**
 * @file modules/platforms/constants.ts
 * @module platforms
 * @description Constantes de configuration des plateformes sociales.
 *   Couleurs de marque officielles, labels, ordre d'affichage et icônes SVG.
 *
 * @example
 *   import { PLATFORM_CONFIG, PRIORITY_PLATFORMS } from '@/modules/platforms/constants'
 *   const config = PLATFORM_CONFIG['instagram'] // { label: 'Instagram', color: '#E1306C', ... }
 */

import type { LatePlatform } from '@/lib/late'

// ─── Configuration par plateforme ─────────────────────────────────────────────

/**
 * Configuration visuelle et métadonnées d'une plateforme.
 */
export interface PlatformConfig {
  /** Nom affiché dans l'UI */
  label: string
  /** Couleur de marque officielle (hex) */
  color: string
  /** Couleur de fond légère pour les badges/cards (hex ou Tailwind) */
  bgColor: string
  /** Chemin du logo SVG (dans public/icons/) */
  iconPath: string
  /** Description courte affichée dans la UI */
  description: string
  /** Nombre max de caractères par post (0 = pas de limite connue) */
  maxChars: number
  /** Supporte les vidéos */
  supportsVideo: boolean
  /** Supporte les images */
  supportsImages: boolean
}

/**
 * Configuration de toutes les plateformes getlate.dev.
 * Les 4 premières sont les plateformes prioritaires (mises en avant dans l'UI).
 */
export const PLATFORM_CONFIG: Record<LatePlatform, PlatformConfig> = {
  // ── Plateformes prioritaires ────────────────────────────────────────────────
  instagram: {
    label: 'Instagram',
    color: '#E1306C',
    bgColor: '#FDF2F8',
    iconPath: '/icons/instagram.svg',
    description: 'Photos, Reels et Stories',
    maxChars: 2200,
    supportsVideo: true,
    supportsImages: true,
  },
  tiktok: {
    label: 'TikTok',
    color: '#010101',
    bgColor: '#F0F0F0',
    iconPath: '/icons/tiktok.svg',
    description: 'Vidéos courtes et tendances',
    maxChars: 2200,
    supportsVideo: true,
    supportsImages: false,
  },
  youtube: {
    label: 'YouTube',
    color: '#FF0000',
    bgColor: '#FEF2F2',
    iconPath: '/icons/youtube.svg',
    description: 'Vidéos longues et Shorts',
    maxChars: 5000,
    supportsVideo: true,
    supportsImages: false,
  },
  facebook: {
    label: 'Facebook',
    color: '#1877F2',
    bgColor: '#EFF6FF',
    iconPath: '/icons/facebook.svg',
    description: 'Posts, Stories et Reels',
    maxChars: 63206,
    supportsVideo: true,
    supportsImages: true,
  },

  // ── Plateformes secondaires (disponibles, non mises en avant) ───────────────
  twitter: {
    label: 'X (Twitter)',
    color: '#000000',
    bgColor: '#F0F0F0',
    iconPath: '/icons/twitter.svg',
    description: 'Posts courts et fils',
    maxChars: 280,
    supportsVideo: true,
    supportsImages: true,
  },
  linkedin: {
    label: 'LinkedIn',
    color: '#0A66C2',
    bgColor: '#EFF6FF',
    iconPath: '/icons/linkedin.svg',
    description: 'Contenu professionnel',
    maxChars: 3000,
    supportsVideo: true,
    supportsImages: true,
  },
  bluesky: {
    label: 'Bluesky',
    color: '#0085FF',
    bgColor: '#EFF6FF',
    iconPath: '/icons/bluesky.svg',
    description: 'Réseau décentralisé',
    maxChars: 300,
    supportsVideo: false,
    supportsImages: true,
  },
  threads: {
    label: 'Threads',
    color: '#000000',
    bgColor: '#F0F0F0',
    iconPath: '/icons/threads.svg',
    description: 'Conversations texte',
    maxChars: 500,
    supportsVideo: true,
    supportsImages: true,
  },
  reddit: {
    label: 'Reddit',
    color: '#FF4500',
    bgColor: '#FFF7ED',
    iconPath: '/icons/reddit.svg',
    description: 'Communautés et discussions',
    maxChars: 40000,
    supportsVideo: true,
    supportsImages: true,
  },
  pinterest: {
    label: 'Pinterest',
    color: '#E60023',
    bgColor: '#FEF2F2',
    iconPath: '/icons/pinterest.svg',
    description: 'Épingles visuelles',
    maxChars: 500,
    supportsVideo: true,
    supportsImages: true,
  },
  telegram: {
    label: 'Telegram',
    color: '#26A5E4',
    bgColor: '#F0F9FF',
    iconPath: '/icons/telegram.svg',
    description: 'Canaux et groupes',
    maxChars: 4096,
    supportsVideo: true,
    supportsImages: true,
  },
  snapchat: {
    label: 'Snapchat',
    color: '#FFFC00',
    bgColor: '#FEFCE8',
    iconPath: '/icons/snapchat.svg',
    description: 'Stories éphémères',
    maxChars: 250,
    supportsVideo: true,
    supportsImages: true,
  },
  google_business: {
    label: 'Google Business',
    color: '#4285F4',
    bgColor: '#EFF6FF',
    iconPath: '/icons/google-business.svg',
    description: 'Fiche Google My Business',
    maxChars: 1500,
    supportsVideo: false,
    supportsImages: true,
  },
}

// ─── Plateformes prioritaires ─────────────────────────────────────────────────

/**
 * Liste ordonnée des 4 plateformes prioritaires du MVP.
 * Affichées en premier et en avant dans la UI.
 */
export const PRIORITY_PLATFORMS: LatePlatform[] = [
  'instagram',
  'tiktok',
  'youtube',
  'facebook',
]

/**
 * Toutes les plateformes getlate.dev (prioritaires + secondaires).
 * Ordonnées : prioritaires d'abord.
 */
export const ALL_PLATFORMS: LatePlatform[] = [
  ...PRIORITY_PLATFORMS,
  'twitter',
  'linkedin',
  'bluesky',
  'threads',
  'reddit',
  'pinterest',
  'telegram',
  'snapchat',
  'google_business',
]
