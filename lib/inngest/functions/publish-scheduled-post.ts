/**
 * @file lib/inngest/functions/publish-scheduled-post.ts
 * @description Fonction Inngest : publication d'un post planifié via getlate.dev.
 *   Déclenchée sur l'événement "post/schedule".
 *
 *   Nouveau modèle simplifié (post-refonte) : 1 post = 1 plateforme.
 *   - Post.platform (string) : plateforme unique du post
 *   - Post.text / Post.mediaUrls : contenu direct sans override par plateforme
 *   - Pas de PostPlatformContent : le contenu est directement sur le Post
 *
 *   Workflow :
 *   1. Attendre la date scheduledFor via step.sleepUntil()
 *   2. Récupérer le post en DB et vérifier son statut (SCHEDULED)
 *   3. Récupérer le profil getlate.dev de la plateforme du post
 *   4. Publier via getlate.dev avec publishNow: true (Inngest a déjà attendu)
 *   5. Vérifier le statut par plateforme (Late retourne "success" ou "published" selon la plateforme)
 *   6. Mettre à jour le Post avec PUBLISHED + platformPostUrl (ou FAILED)
 *
 *   Pourquoi `publishNow: true` au lieu de `scheduledAt` ?
 *   - Inngest gère le timing via `step.sleepUntil()` (persistance, retries, backoff)
 *   - Late ne connaît pas la date de publication — c'est Inngest qui décide du moment
 *   - En passant `publishNow: true`, Late publie immédiatement à réception
 *   - Late retourne le statut par plateforme + l'URL du post publié
 *
 *   En cas d'échec après les 3 retries Inngest :
 *   → L'event "inngest/function.failed" est émis automatiquement
 *
 * @example
 *   // Déclenché automatiquement par inngest.send({ name: 'post/schedule', data: { ... } })
 *   // Ne pas appeler directement.
 */

// NonRetriableError : erreur Inngest qui interrompt immédiatement le run sans retry.
// Utilisée pour les erreurs structurelles (ex: contenu dupliqué) où un retry est inutile.
import { NonRetriableError } from 'inngest'

import { inngest } from '@/lib/inngest/client'
import { late } from '@/lib/late'
import type { LateMediaItem, LateCreatePostParams } from '@/lib/late'
import { prisma } from '@/lib/prisma'

/**
 * Fonction Inngest de publication d'un post planifié.
 * Retry automatique : 3 tentatives avec backoff exponentiel (géré par Inngest).
 */
export const publishScheduledPost = inngest.createFunction(
  {
    id: 'publish-scheduled-post',
    name: 'Publier un post planifié',
    // 3 retries avec backoff exponentiel en cas d'erreur réseau ou API
    retries: 3,
    // Annule le run en état sleeping si l'event 'post/cancel' arrive avec le même postId.
    // `match: 'data.postId'` corrèle l'event déclencheur (post/schedule) avec l'event
    // d'annulation (post/cancel) via le champ data.postId identique.
    // Sans ce mécanisme, le run resterait "zombie" en sleeping jusqu'à scheduledFor
    // avant de retourner { skipped: true } une fois le post introuvable.
    cancelOn: [{ event: 'post/cancel', match: 'data.postId' }],
  },
  { event: 'post/schedule' },
  async ({ event, step }) => {
    const { postId, scheduledFor } = event.data

    // ── Étape 1 : Attendre la date de publication ─────────────────────────────
    // step.sleepUntil() met en pause la fonction jusqu'à scheduledFor.
    // Inngest gère la persistance — pas de processus Node actif pendant l'attente.
    await step.sleepUntil('attendre-heure-publication', scheduledFor)

    // ── Étape 2 : Récupérer le post et vérifier son statut ───────────────────
    // Un autre processus aurait pu annuler ou modifier le post entre-temps.
    const post = await step.run('recuperer-post', async () => {
      return prisma.post.findUnique({
        where: { id: postId },
        select: {
          id: true,
          text: true,
          platform: true,   // Plateforme unique du post (simplifié)
          mediaUrls: true,
          platformOverrides: true,  // Surcharges de contenu par plateforme (JSON)
          contentType: true,       // Type de contenu (feed, story, reel, thread, carousel)
          threadItems: true,       // Éléments du thread (JSON)
          status: true,
          userId: true,
          scheduledFor: true,
        },
      })
    })

    // Si le post a été supprimé ou annulé, on arrête sans erreur
    if (!post || post.status !== 'SCHEDULED') {
      return {
        skipped: true,
        reason: post
          ? `Statut inattendu : ${post.status}`
          : 'Post introuvable',
      }
    }

    // ── Étape 3 : Récupérer le profil getlate.dev de la plateforme ───────────
    // Chaque post a UNE seule plateforme → un seul profil à récupérer.
    // lateProfileId = ID du workspace Late (MongoDB ObjectId) stocké lors de l'OAuth.
    const connectedPlatform = await step.run('recuperer-profil', async () => {
      return prisma.connectedPlatform.findFirst({
        where: {
          userId: post.userId,
          platform: post.platform,
          isActive: true,
        },
        select: {
          platform: true,
          lateProfileId: true,
        },
      })
    })

    if (!connectedPlatform) {
      // Profil connecté introuvable → marquer comme FAILED
      await prisma.post.update({
        where: { id: postId },
        data: {
          status: 'FAILED',
          failureReason: `Aucun profil ${post.platform} connecté pour la publication`,
        },
      })
      // NonRetriableError : un profil absent ne réapparaîtra pas entre deux retries.
      throw new NonRetriableError(`Profil ${post.platform} introuvable pour l'utilisateur`)
    }

    // ── Étape 3b : Résoudre l'accountId Late depuis la liste des comptes ─────
    // L'API Late POST /v1/posts attend platforms[].accountId (ID du compte social = _id).
    // C'est DIFFÉRENT du lateProfileId (ID du workspace/profil).
    //
    // Structure de LateAccount : { _id, platform, profileId: { _id, name } | string }
    // On compare profileId._id (ou profileId si string) avec lateProfileId du ConnectedPlatform.
    //
    // Gestion du renommage Twitter → X :
    // Twitter a changé son nom en X. L'API Late peut retourner "x" alors que notre DB
    // stocke "twitter" (et inversement selon la version du SDK Late).
    // Ce mapping garantit que les deux noms sont acceptés.
    const PLATFORM_ALIASES: Record<string, string[]> = {
      twitter: ['twitter', 'x'],
      x: ['x', 'twitter'],
    }

    const lateAccountId = await step.run('recuperer-account-id', async () => {
      const accounts = await late.accounts.list()

      // Log de diagnostic : afficher les plateformes disponibles dans Late
      // (utile pour détecter un mismatch de nom de plateforme)
      console.log(
        '[publish-scheduled-post] comptes Late disponibles :',
        accounts.map((a) => ({ platform: a.platform, id: a._id ?? a.id })),
      )

      // Extraire l'_id du profileId (qui peut être objet ou string selon l'endpoint)
      const resolveProfileId = (profileId: { _id: string; name: string } | string): string =>
        typeof profileId === 'string' ? profileId : profileId._id

      // Noms de plateforme acceptés (gère le renommage Twitter → X)
      const acceptedPlatformNames = PLATFORM_ALIASES[post.platform] ?? [post.platform]

      const account = accounts.find(
        (a) => acceptedPlatformNames.includes(a.platform)
          && resolveProfileId(a.profileId) === connectedPlatform.lateProfileId,
      )

      if (!account) {
        // Fallback : prendre le premier compte de cette plateforme (alias inclus)
        // (cas où le mapping workspace/account a changé côté Late)
        const fallback = accounts.find((a) => acceptedPlatformNames.includes(a.platform))
        if (fallback) {
          console.warn(
            `[publish-scheduled-post] profileId ${connectedPlatform.lateProfileId} introuvable,`
            + ` fallback sur account ${fallback._id ?? fallback.id} (platform: ${fallback.platform})`,
          )
          return fallback._id ?? fallback.id ?? null
        }
        return null
      }

      // Utiliser `_id` en priorité (Late utilise MongoDB ObjectId)
      return account._id ?? account.id ?? null
    })

    if (!lateAccountId) {
      // Alias tentés pour le log de diagnostic
      const tried = (PLATFORM_ALIASES[post.platform] ?? [post.platform]).join(', ')
      console.error(
        `[publish-scheduled-post] Aucun compte Late trouvé pour ${post.platform}`
        + ` (aliases essayés : ${tried}). Le token OAuth a probablement expiré — Late ne connaît plus ce compte.`,
      )

      // Marquer la ConnectedPlatform comme inactive.
      // Late ne possède plus le compte (token expiré ou révoqué) : notre DB doit
      // refléter cet état pour que l'UI affiche la plateforme comme déconnectée
      // et invite l'utilisateur à reconnecter son compte sur /settings.
      await prisma.connectedPlatform.updateMany({
        where: {
          userId: post.userId,
          platform: post.platform,
          isActive: true,
        },
        data: { isActive: false },
      })

      await prisma.post.update({
        where: { id: postId },
        data: {
          status: 'FAILED',
          failureReason: `Compte ${post.platform} déconnecté de Late (token expiré ou révoqué) — reconnecte-le sur /settings`,
        },
      })
      // NonRetriableError : le token OAuth ne se régénère pas entre deux retries.
      // L'utilisateur doit reconnecter son compte manuellement via /settings.
      throw new NonRetriableError(`Aucun account Late trouvé pour ${post.platform} (aliases : ${tried})`)
    }

    // ── Étape 4 : Publier via getlate.dev avec publishNow ────────────────────
    // `publishNow: true` car Inngest a déjà attendu via step.sleepUntil().
    // Late publie immédiatement et retourne le statut par plateforme + l'URL du post.
    //
    // Champs requis par l'API :
    //   - profileId : ID du workspace Late (MongoDB ObjectId)
    //   - content   : texte du post
    //   - platforms : [{ platform, accountId }] (accountId = _id du LateAccount)
    //   - mediaItems : médias (requis pour TikTok / Instagram — sans eux → 400)
    //
    // Si le post a des platformOverrides, on utilise le contenu spécifique
    // à la plateforme du post (s'il existe) à la place du contenu de base.
    // Cela permet de publier un contenu différent par plateforme à partir
    // d'un même brouillon multi-plateformes.

    // Résoudre le contenu effectif : override de la plateforme ou contenu de base
    const overrides = post.platformOverrides as Record<string, { text: string; mediaUrls: string[] }> | null
    const effectiveText = overrides?.[post.platform]?.text ?? post.text
    const effectiveMediaUrls = overrides?.[post.platform]?.mediaUrls ?? post.mediaUrls

    // Résoudre le type de contenu et les éléments de thread
    const contentType = (post.contentType as string) ?? 'feed'
    const threadItems = Array.isArray(post.threadItems) ? post.threadItems as string[] : null

    /**
     * Helper : mappe les URLs Supabase Storage vers le format LateMediaItem.
     * Déduit le type et mimeType depuis l'extension du fichier.
     */
    const mapMediaUrls = (urls: string[]): LateMediaItem[] =>
      urls.map((url) => ({
        type: /\.(mp4|mov|avi|webm)$/i.test(url) ? ('video' as const) : ('image' as const),
        url,
        mimeType: /\.(mp4|mov)$/i.test(url) ? 'video/mp4'
          : /\.mov$/i.test(url) ? 'video/quicktime'
          : /\.webm$/i.test(url) ? 'video/webm'
          : /\.gif$/i.test(url) ? 'image/gif'
          : /\.png$/i.test(url) ? 'image/png'
          : 'image/jpeg',
        filename: url.split('/').pop() ?? 'media',
      }))

    const latePost = await step.run('publier-post', async () => {
      // ── Construction des paramètres selon le type de contenu ──────────
      const baseParams: LateCreatePostParams = {
        profileId: connectedPlatform.lateProfileId,
        content: effectiveText,
        platforms: [{ platform: post.platform, accountId: lateAccountId }],
        ...(effectiveMediaUrls.length > 0 && { mediaItems: mapMediaUrls(effectiveMediaUrls) }),
        publishNow: true,
      }

      // Thread : ajouter les éléments de thread via `threadItems` dans Late API
      // Late gère les threads via un champ `threadItems` au niveau du post
      if (contentType === 'thread' && threadItems && threadItems.length > 0) {
        // Le premier élément du thread est le `content` principal
        // Les suivants sont dans `threadItems` (texte uniquement)
        baseParams.content = threadItems[0]
        ;(baseParams as Record<string, unknown>).threadItems = threadItems.slice(1).map((text) => ({
          content: text,
        }))
      }

      // Story / Reel : transmettre via platformSpecificData de Late API
      // Le contentType est indiqué dans la plateforme cible
      if (contentType === 'story' || contentType === 'reel') {
        baseParams.platforms = [{
          platform: post.platform,
          accountId: lateAccountId,
          // Late utilise `contentType` dans platformSpecificData pour stories/reels
          ...(contentType === 'story' && { contentType: 'story' as const }),
          ...(contentType === 'reel' && { contentType: 'reel' as const }),
        }] as typeof baseParams.platforms
      }

      return late.posts.create(baseParams)
    })

    // ── Étape 5 : Vérifier le statut de publication par plateforme ───────────
    // Late retourne `platforms[0]` avec status 'success' | 'published' | 'failed' | 'pending'.
    // En cas d'échec réel (pas d'URL + statut non-succès), on throw pour déclencher
    // les retries Inngest automatiques (max 3×).
    const platformResult = latePost.platforms?.[0]

    // Logger la réponse Late complète — visible dans Vercel Logs et Inngest Event Trace
    console.log(
      '[publish-scheduled-post] réponse Late platforms :',
      JSON.stringify(latePost.platforms ?? null),
    )

    // Extraire l'URL du post publié dès maintenant (avant la vérification de succès).
    // Cette valeur est réutilisée dans le chemin succès (step 6) et le chemin échec (log).
    // Priorité : platformPostUrl (URL finale) > platformPostId (utilisé par TikTok).
    const platformPostUrl = platformResult?.platformPostUrl ?? platformResult?.platformPostId ?? null

    // Statuts Late considérés comme publication effective :
    //   - "success"   : valeur nominale documentée dans les specs Late
    //   - "published" : valeur retournée en pratique par Instagram et Facebook
    //   - URL présente : preuve irréfutable de publication, quel que soit le statut textuel
    //     (ex: Late retourne status "failed" mais inclut quand même l'URL → post visible en ligne)
    const isActuallyPublished =
      platformResult?.status === 'success' ||
      platformResult?.status === 'published' ||
      !!platformPostUrl

    // Condition : pas de résultat, ou publication non effective (pas de succès ni d'URL).
    // Cela inclut 'failed' explicite (sans URL) ET 'pending' (Late n'a pas encore traité).
    if (!platformResult || !isActuallyPublished) {
      // Extraire le motif détaillé depuis Late (plusieurs noms de champ possibles selon version API)
      const lateReason = platformResult?.errorMessage
        ?? platformResult?.reason
        ?? platformResult?.errorCode
        ?? null

      // Construire le libellé de plateforme (fallback sur connectedPlatform si absent)
      const platformLabel = platformResult?.platform ?? connectedPlatform.platform
      // Ajouter le motif Late s'il est disponible (ex: " — Token expired")
      const failureDetail = lateReason ? ` — ${lateReason}` : ''
      // Décrire le statut reçu (ex: "status: failed", "status: pending", "pas de résultat")
      const statusLabel = platformResult ? `status: ${platformResult.status}` : 'pas de résultat'
      // Message final stocké en DB et dans l'email d'échec
      const failureReason = `Late : publication échouée sur ${platformLabel}${failureDetail} (${statusLabel})`

      // Log d'erreur structuré pour faciliter le diagnostic dans Vercel/Inngest
      console.error(
        `[publish-scheduled-post] Échec publication ${platformLabel} :`,
        { status: platformResult?.status, lateReason, platformResult },
      )

      // ── Détecter le type d'erreur Late ────────────────────────────────────────
      // Ce test est fait APRÈS le log pour ne pas alourdir le chemin nominal.

      // isUserContentError : toute erreur imputable au contenu de l'utilisateur.
      // La catégorie 'user_content' de Late englobe plusieurs cas distincts :
      //   - frame_rate_check_failed (TikTok : framerate hors 23-60 FPS)
      //   - format vidéo non supporté, contenu interdit (copyright)
      //   - contenu dupliqué (duplicate)
      // Pour tous ces cas, un retry Inngest est inutile — Late rejettera à nouveau.
      const isUserContentError = platformResult?.errorCategory === 'user_content'

      // isDuplicateContent : sous-cas "doublon" uniquement.
      // Late dit explicitement "duplicate" dans errorMessage dans ce cas précis.
      // Séparer de isUserContentError pour éviter d'enrichir les autres user_content
      // (ex: frame_rate_check_failed) avec un message de doublon qui serait faux.
      const isDuplicateContent =
        (platformResult?.errorMessage ?? '').toLowerCase().includes('duplicate')

      // Partir du failureReason déjà construit (contient le message Late détaillé)
      let enrichedFailureReason = failureReason

      // L'enrichissement "doublon" ne s'applique QUE pour les vrais duplicates.
      // Pour les autres user_content (ex: frame_rate_check_failed), le failureReason
      // construit depuis errorMessage Late brut est déjà correct — ne pas l'écraser.
      if (isDuplicateContent) {
        // Chercher le post PUBLISHED le plus récent avec le même texte sur la même plateforme.
        // Requête ciblée : userId + platform + status + text — pas de full-scan.
        // Ex: si "Bonjour le monde" a déjà été publié sur facebook le 3 mars 2026,
        //     on retrouve ce post et on enrichit le message d'erreur avec la date.
        const originalPost = await prisma.post.findFirst({
          where: {
            userId:   post.userId,
            platform: post.platform,
            status:   'PUBLISHED',
            text:     post.text,   // même contenu exact → c'est le doublon
          },
          orderBy: { publishedAt: 'desc' },
          select:  { id: true, publishedAt: true },
        })

        if (originalPost?.publishedAt) {
          // ── Cas A : doublon texte trouvé en DB ──────────────────────────────────
          // Le même texte a déjà été publié sur cette plateforme via l'app.
          // On enrichit le message avec la date de publication originale.
          // Ex: "· Ce contenu a déjà été publié sur facebook le 3 mars 2026."
          const dateStr = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long' })
            .format(originalPost.publishedAt)
          enrichedFailureReason =
            `${failureReason} · Ce contenu a déjà été publié sur ${platformLabel} le ${dateStr}.`

        } else if (post.mediaUrls.length > 0) {
          // ── Cas B : doublon vidéo/image (hash fichier) ───────────────────────────
          // Aucun post avec le même texte trouvé en DB, mais le post contient des médias.
          // Les plateformes (Facebook, Instagram, TikTok, YouTube) détectent les doublons
          // via le hash binaire du fichier vidéo/image, indépendamment du texte.
          // On ne peut pas retrouver le post original en DB car seule la plateforme
          // connaît ce hash — on informe l'utilisateur de la cause réelle.
          enrichedFailureReason =
            `${failureReason} · Le fichier média (vidéo ou image) a déjà été publié sur `
            + `${platformLabel}. Les plateformes détectent les doublons via le hash du fichier, `
            + `même si le texte est différent. Essaie avec un fichier légèrement différent `
            + `(recadrage, recompression).`

          // Cas C (implicite) : aucun média, doublon non trouvé en DB (publié hors app)
          // → enrichedFailureReason reste égal au failureReason Late original (pas d'enrichissement)
        }
      }

      // Sauvegarder le failureReason enrichi (sera lu par handle-post-failure → email d'échec)
      await prisma.post.update({
        where: { id: postId },
        data: { status: 'FAILED', failureReason: enrichedFailureReason },
      })

      // NonRetriableError pour TOUS les user_content (duplicate inclus).
      // Inngest émet quand même inngest/function.failed → handle-post-failure envoie l'email.
      // Le failureReason contient déjà le errorMessage Late brut — ne pas l'écraser.
      if (isUserContentError) {
        throw new NonRetriableError(enrichedFailureReason)
      }
      // Autres erreurs (réseau, API down, timeout) → Error classique → retry Inngest (3×)
      throw new Error(enrichedFailureReason)
    }

    // ── Étape 6 : Mettre à jour le statut du Post ─────────────────────────────
    // Récupérer l'ID Late : Late retourne `_id` (MongoDB), fallback sur `id`
    const latePostId = latePost._id ?? latePost.id ?? null

    await step.run('mettre-a-jour-statut', async () => {
      return prisma.post.update({
        where: { id: postId },
        data: {
          status: 'PUBLISHED',
          publishedAt: new Date(),
          latePostId,
          // platformPostUrl est déjà extrait à l'étape 5 (platformPostUrl ?? platformPostId ?? null).
          // Réutiliser la variable pour éviter la duplication de logique.
          platformPostUrl,
          failureReason: null,
        },
      })
    })

    return {
      published: true,
      platform: post.platform,
      latePostId,
      // Réutiliser la variable déjà calculée à l'étape 5
      platformPostUrl,
    }
  },
)
