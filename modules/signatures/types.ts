/**
 * @file modules/signatures/types.ts
 * @module signatures
 * @description Types TypeScript du module Signatures.
 *   Une Signature est un bloc de texte réutilisable (hashtags, CTA, liens bio)
 *   lié à UNE seule plateforme sociale. Plusieurs signatures peuvent exister par
 *   plateforme, dont une marquée "par défaut" (isDefault = true).
 *
 * @example
 *   const sig: Signature = {
 *     id: 'clxxx',
 *     userId: 'usr_1',
 *     name: 'Hashtags courts',
 *     text: '#photo #lifestyle #reels',
 *     platform: 'instagram',
 *     isDefault: true,
 *     createdAt: new Date(),
 *     updatedAt: new Date(),
 *   }
 */

// ─── Types de domaine ──────────────────────────────────────────────────────────

/**
 * Signature textuelle réutilisable pour un réseau social.
 * Correspond au modèle Prisma `Signature` (table "signatures").
 */
export interface Signature {
  id: string
  userId: string
  /** Libellé court affiché dans l'UI : "Hashtags courts", "CTA pro", etc. */
  name: string
  /** Contenu inséré dans le post (max 500 chars) */
  text: string
  /** Plateforme cible : "instagram" | "linkedin" | etc. */
  platform: string
  /** Vrai si c'est la signature par défaut pour cette plateforme */
  isDefault: boolean
  createdAt: Date
  updatedAt: Date
}

/**
 * Signatures groupées par plateforme.
 * Utilisé par la page /signatures pour afficher les sections par réseau.
 *
 * @example
 *   const grouped: SignaturesByPlatform = {
 *     instagram: [sig1, sig2],
 *     linkedin: [sig3],
 *   }
 */
export type SignaturesByPlatform = Record<string, Signature[]>
