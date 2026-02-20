/**
 * @file modules/platforms/config/platform-rules.ts
 * @module platforms
 * @description Règles et contraintes de chaque plateforme sociale supportée par getlate.dev.
 *   Ces règles sont utilisées par le PostComposer pour :
 *   - Afficher la limite de caractères selon l'onglet actif
 *   - Limiter le nombre de médias uploadés par onglet
 *   - Afficher des avertissements visuels si le contenu dépasse les limites
 *   - Filtrer les types MIME acceptés selon la plateforme
 *
 * @example
 *   import { PLATFORM_RULES, getPlatformViolations } from '@/modules/platforms/config/platform-rules'
 *   const rules = PLATFORM_RULES['instagram']  // { maxPhotos: 10, maxText: 2200, ... }
 *   const violations = getPlatformViolations('twitter', 'Mon texte très long...', [])
 */

import type { Platform } from '@/modules/platforms/types'

// ─── Interface des règles ─────────────────────────────────────────────────────

/**
 * Règles de contenu d'une plateforme sociale.
 * Utilisées pour valider le contenu dans le PostComposer avant soumission.
 */
export interface PlatformRules {
  /** Nombre maximum de photos dans un post (0 = photos interdites) */
  maxPhotos: number
  /** Nombre maximum de vidéos dans un post (0 = vidéo interdite) */
  maxVideos: number
  /** La plateforme accepte-t-elle photos ET vidéo dans le même post ? */
  allowsMixed: boolean
  /** Limite de caractères du texte */
  maxText: number
  /** Un média est-il obligatoire pour publier ? (ex: YouTube) */
  requiresMedia: boolean
  /** Types MIME acceptés (ex: ['image/*', 'video/mp4']) */
  allowedMimeTypes: string[]
}

/**
 * Violation de règle détectée dans le contenu d'une plateforme.
 * Affichée sous forme d'avertissement dans l'onglet de la plateforme concernée.
 */
export interface PlatformViolation {
  /** Type de violation pour le tri/affichage */
  type: 'text_too_long' | 'too_many_photos' | 'too_many_videos' | 'media_required' | 'mixed_not_allowed'
  /** Message lisible en français */
  message: string
}

// ─── Règles par plateforme ────────────────────────────────────────────────────

/**
 * Table des règles par plateforme.
 * Sources : documentation officielle de chaque réseau (février 2025).
 *
 * Règles clés :
 * - instagram  : 10 photos OU 1 vidéo par post, 2200 caractères
 * - tiktok     : 35 photos OU 1 vidéo, 2200 caractères
 * - youtube    : vidéo obligatoire, 5000 caractères de description
 * - facebook   : jusqu'à 100 photos, 63 206 caractères
 * - twitter    : 4 photos OU 1 vidéo, 280 caractères
 * - linkedin   : 9 photos OU 1 vidéo, 3000 caractères
 * - bluesky    : 4 photos OU 1 vidéo, 300 caractères
 * - threads    : 10 photos OU 1 vidéo, 500 caractères
 * - reddit     : 20 photos OU 1 vidéo, 40 000 caractères
 * - pinterest  : 1 photo OU 1 vidéo, 500 caractères
 * - telegram   : 10 médias (mixte autorisé), 4096 caractères
 * - snapchat   : 1 média, 250 caractères
 * - google_business : 1 photo uniquement, 1500 caractères
 */
export const PLATFORM_RULES: Record<Platform, PlatformRules> = {
  instagram: {
    maxPhotos: 10,
    maxVideos: 1,
    allowsMixed: false,
    maxText: 2200,
    requiresMedia: false,
    allowedMimeTypes: ['image/*', 'video/*'],
  },
  tiktok: {
    maxPhotos: 35,
    maxVideos: 1,
    allowsMixed: false,
    maxText: 2200,
    requiresMedia: false,
    allowedMimeTypes: ['image/*', 'video/*'],
  },
  youtube: {
    maxPhotos: 0,
    maxVideos: 1,
    allowsMixed: false,
    maxText: 5000,
    requiresMedia: true,
    allowedMimeTypes: ['video/*'],
  },
  facebook: {
    maxPhotos: 100,
    maxVideos: 1,
    allowsMixed: false,
    maxText: 63206,
    requiresMedia: false,
    allowedMimeTypes: ['image/*', 'video/*'],
  },
  twitter: {
    maxPhotos: 4,
    maxVideos: 1,
    allowsMixed: false,
    maxText: 280,
    requiresMedia: false,
    allowedMimeTypes: ['image/*', 'video/*'],
  },
  linkedin: {
    maxPhotos: 9,
    maxVideos: 1,
    allowsMixed: false,
    maxText: 3000,
    requiresMedia: false,
    allowedMimeTypes: ['image/*', 'video/*'],
  },
  bluesky: {
    maxPhotos: 4,
    maxVideos: 1,
    allowsMixed: false,
    maxText: 300,
    requiresMedia: false,
    allowedMimeTypes: ['image/*', 'video/*'],
  },
  threads: {
    maxPhotos: 10,
    maxVideos: 1,
    allowsMixed: false,
    maxText: 500,
    requiresMedia: false,
    allowedMimeTypes: ['image/*', 'video/*'],
  },
  reddit: {
    maxPhotos: 20,
    maxVideos: 1,
    allowsMixed: false,
    maxText: 40000,
    requiresMedia: false,
    allowedMimeTypes: ['image/*', 'video/*'],
  },
  pinterest: {
    maxPhotos: 1,
    maxVideos: 1,
    allowsMixed: false,
    maxText: 500,
    requiresMedia: false,
    allowedMimeTypes: ['image/*', 'video/*'],
  },
  telegram: {
    maxPhotos: 10,
    maxVideos: 1,
    // Telegram permet de mélanger photos et vidéos dans un même post
    allowsMixed: true,
    maxText: 4096,
    requiresMedia: false,
    allowedMimeTypes: ['image/*', 'video/*'],
  },
  snapchat: {
    maxPhotos: 1,
    maxVideos: 1,
    allowsMixed: false,
    maxText: 250,
    requiresMedia: false,
    allowedMimeTypes: ['image/*', 'video/*'],
  },
  google_business: {
    maxPhotos: 1,
    maxVideos: 0,
    allowsMixed: false,
    maxText: 1500,
    requiresMedia: false,
    // Google Business : uniquement les images (pas de vidéo)
    allowedMimeTypes: ['image/*'],
  },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Calcule le nombre maximum de médias autorisé pour un ensemble de plateformes.
 * Retourne le minimum de `maxPhotos` sur toutes les plateformes sélectionnées.
 * Utilisé par MediaUpload dans l'onglet "Tous" pour la limite commune.
 *
 * @param platforms - Liste des plateformes sélectionnées dans le brouillon
 * @returns Nombre max de médias (le plus restrictif parmi les plateformes)
 *
 * @example
 *   getMaxMediaForPlatforms(['instagram', 'twitter']) // 4 (twitter est le plus restrictif)
 *   getMaxMediaForPlatforms(['instagram', 'facebook']) // 10 (instagram plus restrictif)
 *   getMaxMediaForPlatforms([]) // 10 (défaut si aucune plateforme)
 */
export function getMaxMediaForPlatforms(platforms: Platform[]): number {
  if (platforms.length === 0) return 10

  return platforms.reduce((min, platform) => {
    const rules = PLATFORM_RULES[platform]
    // Prendre le max entre photos et vidéos (on ne sait pas encore quel type sera uploadé)
    const maxMedia = Math.max(rules.maxPhotos, rules.maxVideos)
    return Math.min(min, maxMedia)
  }, Infinity)
}

/**
 * Détecte les violations de règles d'une plateforme pour un contenu donné.
 * Retourne une liste de violations à afficher comme avertissements dans l'UI.
 *
 * @param platform - Plateforme à valider
 * @param text - Texte du post (base ou override)
 * @param mediaUrls - URLs des médias (base ou override)
 * @returns Liste de violations (vide si tout est OK)
 *
 * @example
 *   // Texte trop long pour Twitter :
 *   getPlatformViolations('twitter', 'Un texte très long de 400 caractères...', [])
 *   // → [{ type: 'text_too_long', message: 'Texte trop long (400/280 caractères)' }]
 *
 *   // Vidéo requise pour YouTube sans média :
 *   getPlatformViolations('youtube', 'Description vidéo', [])
 *   // → [{ type: 'media_required', message: 'Une vidéo est requise pour YouTube' }]
 */
export function getPlatformViolations(
  platform: Platform,
  text: string,
  mediaUrls: string[],
): PlatformViolation[] {
  const rules = PLATFORM_RULES[platform]
  const violations: PlatformViolation[] = []

  // Vérification : texte trop long
  if (text.length > rules.maxText) {
    violations.push({
      type: 'text_too_long',
      message: `Texte trop long (${text.length}/${rules.maxText} caractères)`,
    })
  }

  // Vérification : média requis (ex: YouTube)
  if (rules.requiresMedia && mediaUrls.length === 0) {
    violations.push({
      type: 'media_required',
      message: `Un média est requis pour ${platform}`,
    })
  }

  // Heuristique simple : on détecte les vidéos par extension d'URL
  const videoUrls = mediaUrls.filter((url) =>
    /\.(mp4|mov|avi|webm|mkv|m4v)$/i.test(url),
  )
  const photoUrls = mediaUrls.filter((url) => !videoUrls.includes(url))

  // Vérification : trop de photos
  if (photoUrls.length > rules.maxPhotos) {
    violations.push({
      type: 'too_many_photos',
      message: `Trop de photos (${photoUrls.length}/${rules.maxPhotos} max pour ${platform})`,
    })
  }

  // Vérification : trop de vidéos
  if (videoUrls.length > rules.maxVideos) {
    violations.push({
      type: 'too_many_videos',
      message: `Trop de vidéos (${videoUrls.length}/${rules.maxVideos} max pour ${platform})`,
    })
  }

  // Vérification : mixte photos + vidéos non autorisé
  if (!rules.allowsMixed && photoUrls.length > 0 && videoUrls.length > 0) {
    violations.push({
      type: 'mixed_not_allowed',
      message: `${platform} n'accepte pas les photos et vidéos dans le même post`,
    })
  }

  return violations
}
