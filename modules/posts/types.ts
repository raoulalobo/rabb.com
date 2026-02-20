/**
 * @file modules/posts/types.ts
 * @module posts
 * @description Types TypeScript du module posts.
 *   Re-exporte les types inférés depuis les schémas Zod.
 *   Types additionnels pour les états UI et les réponses d'API.
 *
 * @example
 *   import type { Post, PostCreate, PostStatus } from '@/modules/posts/types'
 */

export type { PostCreate, PostUpdate, PostStatus } from './schemas/post.schema'

// ─── Type Post (modèle complet depuis la DB) ──────────────────────────────────

/**
 * Post complet tel que retourné par la base de données.
 * Correspond au modèle Prisma Post.
 */
export interface Post {
  id: string
  userId: string
  text: string
  platforms: string[]
  mediaUrls: string[]
  scheduledFor: Date | null
  publishedAt: Date | null
  status: 'DRAFT' | 'SCHEDULED' | 'PUBLISHED' | 'FAILED'
  latePostId: string | null
  createdAt: Date
  updatedAt: Date
}

// ─── Types UI ─────────────────────────────────────────────────────────────────

/**
 * Résultat d'une Server Action de création/mise à jour de post.
 */
export interface SavePostResult {
  success: boolean
  post?: Post
  error?: string
}

/**
 * Résultat de la génération d'un presigned URL d'upload.
 */
export interface UploadUrlResult {
  /** URL signée pour l'upload direct vers Supabase Storage (valide 60s) */
  signedUrl: string
  /** URL publique permanente du fichier après upload */
  publicUrl: string
  /** Chemin du fichier dans le bucket Supabase Storage */
  path: string
}

/**
 * Fichier en cours d'upload dans PostComposer.MediaUpload.
 * Combine les données du fichier avec l'état de progression.
 */
export interface UploadingFile {
  /** ID unique temporaire pour la gestion de l'état */
  id: string
  /** Fichier local sélectionné par l'utilisateur */
  file: File
  /** Progression de l'upload (0-100) */
  progress: number
  /** URL publique disponible après upload complet */
  publicUrl?: string
  /** Erreur d'upload si applicable */
  error?: string
}

// ─── Types AgentComposer ──────────────────────────────────────────────────────

/**
 * Média dans le pool de l'AgentComposer.
 * Un média uploadé sans destination assignée — l'agent décide où il va.
 */
export interface PoolMedia {
  /** URL publique Supabase Storage */
  url: string
  /** Type de média détecté depuis l'URL ou le MIME type */
  type: 'photo' | 'video'
  /** Nom du fichier original */
  filename: string
}

/**
 * Plan de publication pour une plateforme spécifique.
 * Produit par Claude via tool_use, affiché à l'utilisateur pour confirmation.
 */
export interface PlatformPlan {
  /** Plateforme cible */
  platform: string
  /** Texte adapté au ton et aux contraintes de la plateforme */
  text: string
  /** URLs des médias sélectionnés depuis le pool */
  mediaUrls: string[]
  /**
   * Date/heure de publication en ISO 8601.
   * null = publier immédiatement.
   */
  scheduledFor: string | null
  /**
   * Explication des choix faits par l'agent (affiché dans l'UI pour transparence).
   * Ex: "4 photos max sur Twitter — 1 photo ignorée. Texte raccourci à 280 car."
   */
  rationale: string
}

/**
 * Plan complet généré par l'agent Claude.
 * Contient un PlatformPlan pour chaque plateforme sélectionnée.
 */
export interface AgentPlan {
  /** Plans par plateforme */
  platforms: PlatformPlan[]
  /**
   * Message global de l'agent (optionnel).
   * Ex: "J'ai ignoré la 5e photo sur Twitter (limite 4). YouTube reçoit uniquement la vidéo."
   */
  summary?: string
}

// ─── Types fil de conversation UI ────────────────────────────────────────────

/**
 * Un message dans le fil de conversation affiché dans l'AgentComposer.
 *
 * Distinct de `ConversationTurn` (qui est un format Anthropic pour la DB) :
 * `ChatTurn` est exclusivement un type UI, jamais persisté.
 *
 * @example
 *   { role: 'user',  content: "Poste sur Instagram demain 9h", turnCount: 1 }
 *   { role: 'agent', content: "Plan généré pour 3 plateformes.", turnCount: 1 }
 *   { role: 'user',  content: "Retire YouTube",                 turnCount: 2 }
 *   { role: 'agent', content: "Plan mis à jour.",               turnCount: 2 }
 */
export interface ChatTurn {
  /** Émetteur du message */
  role: 'user' | 'agent'
  /** Contenu textuel du message */
  content: string
  /** Numéro du tour auquel ce message appartient */
  turnCount: number
}

// ─── Types AgentSession (conversation multi-tours) ────────────────────────────

/**
 * Représente un tour de conversation complet entre l'utilisateur et Claude.
 *
 * Stocké dans `AgentSession.conversationHistory` (JSON array en DB).
 * Permet de reconstruire les messages Anthropic pour le prochain tour :
 *
 * ```
 * Turn N → messages = [
 *   { role: 'user',      content: turn.instruction },
 *   { role: 'assistant', content: [{ type: 'tool_use', id: turn.toolUseId, input: turn.planSnapshot }] },
 * ]
 * Turn N+1 → ajouter :
 *   { role: 'user', content: [
 *       { type: 'tool_result', tool_use_id: lastTurn.toolUseId, content: 'Plan accepté.' },
 *       { type: 'text', text: newInstruction }
 *   ]}
 * ```
 */
export interface ConversationTurn {
  /** ID du bloc tool_use Anthropic (utilisé pour chaîner turn N → tool_result turn N+1) */
  toolUseId: string
  /** Instruction envoyée par l'utilisateur pour ce tour */
  instruction: string
  /** Plan retourné par Claude pour ce tour (snapshot complet) */
  planSnapshot: AgentPlan
  /** Timestamp ISO 8601 du tour */
  timestamp: string
}

/**
 * Données d'une session agent chargées depuis la DB.
 * Retournées par `getLatestDraftSession()`.
 *
 * @example
 *   const session = await getLatestDraftSession()
 *   if (session) {
 *     // session.turnCount > 0 → afficher le bandeau "Reprendre"
 *     // session.currentPlan → plan éditable rechargé
 *   }
 */
export interface AgentSessionData {
  /** Identifiant de la session en DB */
  id: string
  /** Pool de médias au moment de la dernière sauvegarde */
  mediaPool: PoolMedia[]
  /** Plan courant (null si session créée mais aucun plan généré) */
  currentPlan: AgentPlan | null
  /** Historique des tours pour la reconstruction du contexte Anthropic */
  conversationHistory: ConversationTurn[]
  /** Nombre de tours effectués (longueur de conversationHistory) */
  turnCount: number
  /** Date de dernière modification (pour afficher "modifié il y a Xh") */
  updatedAt: Date
}
