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
 *   // Initier la connexion OAuth
 *   const { authUrl } = await late.connect.getUrl('instagram', 'prof_abc', 'https://rabb.com/api/platforms/callback')
 *   const post = await late.posts.create({ content: '...', platforms: [{ platform: 'instagram', accountId: '...' }] })
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
 * Créé via POST /v1/profiles avant d'initier le flux OAuth.
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
 * Réponse de GET /v1/profiles — tableau enveloppé dans { profiles: [...] }.
 */
export interface LateProfilesListResponse {
  profiles: LateWorkspaceProfile[]
}

/**
 * Réponse de l'endpoint GET /v1/connect/{platform}.
 * Contient l'URL OAuth vers laquelle rediriger l'utilisateur.
 */
export interface LateConnectResponse {
  /** URL OAuth de redirection vers la page d'autorisation (Instagram, TikTok…) */
  authUrl: string
  /** Identifiant d'état opaque pour validation CSRF (géré par Late) */
  state: string
}

/**
 * Résultat de publication d'un post sur une plateforme spécifique.
 * Retourné dans le tableau `platforms[]` de LatePost après publication.
 * Permet de vérifier le statut par plateforme et de récupérer l'URL du post publié.
 */
export interface LatePostPlatformResult {
  /** Nom de la plateforme (ex: "tiktok", "instagram") */
  platform: string
  /** Compte social ciblé */
  accountId: {
    _id: string
    username: string
    displayName: string
    isActive: boolean
  }
  /**
   * Statut de publication sur cette plateforme.
   * - `pending`  : en attente de traitement par Late
   * - `success`  : publié avec succès
   * - `failed`   : échec de publication
   */
  status: 'pending' | 'success' | 'failed'
  /**
   * URL directe du post publié sur la plateforme sociale.
   * Ex: "https://www.tiktok.com/@handle/video/123456789"
   * Disponible uniquement si `status === 'success'`.
   */
  platformPostUrl?: string
}

/** Post publié ou planifié via getlate.dev */
export interface LatePost {
  /** ID MongoDB du post dans getlate.dev (utilisé comme latePostId en DB) */
  _id: string
  /** Alias de _id — certains endpoints retournent `id` */
  id?: string
  text: string
  profileIds: string[]
  scheduledAt?: string
  publishedAt?: string
  status: 'draft' | 'scheduled' | 'published' | 'failed'
  mediaUrls?: string[]
  /**
   * Résultats par plateforme après publication.
   * Présent quand `publishNow: true` et que Late a traité la demande.
   * Utiliser `platforms[0].status` pour vérifier le succès.
   */
  platforms?: LatePostPlatformResult[]
}

/**
 * Compte social connecté dans Late (résultat de GET /v1/accounts/list-accounts).
 * Chaque compte correspond à un profil social (TikTok, Instagram…) connecté à un workspace.
 * L'`id` de ce compte est utilisé dans `platforms[].accountId` lors de la création d'un post.
 */
export interface LateAccount {
  /** ID unique du compte social dans Late — à utiliser dans platforms[].accountId */
  id: string
  /** Alias MongoDB — certains endpoints retournent `_id` au lieu de `id` */
  _id?: string
  /** Plateforme sociale (ex: "instagram", "tiktok") */
  platform: string
  /** ID du workspace Late auquel ce compte appartient (= lateProfileId en DB) */
  profileId: string
  /** Nom d'affichage du compte (ex: "Raoul Alobo") */
  displayName?: string
  /** Handle/username du compte (ex: "@raoulalobo") */
  username?: string
}

/** Paramètres pour créer un post via POST /v1/posts */
export interface LateCreatePostParams {
  /**
   * Contenu textuel du post.
   * Optionnel si tous les éléments `platforms` ont un `customContent`.
   */
  content: string
  /**
   * Plateformes cibles : un objet par compte social à publier.
   * `accountId` est l'`id` d'un LateAccount (GET /v1/accounts/list-accounts).
   * `platform` est l'identifiant de la plateforme (ex: "instagram", "tiktok").
   */
  platforms: Array<{
    platform: string
    accountId: string
  }>
  /**
   * Date de publication planifiée (ISO 8601 UTC).
   * Exclusif avec `publishNow`.
   */
  scheduledFor?: string
  /**
   * Si `true`, Late publie immédiatement dès réception de la requête.
   * À utiliser avec Inngest : Inngest a déjà attendu via `step.sleepUntil()`.
   * Exclusif avec `scheduledFor`.
   */
  publishNow?: boolean
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
    // Base URL de l'API getlate.dev.
    // Docs : https://docs.getlate.dev → base = https://api.getlate.dev, chemins en /v1/...
    // Vercel résout api.getlate.dev correctement (même si absent du DNS local).
    // Si LATE_API_URL est défini dans les variables d'environnement Vercel,
    // il DOIT valoir "https://api.getlate.dev" (sans slash final, sans /api).
    this.baseUrl = process.env.LATE_API_URL ?? 'https://api.getlate.dev'
    this.apiKey = process.env.LATE_API_KEY ?? ''
  }

  /**
   * Effectue une requête HTTP vers l'API getlate.dev.
   * Ajoute automatiquement l'en-tête Authorization et Content-Type.
   *
   * @param path - Chemin de l'endpoint (ex: '/v1/profiles')
   * @param init - Options fetch (method, body, etc.)
   * @returns Données parsées en JSON
   * @throws LateApiError si la réponse n'est pas OK
   */
  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    // URL complète pour les logs de diagnostic (visible dans Vercel Function Logs)
    const fullUrl = `${this.baseUrl}${path}`
    const response = await fetch(fullUrl, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
        ...init?.headers,
      },
    })

    if (!response.ok) {
      // Logger l'URL COMPLÈTE (pas seulement le path) pour diagnostiquer les 405/404
      let message = `Erreur API getlate.dev : ${response.status}`
      let rawBody = ''
      try {
        rawBody = await response.text()
        console.error(`[LateClient] ${response.status} ${init?.method ?? 'GET'} ${fullUrl} →`, rawBody)
        const parsed = JSON.parse(rawBody) as { message?: string }
        if (parsed.message) message = parsed.message
      } catch {
        // Ignorer les erreurs de parsing du corps
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
   * Endpoint : GET /v1/connect/{platform}?profileId=...&redirect_url=...
   * Docs : https://docs.getlate.dev/api-reference/connect
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
      // Endpoint : GET /v1/connect/{platform}?profileId=...&redirect_url=...
      // Docs : https://docs.getlate.dev/api-reference/connect
      this.request<LateConnectResponse>(
        `/v1/connect/${platform}?profileId=${profileId}&redirect_url=${encodeURIComponent(redirectUrl)}`,
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
      this.request<LateProfilesListResponse>('/v1/profiles'),

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
      this.request<LateWorkspaceProfile>('/v1/profiles', {
        method: 'POST',
        body: JSON.stringify(params),
      }),

    /**
     * Supprime un workspace Late et tous les comptes sociaux associés.
     *
     * @param profileId - ID du workspace Late à supprimer
     */
    delete: (profileId: string) =>
      this.request<void>(`/v1/profiles/${profileId}`, {
        method: 'DELETE',
      }),

    /**
     * Récupère les détails d'un workspace Late.
     *
     * @param profileId - ID du workspace Late
     * @returns Détails du workspace
     */
    get: (profileId: string) =>
      this.request<LateWorkspaceProfile>(`/v1/profiles/${profileId}`),
  }

  // ─── Comptes sociaux ─────────────────────────────────────────────────────────

  /**
   * Ressource "accounts" : comptes sociaux connectés à Late.
   * Chaque compte appartient à un workspace (profileId) et correspond à un réseau social.
   * L'`id` d'un compte est requis dans `platforms[].accountId` lors de la création d'un post.
   */
  readonly accounts = {
    /**
     * Liste tous les comptes sociaux connectés (dans la limite du plan).
     * Utiliser l'`id` de chaque compte comme `accountId` dans late.posts.create().
     *
     * @returns Tableau de comptes sociaux connectés
     *
     * @example
     *   const accounts = await late.accounts.list()
     *   const tiktok = accounts.find(a => a.platform === 'tiktok')
     *   // Utiliser tiktok.id dans platforms[].accountId
     */
    list: () =>
      // Réponse : tableau direct de LateAccount (non enveloppé)
      this.request<LateAccount[]>('/v1/accounts/list-accounts'),
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
      this.request<LatePost>('/v1/posts', {
        method: 'POST',
        body: JSON.stringify(params),
      }),

    /**
     * Récupère un post par son ID.
     *
     * @param postId - ID du post getlate.dev
     */
    get: (postId: string) =>
      this.request<LatePost>(`/v1/posts/${postId}`),

    /**
     * Supprime un post planifié (non encore publié).
     *
     * @param postId - ID du post à annuler
     */
    delete: (postId: string) =>
      this.request<void>(`/v1/posts/${postId}`, { method: 'DELETE' }),

    /**
     * Récupère les statistiques d'un post publié.
     *
     * @param postId - ID du post getlate.dev
     * @returns Statistiques par plateforme
     */
    stats: (postId: string) =>
      this.request<LatePostStats[]>(`/v1/posts/${postId}/stats`),
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
      return this.request<LatePostStats[]>(`/v1/profiles/${profileId}/analytics?${query}`)
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
      this.request<LateInboxMessage[]>(`/v1/profiles/${profileId}/inbox`),

    /**
     * Répond à un message inbox.
     *
     * @param messageId - ID du message auquel répondre
     * @param text - Texte de la réponse
     */
    reply: (messageId: string, text: string) =>
      this.request<void>(`/v1/inbox/${messageId}/reply`, {
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
