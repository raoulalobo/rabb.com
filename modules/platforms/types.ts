/**
 * @file modules/platforms/types.ts
 * @module platforms
 * @description Types TypeScript du module platforms.
 *   Re-exporte les types inférés depuis les schémas Zod.
 *   Types supplémentaires spécifiques au module (états UI, etc.).
 *
 * @example
 *   import type { ConnectedPlatform, Platform } from '@/modules/platforms/types'
 */

export type {
  Platform,
  ConnectedPlatformData as ConnectedPlatform,
  PlatformListItem,
  ConnectPlatformData,
  DisconnectPlatformData,
} from './schemas/platform.schema'

// ─── Types UI ─────────────────────────────────────────────────────────────────

/**
 * État d'une carte plateforme dans la UI Settings.
 * Combine les données de la plateforme avec les états de chargement.
 */
export interface PlatformCardState {
  /** Connexion OAuth en cours → spinner + bouton désactivé */
  isConnecting: boolean
  /** Déconnexion en cours → spinner + bouton désactivé */
  isDisconnecting: boolean
}

/**
 * Résultat d'une Server Action (connect/disconnect).
 * Retourné par les actions pour afficher les toasts de feedback.
 */
export interface PlatformActionResult {
  success: boolean
  /** Message d'erreur si success = false */
  error?: string
  /** URL OAuth vers laquelle rediriger (pour connect) */
  redirectUrl?: string
}
