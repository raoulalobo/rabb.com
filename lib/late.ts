/**
 * @file lib/late.ts
 * @description Client HTTP singleton pour l'API getlate.dev.
 *   Toutes les interactions avec getlate.dev passent par ce fichier.
 *   Ne jamais appeler l'API getlate.dev directement depuis les composants.
 *
 *   Authentification : LATE_API_KEY dans l'en-tête Authorization (Bearer).
 *   Base URL : https://getlate.dev/api (configurable via LATE_API_URL).
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
   * Note : peut être absent sur TikTok (utiliser platformPostId à la place).
   */
  platformPostUrl?: string
  /**
   * ID du post publié sur la plateforme (ex: TikTok retourne "v_pub_url~v2-...").
   * Peut être utilisé pour construire l'URL ou tracker le post.
   */
  platformPostId?: string
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
 * Compte social connecté dans Late (résultat de GET /v1/accounts).
 * Chaque compte correspond à un profil social (TikTok, Instagram…) connecté à un workspace.
 * L'`_id` de ce compte est utilisé dans `platforms[].accountId` lors de la création d'un post.
 *
 * Note : profileId est retourné comme objet { _id, name } par l'API (pas une string).
 * Utiliser `a.profileId._id` pour comparer avec `connectedPlatform.lateProfileId`.
 */
export interface LateAccount {
  /** ID unique du compte social dans Late — à utiliser dans platforms[].accountId */
  _id: string
  /** Alias — certains endpoints retournent `id` au lieu de `_id` */
  id?: string
  /** Plateforme sociale (ex: "instagram", "tiktok") */
  platform: string
  /**
   * Workspace Late auquel ce compte appartient.
   * L'API retourne un objet `{ _id, name }` (pas une string directe).
   * Comparer via `profileId._id === connectedPlatform.lateProfileId`.
   */
  profileId: { _id: string; name: string } | string
  /** Nom d'affichage du compte (ex: "Raoul Alobo") */
  displayName?: string
  /** Handle/username du compte (ex: "@raoulalobo") */
  username?: string
}

/**
 * Réponse de GET /v1/accounts — enveloppée dans { accounts: [...] }.
 */
interface LateAccountsListResponse {
  accounts: LateAccount[]
  hasAnalyticsAccess: boolean
}

/**
 * Élément média à joindre à un post via POST /v1/posts.
 * Utiliser des URLs HTTPS publiquement accessibles (ex: Supabase Storage public).
 *
 * @example
 *   {
 *     type: 'video',
 *     url: 'https://storage.supabase.co/...',
 *     mimeType: 'video/mp4',
 *     filename: 'mon-video.mp4',
 *   }
 */
export interface LateMediaItem {
  /** Type du média : 'image' | 'video' | 'gif' | 'document' */
  type: 'image' | 'video' | 'gif' | 'document'
  /** URL HTTPS publique du fichier (ex: Supabase Storage) */
  url: string
  /** Type MIME du fichier (ex: 'video/mp4', 'image/jpeg') */
  mimeType?: string
  /** Nom du fichier original (ex: 'mon-video.mp4') */
  filename?: string
  /** Taille en octets */
  size?: number
}

/** Paramètres pour créer un post via POST /v1/posts */
export interface LateCreatePostParams {
  /**
   * ID du workspace Late (MongoDB ObjectId).
   * Requis — correspond à `ConnectedPlatform.lateProfileId` en DB.
   * Récupéré via `late.profiles.list()` ou stocké lors de l'OAuth.
   */
  profileId: string
  /**
   * Contenu textuel du post.
   * Optionnel si tous les éléments `platforms` ont un `customContent`,
   * ou si des médias sont attachés (ex: TikTok vidéo sans légende).
   */
  content?: string
  /**
   * Plateformes cibles : un objet par compte social à publier.
   * `accountId` est l'`_id` d'un LateAccount (GET /v1/accounts).
   * `platform` est l'identifiant de la plateforme (ex: "instagram", "tiktok").
   */
  platforms: Array<{
    platform: string
    accountId: string
  }>
  /**
   * Médias à joindre au post (images, vidéos).
   * Obligatoire pour TikTok (qui exige une vidéo ou image).
   * URLs doivent être publiquement accessibles en HTTPS.
   */
  mediaItems?: LateMediaItem[]
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

/**
 * Réponse de POST /v1/posts (création d'un post).
 * L'API enveloppe le post dans `{ post: LatePost, message: string }`.
 */
interface LateCreatePostResponse {
  post: LatePost
  message: string
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
 * Encapsule le code HTTP, le message d'erreur, et le code fonctionnel optionnel.
 *
 * @example
 *   // Réponse 403 beta : { error: "...", code: "PLATFORM_BETA_RESTRICTED" }
 *   error.status === 403
 *   error.code   === 'PLATFORM_BETA_RESTRICTED'
 */
export class LateApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    /** Code fonctionnel renvoyé par getlate.dev (ex: 'PLATFORM_BETA_RESTRICTED') */
    public readonly code?: string,
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
    // Docs : https://docs.getlate.dev → base = https://getlate.dev/api, chemins en /v1/...
    // Exemple : https://getlate.dev/api/v1/posts (confirmé par la doc officielle)
    // Si LATE_API_URL est défini dans les variables d'environnement,
    // il DOIT valoir "https://getlate.dev/api" (sans slash final).
    this.baseUrl = process.env.LATE_API_URL ?? 'https://getlate.dev/api'
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
      let code: string | undefined
      let rawBody = ''
      try {
        rawBody = await response.text()
        console.error(`[LateClient] ${response.status} ${init?.method ?? 'GET'} ${fullUrl} →`, rawBody)
        // getlate.dev utilise "error" (pas "message") + "code" fonctionnel optionnel
        // ex: { "error": "Snapchat is in beta", "code": "PLATFORM_BETA_RESTRICTED" }
        const parsed = JSON.parse(rawBody) as { message?: string; error?: string; code?: string }
        if (parsed.error) message = parsed.error
        else if (parsed.message) message = parsed.message
        if (parsed.code) code = parsed.code
      } catch {
        // Ignorer les erreurs de parsing du corps
        if (rawBody) console.error('[LateClient] corps non-JSON :', rawBody)
      }
      throw new LateApiError(response.status, message, code)
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
     * Utiliser `a._id` comme `accountId` dans late.posts.create().
     *
     * Note : comparer `a.profileId._id` (objet) avec `connectedPlatform.lateProfileId`.
     *
     * @returns Tableau de comptes sociaux connectés
     *
     * @example
     *   const accounts = await late.accounts.list()
     *   const tiktok = accounts.find(a => a.platform === 'tiktok')
     *   // Utiliser tiktok._id dans platforms[].accountId
     */
    list: () =>
      // Réponse enveloppée : { accounts: [...], hasAnalyticsAccess: bool }
      // On unwrap pour retourner directement le tableau de comptes.
      this.request<LateAccountsListResponse>('/v1/accounts').then((res) => res.accounts),

    /**
     * Révoque l'accès OAuth d'un compte social individuel.
     * À utiliser pour déconnecter une plateforme sans supprimer le workspace Late.
     *
     * ⚠️ Ne PAS utiliser `late.profiles.delete()` pour déconnecter un compte :
     *   cette méthode supprime le workspace entier et échoue (400) si d'autres
     *   comptes y sont encore rattachés.
     *
     * @param accountId - `_id` du LateAccount (obtenu via late.accounts.list())
     *
     * @example
     *   const accounts = await late.accounts.list()
     *   const account = accounts.find(a => a.platform === 'tiktok')
     *   if (account) await late.accounts.delete(account._id)
     */
    delete: (accountId: string) =>
      this.request<void>(`/v1/accounts/${accountId}`, { method: 'DELETE' }),
  }

  // ─── Posts ───────────────────────────────────────────────────────────────────

  /**
   * Ressource "posts" : création, planification et publication de contenu.
   */
  readonly posts = {
    /**
     * Crée et publie (ou planifie) un post via getlate.dev.
     *
     * Champs requis : `profileId` + `platforms` + `mediaItems` (si TikTok/Instagram).
     * Réponse enveloppée → unwrap automatique vers `LatePost`.
     *
     * @param params - Données du post (profileId, content, platforms, mediaItems…)
     * @returns Post créé avec son ID getlate.dev
     *
     * @example
     *   const post = await late.posts.create({
     *     profileId: 'prof_abc123',
     *     content: 'Mon premier post 🎉',
     *     platforms: [{ platform: 'tiktok', accountId: 'acc_xyz' }],
     *     mediaItems: [{ type: 'video', url: 'https://...', mimeType: 'video/mp4' }],
     *     publishNow: true,
     *   })
     */
    create: (params: LateCreatePostParams) =>
      // L'API retourne { post: LatePost, message: string } — unwrap vers LatePost
      this.request<LateCreatePostResponse>('/v1/posts', {
        method: 'POST',
        body: JSON.stringify(params),
      }).then((res) => res.post),

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
