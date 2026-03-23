/**
 * @file modules/posts/schemas/platform-overrides.schema.ts
 * @module posts
 * @description Schémas Zod pour les surcharges de contenu par plateforme (platformOverrides).
 *   Permet de valider la structure JSON stockée en DB et transmise dans les Server Actions.
 *
 *   Structure : un dictionnaire optionnel { platform → { text, mediaUrls } }.
 *   Chaque plateforme présente dans le dictionnaire a un contenu personnalisé ;
 *   les plateformes absentes utilisent le contenu de base du post.
 *
 *   Utilisé par :
 *   - PostCreateSchema / PostUpdateSchema (validation des mutations)
 *   - save-post.action.ts (Server Action)
 *   - schedule-post.action.ts (Server Action)
 *   - publish-scheduled-post.ts (fonction Inngest)
 *
 * @example
 *   import { PlatformOverridesSchema } from '@/modules/posts/schemas/platform-overrides.schema'
 *
 *   const overrides = PlatformOverridesSchema.parse({
 *     instagram: { text: 'Texte Instagram personnalisé', mediaUrls: [] },
 *     twitter:   { text: 'Tweet court', mediaUrls: ['https://...'] },
 *   })
 */

import { z } from 'zod'

// ─── Schéma d'un override individuel ────────────────────────────────────────

/**
 * Contenu personnalisé pour une plateforme spécifique.
 * Remplace le texte et/ou les médias de base du post lors de la publication
 * sur cette plateforme.
 *
 * @example
 *   PlatformOverrideItemSchema.parse({
 *     text: 'Mon texte adapté pour Instagram #reels',
 *     mediaUrls: ['https://storage.supabase.co/.../photo.jpg'],
 *   })
 */
export const PlatformOverrideItemSchema = z.object({
  /** Texte spécifique à cette plateforme (remplace le texte de base) */
  text: z.string().max(63206, 'Le texte dépasse la limite maximale'),
  /** URLs de médias spécifiques à cette plateforme (remplace les médias de base) */
  mediaUrls: z.array(z.string().url()).max(35).default([]),
})

export type PlatformOverrideItem = z.infer<typeof PlatformOverrideItemSchema>

// ─── Schéma du dictionnaire complet ────────────────────────────────────────

/**
 * Dictionnaire des surcharges par plateforme.
 * Les clés sont les identifiants de plateforme (ex: "instagram", "tiktok").
 * Les valeurs sont des objets PlatformOverrideItem { text, mediaUrls }.
 *
 * Peut être :
 * - undefined / null : pas de surcharges, le contenu de base est utilisé partout
 * - {} (vide) : aucune personnalisation active (équivalent à null)
 * - { instagram: { text: '...', mediaUrls: [] } } : Instagram personnalisé, les autres utilisent la base
 *
 * @example
 *   PlatformOverridesSchema.parse({
 *     instagram: { text: 'Version Instagram', mediaUrls: [] },
 *     twitter:   { text: 'Version courte pour Twitter', mediaUrls: [] },
 *   })
 *
 *   // null = pas de surcharges
 *   PlatformOverridesSchema.nullable().parse(null)
 */
export const PlatformOverridesSchema = z.record(
  z.string(),
  PlatformOverrideItemSchema,
)

export type PlatformOverrides = z.infer<typeof PlatformOverridesSchema>

// ─── Helper de nettoyage ────────────────────────────────────────────────────

/**
 * Nettoie les overrides avant persistance en DB.
 * Supprime les entrées dont le texte est identique au texte de base ET
 * dont les médias sont identiques aux médias de base (override inutile).
 * Retourne null si le dictionnaire résultant est vide (aucun override effectif).
 *
 * @param overrides - Dictionnaire brut des overrides
 * @param baseText - Texte de base du post
 * @param baseMediaUrls - Médias de base du post
 * @returns Dictionnaire nettoyé ou null si aucun override effectif
 *
 * @example
 *   cleanPlatformOverrides(
 *     { instagram: { text: 'Hello', mediaUrls: [] } },
 *     'Hello',    // identique → supprimé
 *     [],         // identique → supprimé
 *   )
 *   // → null (aucun override effectif)
 *
 *   cleanPlatformOverrides(
 *     { instagram: { text: 'Texte spécial', mediaUrls: [] } },
 *     'Texte de base',
 *     [],
 *   )
 *   // → { instagram: { text: 'Texte spécial', mediaUrls: [] } }
 */
export function cleanPlatformOverrides(
  overrides: PlatformOverrides | null | undefined,
  baseText: string,
  baseMediaUrls: string[],
): PlatformOverrides | null {
  if (!overrides) return null

  // Filtrer les overrides dont le contenu diffère réellement de la base
  const cleaned = Object.fromEntries(
    Object.entries(overrides).filter(([, value]) => {
      // L'override est "effectif" si le texte OU les médias diffèrent de la base
      const textDiffers = value.text !== baseText
      const mediaDiffers =
        JSON.stringify(value.mediaUrls) !== JSON.stringify(baseMediaUrls)
      return textDiffers || mediaDiffers
    }),
  )

  // Retourner null si aucun override effectif (évite de stocker {} en DB)
  return Object.keys(cleaned).length > 0 ? cleaned : null
}
