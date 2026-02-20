/**
 * @file lib/late.ts
 * @description Client HTTP singleton pour l'API getlate.dev.
 *   Toutes les interactions avec getlate.dev passent par ce fichier.
 *   Ne jamais appeler l'API getlate.dev directement depuis les composants.
 *
 *   Authentification : LATE_API_KEY dans l'en-tête Authorization (Bearer).
 *   Base URL : https://api.getlate.dev (configurable via LATE_API_URL).
 *
 * @example
 *   import { late } from '@/lib/late'
 *   // Initier la connexion OAuth (endpoint correct getlate.dev)
 *   const { authUrl } = await late.connect.getUrl('instagram', 'https://rabb.com/api/platforms/callback')
 *   const post = await late.posts.create({ text: '...', platforms: [{ platform: 'instagram', accountId: '...' }] })
 */

// ─── Types de l'API getlate.dev ────────────────────────────────────────────────

/** Plateformes supportées par getlate.dev */
export type LatePlatform =
  | 'instagram'
  | 'tiktok'
  | 'youtube'
  | 'facebook'
  | 'twitter'
  | 'linkedin'
  | 'bluesky'
  | 'threads'
  | 'reddit'
  | 'pinterest'
  | 'telegram'
  | 'snapchat'
  | 'google_business'

/**
 * Workspace Late (profil conteneur).
 * Regroupe plusieurs comptes sociaux connectés d'un même utilisateur.
 * Créé via POST /api/v1/profiles avant d'initier le flux OAuth.
 *
 * Note : Late utilise MongoDB → l'ID est "_id" (pas "id").
 */
export interface LateWorkspaceProfile {
  _id: string       // ID MongoDB du workspace
  name: string
  color?: string
  isDefault?: boolean
}

/**
 * Réponse de GET /api/v1/profiles — tableau enveloppé dans { profiles: [...] }.
 */
export interface LateProfilesListResponse {
  profiles: LateWorkspaceProfile[]
}

/**
 * Réponse de l'endpoint GET /api/v1/connect/{platform}.
 * Contient l'URL OAuth vers laquelle rediriger l'utilisateur.
 */
export interface LateConnectResponse {
  /** URL OAuth de redirection vers la page d'autorisation (Instagram, TikTok…) */
  authUrl: string
  /** Identifiant d'état opaque pour validation CSRF (géré par Late) */
  state: string
}

/** Post publié ou planifié via getlate.dev */
export interface LatePost {
  id: string
  text: string
  profileIds: string[]
  scheduledAt?: string
  publishedAt?: string
  status: 'draft' | 'scheduled' | 'published' | 'failed'
  mediaUrls?: string[]
}

/** Paramètres pour créer un post */
export interface LateCreatePostParams {
  text: string
  profileIds: string[]
  scheduledAt?: string
  mediaUrls?: string[]
}

/** Statistiques d'un post */
export interface LatePostStats {
  postId: string
  platform: LatePlatform
  views: number
  likes: number
  comments: number
  shares: number
  date: string
}

/** Message de l'inbox */
export interface LateInboxMessage {
  id: string
  profileId: string
  platform: LatePlatform
  authorName: string
  authorAvatarUrl?: string
  text: string
  createdAt: string
  isRead: boolean
  postId?: string
}

// ─── Client HTTP ───────────────────────────────────────────────────────────────

/**
 * Erreur retournée par l'API getlate.dev.
 * Encapsule le code HTTP et le message d'erreur.
 */
export class LateApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = 'LateApiError'
  }
}

/**
 * Client HTTP bas niveau pour l'API getlate.dev.
 * Gère l'authentification, le parsing JSON et les erreurs.
 */
class LateClient {
  private readonly baseUrl: string
  private readonly apiKey: string

  constructor() {
    // Base URL réelle du serveur getlate.dev.
    // Note : api.getlate.dev ne résout pas en DNS — le vrai host est getlate.dev.
    // Vérifié : GET https://getlate.dev/api/v1/connect/get-connect-url → 401 (auth requise ✅)
    //           GET https://getlate.dev/v1/connect/get-connect-url       → 404 ❌
    this.baseUrl = process.env.LATE_API_URL ?? 'https://getlate.dev'
    this.apiKey = process.env.LATE_API_KEY ?? ''
  }

  /**
   * Effectue une requête HTTP vers l'API getlate.dev.
   * Ajoute automatiquement l'en-tête Authorization et Content-Type.
   *
   * @param path - Chemin de l'endpoint (ex: '/api/v1/profiles')
   * @param init - Options fetch (method, body, etc.)
   * @returns Données parsées en JSON
   * @throws LateApiError si la réponse n'est pas OK
   */
  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
        ...init?.headers,
      },
    })

    if (!response.ok) {
      // Lire le corps brut pour diagnostiquer l'erreur (log + message)
      let message = `Erreur API getlate.dev : ${response.status}`
      let rawBody = ''
      try {
        rawBody = await response.text()
        console.error(`[LateClient] ${response.status} ${path} →`, rawBody)
        const parsed = JSON.parse(rawBody) as { message?: string }
        if (parsed.message) message = parsed.message
      } catch {
        // Ignorer les erreurs de parsing
        if (rawBody) console.error('[LateClient] corps non-JSON :', rawBody)
      }
      throw new LateApiError(response.status, message)
    }

    // 204 No Content : pas de corps JSON
    if (response.status === 204) return undefined as T

    return response.json() as Promise<T>
  }

  // ─── Connexion OAuth (initiation du flux) ───────────────────────────────────

  /**
   * Ressource "connect" : initiation du flux OAuth getlate.dev.
   * Utiliser cette ressource pour connecter un compte social.
   *
   * Endpoint correct : GET /api/v1/connect/{platform}?profileId=...&redirect_url=...
   * Vérifié par curl — retourne { authUrl, state } ✅
   */
  readonly connect = {
    /**
     * Obtient l'URL OAuth pour connecter une plateforme sociale.
     * Redirige l'utilisateur vers cette URL pour autoriser l'accès.
     *
     * @param platform    - La plateforme à connecter (ex: 'instagram')
     * @param redirectUrl - URL de callback après autorisation OAuth
     * @returns { authUrl } — URL OAuth où rediriger l'utilisateur
     *
     * @example
     *   const { authUrl } = await late.connect.getUrl(
     *     'instagram',
     *     'https://rabb.com/api/platforms/callback',
     *   )
     *   window.location.href = authUrl
     */
    /**
     * Obtient l'URL OAuth pour connecter un compte social à un workspace Late.
     *
     * @param platform   - La plateforme à connecter (ex: 'tiktok', 'instagram')
     * @param profileId  - ID du workspace Late (_id MongoDB, via late.profiles.list)
     * @param redirectUrl - URL de callback après autorisation OAuth
     * @returns { authUrl, tempToken, state }
     *
     * @example
     *   const { authUrl } = await late.connect.getUrl('tiktok', 'prof_abc', callbackUrl)
     *   window.location.href = authUrl
     */
    getUrl: (platform: LatePlatform, profileId: string, redirectUrl: string) =>
      // Endpoint correct : GET /api/v1/connect/{platform}?profileId=...&redirect_url=...
      // Vérifié par curl : retourne { authUrl, state } ✅
      this.request<LateConnectResponse>(
        `/api/v1/connect/${platform}?profileId=${profileId}&redirect_url=${encodeURIComponent(redirectUrl)}`,
      ),
  }

  // ─── Profils (comptes sociaux connectés) ────────────────────────────────────

  /**
   * Ressource "profiles" : gestion des workspaces Late.
   * Un workspace est un conteneur qui regroupe plusieurs comptes sociaux connectés.
   * Chaque utilisateur rabb a UN workspace Late, créé automatiquement au premier connect.
   */
  readonly profiles = {
    /**
     * Liste les workspaces Late existants sur le compte.
     * Utiliser cette méthode pour récupérer un workspace existant avant d'en créer un nouveau.
     *
     * @returns Tableau de workspaces (trié par date de création)
     *
     * @example
     *   const profiles = await late.profiles.list()
     *   const workspaceId = profiles[0]?.id
     */
    list: () =>
      // Réponse enveloppée : { profiles: [...] } (pas un tableau direct)
      this.request<LateProfilesListResponse>('/api/v1/profiles'),

    /**
     * Crée un workspace Late pour un utilisateur.
     * À appeler seulement si aucun workspace n'existe (vérifier via list() d'abord).
     *
     * @param params.name - Nom du workspace (ex: nom de l'utilisateur)
     * @returns Workspace créé avec son ID à stocker sur User.lateWorkspaceId
     *
     * @example
     *   const { id } = await late.profiles.create({ name: 'Marie Dupont' })
     *   // Sauvegarder id dans User.lateWorkspaceId
     */
    create: (params: { name: string }) =>
      this.request<LateWorkspaceProfile>('/api/v1/profiles', {
        method: 'POST',
        body: JSON.stringify(params),
      }),

    /**
     * Supprime un workspace Late et tous les comptes sociaux associés.
     *
     * @param profileId - ID du workspace Late à supprimer
     */
    delete: (profileId: string) =>
      this.request<void>(`/api/v1/profiles/${profileId}`, {
        method: 'DELETE',
      }),

    /**
     * Récupère les détails d'un workspace Late.
     *
     * @param profileId - ID du workspace Late
     * @returns Détails du workspace
     */
    get: (profileId: string) =>
      this.request<LateWorkspaceProfile>(`/api/v1/profiles/${profileId}`),
  }

  // ─── Posts ───────────────────────────────────────────────────────────────────

  /**
   * Ressource "posts" : création, planification et publication de contenu.
   */
  readonly posts = {
    /**
     * Crée et planifie un post via getlate.dev.
     * Si scheduledAt est défini, le post est planifié ; sinon il est publié immédiatement.
     *
     * @param params - Données du post (texte, profils cibles, date de planification)
     * @returns Post créé avec son ID getlate.dev
     *
     * @example
     *   const post = await late.posts.create({
     *     text: 'Mon premier post 🎉',
     *     profileIds: ['prof_abc123'],
     *     scheduledAt: '2024-03-15T10:00:00Z',
     *   })
     */
    create: (params: LateCreatePostParams) =>
      this.request<LatePost>('/api/v1/posts', {
        method: 'POST',
        body: JSON.stringify(params),
      }),

    /**
     * Récupère un post par son ID.
     *
     * @param postId - ID du post getlate.dev
     */
    get: (postId: string) =>
      this.request<LatePost>(`/api/v1/posts/${postId}`),

    /**
     * Supprime un post planifié (non encore publié).
     *
     * @param postId - ID du post à annuler
     */
    delete: (postId: string) =>
      this.request<void>(`/api/v1/posts/${postId}`, { method: 'DELETE' }),

    /**
     * Récupère les statistiques d'un post publié.
     *
     * @param postId - ID du post getlate.dev
     * @returns Statistiques par plateforme
     */
    stats: (postId: string) =>
      this.request<LatePostStats[]>(`/api/v1/posts/${postId}/stats`),
  }

  // ─── Analytics ───────────────────────────────────────────────────────────────

  /**
   * Ressource "analytics" : statistiques agrégées par profil.
   */
  readonly analytics = {
    /**
     * Récupère les statistiques d'un profil sur une période.
     *
     * @param profileId - ID du profil getlate.dev
     * @param params.from - Date de début (ISO 8601)
     * @param params.to - Date de fin (ISO 8601)
     * @returns Statistiques agrégées
     */
    get: (profileId: string, params: { from: string; to: string }) => {
      const query = new URLSearchParams(params).toString()
      return this.request<LatePostStats[]>(`/api/v1/profiles/${profileId}/analytics?${query}`)
    },
  }

  // ─── Inbox ───────────────────────────────────────────────────────────────────

  /**
   * Ressource "inbox" : messages et commentaires reçus sur les réseaux sociaux.
   */
  readonly inbox = {
    /**
     * Liste les messages non lus d'un profil.
     *
     * @param profileId - ID du profil getlate.dev
     * @returns Liste des messages inbox
     */
    list: (profileId: string) =>
      this.request<LateInboxMessage[]>(`/api/v1/profiles/${profileId}/inbox`),

    /**
     * Répond à un message inbox.
     *
     * @param messageId - ID du message auquel répondre
     * @param text - Texte de la réponse
     */
    reply: (messageId: string, text: string) =>
      this.request<void>(`/api/v1/inbox/${messageId}/reply`, {
        method: 'POST',
        body: JSON.stringify({ text }),
      }),
  }
}

// ─── Singleton ─────────────────────────────────────────────────────────────────

/**
 * Instance singleton du client getlate.dev.
 * Utiliser directement dans les Server Actions et Route Handlers.
 *
 * @example
 *   import { late } from '@/lib/late'
 *   // Initier le flux OAuth pour connecter Instagram
 *   const { authUrl } = await late.connect.getUrl('instagram', callbackUrl)
 */
export const late = new LateClient()
