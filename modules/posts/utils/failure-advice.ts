/**
 * @file modules/posts/utils/failure-advice.ts
 * @module posts
 * @description Utilitaire pur d'analyse des raisons d'échec de publication.
 *   Analyse la chaîne `failureReason` retournée par Zernio (errorMessage)
 *   par pattern-matching et retourne un conseil actionnable pour l'utilisateur.
 *
 *   Catégories détectées :
 *   - duplicate_text     : "Duplicate content detected" (même texte republié)
 *   - duplicate_media    : "Le fichier média" / "hash du fichier" (même vidéo/image)
 *   - token_expired      : "Token expired" / "token expiré"
 *   - account_disconnected : "déconnecté" (token révoqué ou expiré)
 *   - missing_profile    : "Aucun profil" connecté pour la plateforme
 *   - content_error      : "user_content" / "frame_rate" (contenu rejeté par la plateforme)
 *   - timeout            : timeout de publication
 *   - unknown            : tout autre motif non reconnu
 *
 * @example
 *   import { getFailureAdvice } from '@/modules/posts/utils/failure-advice'
 *
 *   const advice = getFailureAdvice("Compte tiktok déconnecté de Late (token expiré ou révoqué)")
 *   // → { category: 'account_disconnected', summary: 'Compte déconnecté', ... }
 */

// ─── Types ────────────────────────────────────────────────────────────────────

/** Catégorie d'échec détectée par pattern-matching sur failureReason */
export type FailureCategory =
  | 'duplicate_text'
  | 'duplicate_media'
  | 'token_expired'
  | 'account_disconnected'
  | 'missing_profile'
  | 'content_error'
  | 'timeout'
  | 'unknown'

/**
 * Conseil actionnable associé à un échec de publication.
 *
 * @example
 *   {
 *     category: 'token_expired',
 *     summary: 'Token expiré',
 *     advice: 'Reconnectez votre compte sur la page Paramètres pour renouveler le token.',
 *     actionLink: '/settings',
 *     actionLabel: 'Aller aux paramètres',
 *     canRetry: false,
 *   }
 */
export interface FailureAdvice {
  /** Catégorie technique de l'échec (utilisée pour le regroupement et les analytics) */
  category: FailureCategory
  /** Résumé court (1 ligne) pour les espaces compacts (chip title, popover header) */
  summary: string
  /** Conseil actionnable (1-2 phrases) expliquant comment corriger le problème */
  advice: string
  /** Lien interne vers la page permettant de corriger (ex: '/settings') */
  actionLink?: string
  /** Libellé du bouton/lien d'action (ex: 'Aller aux paramètres') */
  actionLabel?: string
  /** true si un retry (replanification) a des chances de fonctionner */
  canRetry: boolean
}

// ─── Patterns de détection ────────────────────────────────────────────────────

/**
 * Règle de détection : un pattern regex + le conseil associé.
 * L'ordre est important : la première correspondance est retournée.
 */
interface DetectionRule {
  /** Regex appliquée sur failureReason (case-insensitive) */
  pattern: RegExp
  /** Conseil retourné si le pattern matche */
  advice: FailureAdvice
}

/**
 * Règles de détection ordonnées par priorité.
 * La première correspondance est retournée — les patterns les plus spécifiques sont en premier.
 *
 * Basé sur les messages d'erreur retournés par l'API Zernio (errorMessage).
 */
const DETECTION_RULES: DetectionRule[] = [
  // ── Doublon texte (Cas A : même texte déjà publié) ──────────────────────────
  // Message réel : "· Ce contenu a déjà été publié sur {platform} le {date}."
  {
    pattern: /déjà été publié|duplicate content/i,
    advice: {
      category: 'duplicate_text',
      summary: 'Contenu dupliqué',
      advice:
        'Ce texte a déjà été publié sur cette plateforme. Modifiez le contenu avant de republier.',
      canRetry: false,
    },
  },

  // ── Doublon média (Cas B : même fichier vidéo/image via hash) ───────────────
  // Message réel : "· Le fichier média (vidéo ou image) a déjà été publié..."
  {
    pattern: /fichier média|hash du fichier/i,
    advice: {
      category: 'duplicate_media',
      summary: 'Média dupliqué',
      advice:
        'Ce fichier a déjà été publié. Essayez avec un fichier légèrement différent (recadrage, recompression).',
      canRetry: false,
    },
  },

  // ── Token expiré (Late ne reconnaît plus le compte) ─────────────────────────
  // Message réel : "Token expired" ou "token expiré"
  {
    pattern: /token expired|token expiré/i,
    advice: {
      category: 'token_expired',
      summary: 'Token expiré',
      advice:
        'Le token d\'accès a expiré. Reconnectez votre compte sur la page Paramètres.',
      actionLink: '/settings',
      actionLabel: 'Aller aux paramètres',
      canRetry: false,
    },
  },

  // ── Compte déconnecté (token révoqué ou expiré côté Late) ───────────────────
  // Message réel : "Compte {platform} déconnecté de Late (token expiré ou révoqué)"
  {
    pattern: /déconnecté de late/i,
    advice: {
      category: 'account_disconnected',
      summary: 'Compte déconnecté',
      advice:
        'Ce compte social n\'est plus connecté. Reconnectez-le sur la page Paramètres.',
      actionLink: '/settings',
      actionLabel: 'Aller aux paramètres',
      canRetry: false,
    },
  },

  // ── Profil manquant (aucune ConnectedPlatform active) ───────────────────────
  // Message réel : "Aucun profil {platform} connecté pour la publication"
  {
    pattern: /aucun profil/i,
    advice: {
      category: 'missing_profile',
      summary: 'Profil non connecté',
      advice:
        'Aucun profil n\'est connecté pour cette plateforme. Connectez-le sur la page Paramètres.',
      actionLink: '/settings',
      actionLabel: 'Aller aux paramètres',
      canRetry: false,
    },
  },

  // ── Erreur de contenu (user_content : framerate, format, etc.) ──────────────
  // Message réel : errorCategory === 'user_content' dans la réponse Late
  // Exemples : "frame_rate_check_failed", format vidéo non supporté
  {
    pattern: /user_content|frame_rate/i,
    advice: {
      category: 'content_error',
      summary: 'Contenu rejeté',
      advice:
        'La plateforme a rejeté le contenu (format, framerate ou type non supporté). Vérifiez les spécifications.',
      canRetry: false,
    },
  },

  // ── Timeout (la publication n'a pas abouti à temps) ──────────────────────────
  {
    pattern: /timeout|timed out|watchdog/i,
    advice: {
      category: 'timeout',
      summary: 'Timeout de publication',
      advice:
        'La publication n\'a pas abouti dans le temps imparti. Vous pouvez replanifier ce post.',
      canRetry: true,
    },
  },
]

// ─── Fonction principale ──────────────────────────────────────────────────────

/**
 * Analyse une failureReason et retourne un conseil actionnable.
 * Effectue un pattern-matching séquentiel sur les règles de détection.
 * Retourne un conseil générique si aucun pattern ne matche.
 *
 * @param failureReason - Message d'erreur Zernio (errorMessage, peut être vide ou null)
 * @returns FailureAdvice avec summary, advice, et éventuellement un lien d'action
 *
 * @example
 *   // Token expiré
 *   getFailureAdvice("Compte tiktok déconnecté de Late (token expiré ou révoqué)")
 *   // → { category: 'account_disconnected', summary: 'Compte déconnecté', actionLink: '/settings', ... }
 *
 * @example
 *   // Doublon texte
 *   getFailureAdvice("Late : publication échouée sur facebook · Ce contenu a déjà été publié le 3 mars 2026.")
 *   // → { category: 'duplicate_text', summary: 'Contenu dupliqué', canRetry: false, ... }
 *
 * @example
 *   // Erreur inconnue
 *   getFailureAdvice("Erreur réseau inattendue")
 *   // → { category: 'unknown', summary: 'Erreur de publication', canRetry: true, ... }
 */
export function getFailureAdvice(failureReason: string | null | undefined): FailureAdvice {
  // Chaîne vide ou nulle → conseil générique
  if (!failureReason) {
    return {
      category: 'unknown',
      summary: 'Erreur de publication',
      advice: 'Une erreur inconnue est survenue. Vous pouvez tenter de replanifier le post.',
      canRetry: true,
    }
  }

  // Pattern-matching séquentiel : la première correspondance gagne
  for (const rule of DETECTION_RULES) {
    if (rule.pattern.test(failureReason)) {
      return rule.advice
    }
  }

  // Aucun pattern ne matche → conseil générique (retry possible)
  return {
    category: 'unknown',
    summary: 'Erreur de publication',
    advice: 'Une erreur est survenue lors de la publication. Vous pouvez tenter de replanifier le post.',
    canRetry: true,
  }
}
