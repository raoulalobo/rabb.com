/**
 * @file modules/posts/schemas/content-type.schema.ts
 * @module posts
 * @description Schéma Zod pour le type de contenu d'un post (feed, story, reel, thread, carousel).
 *   Définit les valeurs possibles et les contraintes associées à chaque type.
 *
 *   Utilisé par :
 *   - PostCreateSchema / PostUpdateSchema (validation des mutations)
 *   - ContentTypePicker (sélection UI dans le PostComposer)
 *   - publish-scheduled-post.ts (transmission à Zernio)
 *
 * @example
 *   import { ContentTypeSchema, CONTENT_TYPE_CONFIG } from '@/modules/posts/schemas/content-type.schema'
 *   ContentTypeSchema.parse('reel') // OK
 *   ContentTypeSchema.parse('invalid') // ZodError
 */

import { z } from 'zod'

// ─── Schéma ──────────────────────────────────────────────────────────────────

/**
 * Types de contenu supportés par le PostComposer.
 *
 * - feed     : post classique dans le fil (image, vidéo ou texte seul)
 * - story    : contenu éphémère (24h) — Instagram, Facebook
 * - reel     : vidéo courte verticale — Instagram, TikTok, YouTube Shorts, Facebook
 * - thread   : chaîne de posts liés — Twitter/X, Bluesky, Threads
 * - carousel : post multi-images/vidéos avec navigation — Instagram, TikTok, LinkedIn
 */
export const ContentTypeSchema = z.enum([
  'feed',
  'story',
  'reel',
  'thread',
  'carousel',
])

export type ContentType = z.infer<typeof ContentTypeSchema>

// ─── Schéma pour les éléments de thread ──────────────────────────────────────

/**
 * Tableau de textes pour un thread.
 * Chaque élément correspond à un post individuel dans la chaîne.
 * Minimum 2 éléments (un thread d'un seul post n'a pas de sens).
 * Maximum 25 éléments (limite raisonnable pour éviter le spam).
 *
 * @example
 *   ThreadItemsSchema.parse(['Premier tweet', 'Deuxième tweet'])
 */
export const ThreadItemsSchema = z
  .array(z.string().min(1, 'Le texte ne peut pas être vide'))
  .min(2, 'Un thread doit contenir au moins 2 éléments')
  .max(25, 'Un thread ne peut pas dépasser 25 éléments')

// ─── Configuration par type de contenu ───────────────────────────────────────

/**
 * Configuration d'affichage pour chaque type de contenu.
 * Utilisé par ContentTypePicker pour afficher les options.
 *
 * @example
 *   CONTENT_TYPE_CONFIG.reel.label     // "Reel"
 *   CONTENT_TYPE_CONFIG.reel.platforms // ['instagram', 'tiktok', 'youtube', 'facebook']
 */
export const CONTENT_TYPE_CONFIG: Record<
  ContentType,
  {
    /** Label affiché dans l'UI (français) */
    label: string
    /** Description courte pour le tooltip */
    description: string
    /** Plateformes supportant ce type de contenu */
    platforms: string[]
  }
> = {
  feed: {
    label: 'Publication',
    description: 'Post classique dans le fil',
    platforms: [
      'instagram', 'tiktok', 'youtube', 'facebook', 'twitter',
      'linkedin', 'bluesky', 'threads', 'reddit', 'pinterest',
      'telegram', 'snapchat', 'google_business',
    ],
  },
  story: {
    label: 'Story',
    description: 'Contenu éphémère (24h)',
    platforms: ['instagram', 'facebook', 'snapchat'],
  },
  reel: {
    label: 'Reel / Short',
    description: 'Vidéo courte verticale',
    platforms: ['instagram', 'tiktok', 'youtube', 'facebook'],
  },
  thread: {
    label: 'Thread',
    description: 'Chaîne de posts liés',
    platforms: ['twitter', 'bluesky', 'threads'],
  },
  carousel: {
    label: 'Carrousel',
    description: 'Post multi-images avec navigation',
    platforms: ['instagram', 'tiktok', 'linkedin', 'facebook'],
  },
}

/**
 * Retourne les types de contenu disponibles pour une plateforme donnée.
 * Filtre CONTENT_TYPE_CONFIG pour ne garder que les types supportés.
 *
 * @param platform - Identifiant de la plateforme (ex: "instagram")
 * @returns Tableau de ContentType supportés par la plateforme
 *
 * @example
 *   getAvailableContentTypes('instagram')
 *   // → ['feed', 'story', 'reel', 'carousel']
 *
 *   getAvailableContentTypes('twitter')
 *   // → ['feed', 'thread']
 */
export function getAvailableContentTypes(platform: string): ContentType[] {
  return (Object.entries(CONTENT_TYPE_CONFIG) as [ContentType, typeof CONTENT_TYPE_CONFIG[ContentType]][])
    .filter(([, config]) => config.platforms.includes(platform))
    .map(([type]) => type)
}

/**
 * Retourne les types de contenu communs à toutes les plateformes sélectionnées.
 * Utile pour le PostComposer multi-plateformes : n'afficher que les types
 * supportés par TOUTES les plateformes sélectionnées.
 *
 * @param platforms - Plateformes sélectionnées
 * @returns Types de contenu communs (intersection)
 *
 * @example
 *   getCommonContentTypes(['instagram', 'facebook'])
 *   // → ['feed', 'story', 'reel', 'carousel']
 *
 *   getCommonContentTypes(['instagram', 'twitter'])
 *   // → ['feed'] (seul type commun)
 */
export function getCommonContentTypes(platforms: string[]): ContentType[] {
  if (platforms.length === 0) return ['feed']

  const allTypes: ContentType[] = ['feed', 'story', 'reel', 'thread', 'carousel']
  return allTypes.filter((type) =>
    platforms.every((platform) =>
      CONTENT_TYPE_CONFIG[type].platforms.includes(platform),
    ),
  )
}
