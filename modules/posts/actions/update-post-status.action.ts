/**
 * @file modules/posts/actions/update-post-status.action.ts
 * @module posts
 * @description Server Action pour changer le statut d'un post via la vue Kanban (drag & drop).
 *
 *   Gère les transitions de statut autorisées :
 *   - DRAFT → SCHEDULED  : vérifie scheduledFor (présente + future) + envoie event Inngest 'post/schedule'
 *   - SCHEDULED → DRAFT  : status = 'DRAFT', scheduledFor = null + annulation Inngest 'post/cancel'
 *   - FAILED → DRAFT     : status = 'DRAFT', failureReason = null (retry manuel)
 *   - * → PUBLISHED      : ❌ interdit (publication réservée à Inngest)
 *   - PUBLISHED → *      : ❌ interdit (colonne lecture seule)
 *
 *   Pour DRAFT → SCHEDULED, valide que scheduledFor est non-null et dans le futur,
 *   puis envoie l'event Inngest 'post/schedule' pour programmer la publication.
 *   Pour SCHEDULED → DRAFT, envoie l'event Inngest 'post/cancel' pour annuler
 *   le run zombie en état sleeping (cf. cancelOn dans publish-scheduled-post.ts).
 *
 * @example
 *   const result = await updatePostStatus('post_abc123', 'DRAFT')
 *   if (result.success) {
 *     // result.post contient le post mis à jour
 *   }
 */

'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'

import { auth } from '@/lib/auth'
import { inngest } from '@/lib/inngest/client'
import { prisma } from '@/lib/prisma'
import type { Post, SavePostResult } from '@/modules/posts/types'

// ─── Helper mapper Prisma → Post ──────────────────────────────────────────────

/**
 * Mappe un enregistrement Prisma vers l'interface Post du module.
 *
 * @param record - Enregistrement Prisma brut
 * @returns Post typé pour le module
 */
function mapPrismaPost(record: {
  id: string
  userId: string
  text: string
  platform: string
  mediaUrls: string[]
  scheduledFor: Date | null
  publishedAt: Date | null
  status: string
  latePostId: string | null
  platformPostUrl: string | null
  failureReason: string | null
  createdAt: Date
  updatedAt: Date
}): Post {
  return {
    id: record.id,
    userId: record.userId,
    text: record.text,
    platform: record.platform,
    mediaUrls: record.mediaUrls,
    scheduledFor: record.scheduledFor,
    publishedAt: record.publishedAt,
    status: record.status as Post['status'],
    latePostId: record.latePostId,
    platformPostUrl: record.platformPostUrl,
    failureReason: record.failureReason,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  }
}

// ─── Table des transitions autorisées ─────────────────────────────────────────

/**
 * Transitions de statut autorisées dans le Kanban.
 * Clé = statut source, valeur = ensemble des statuts cibles autorisés.
 *
 * La colonne PUBLISHED est en lecture seule (entrée et sortie interdites).
 */
const ALLOWED_TRANSITIONS: Record<Post['status'], Post['status'][]> = {
  DRAFT:     ['SCHEDULED'],
  SCHEDULED: ['DRAFT'],
  FAILED:    ['DRAFT'],
  PUBLISHED: [], // aucune transition autorisée depuis PUBLISHED
}

// ─── Server Action ─────────────────────────────────────────────────────────────

/**
 * Change le statut d'un post dans la vue Kanban (résultat d'un drag & drop).
 *
 * Règles :
 * - Vérifie la session utilisateur
 * - Vérifie l'ownership du post
 * - Refuse les transitions vers PUBLISHED (réservé à Inngest)
 * - Refuse toute transition depuis PUBLISHED
 * - SCHEDULED → DRAFT : remet scheduledFor = null et annule l'event Inngest
 *
 * @param postId - ID du post à mettre à jour
 * @param newStatus - Nouveau statut cible
 * @returns SavePostResult — success + post mis à jour, ou error si interdit
 *
 * @example
 *   // Drag d'un DRAFT vers SCHEDULED :
 *   const result = await updatePostStatus('post_abc', 'SCHEDULED')
 *
 *   // Drag d'un SCHEDULED vers DRAFT (annule la publication programmée) :
 *   const result = await updatePostStatus('post_xyz', 'DRAFT')
 */
export async function updatePostStatus(
  postId: string,
  newStatus: Post['status'],
): Promise<SavePostResult> {
  // ─── Authentification ───────────────────────────────────────────────────
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return { success: false, error: 'Non authentifié' }
  }

  // ─── Vérifier que la cible n'est pas PUBLISHED (interdit depuis le Kanban) ──
  if (newStatus === 'PUBLISHED') {
    return {
      success: false,
      error: 'La colonne Publié est en lecture seule — impossible d\'y déplacer un post',
    }
  }

  // ─── Récupérer le post existant ─────────────────────────────────────────
  const existingPost = await prisma.post.findUnique({
    where: { id: postId },
    select: { userId: true, status: true, scheduledFor: true },
  })

  if (!existingPost) {
    return { success: false, error: 'Post introuvable' }
  }

  // ─── Vérification d'ownership ───────────────────────────────────────────
  if (existingPost.userId !== session.user.id) {
    return { success: false, error: 'Post introuvable' }
  }

  // ─── Vérifier que la transition est autorisée ────────────────────────────
  const currentStatus = existingPost.status as Post['status']
  const allowedTargets = ALLOWED_TRANSITIONS[currentStatus]

  if (!allowedTargets.includes(newStatus)) {
    return {
      success: false,
      error: `Transition ${currentStatus} → ${newStatus} non autorisée`,
    }
  }

  // ─── Validation spécifique DRAFT → SCHEDULED ─────────────────────────────
  // Double protection : le client valide déjà, mais on revalide côté serveur
  // au cas où la requête serait forgée ou les données auraient changé entre-temps.
  if (currentStatus === 'DRAFT' && newStatus === 'SCHEDULED') {
    // Cas 1 : aucune date de planification
    if (!existingPost.scheduledFor) {
      return {
        success: false,
        error: 'Ce post n\'a pas de date planifiée — assignez une date avant de le planifier',
      }
    }

    // Cas 2 : date déjà passée (comparaison serveur pour éviter les dérives de timezone)
    if (existingPost.scheduledFor <= new Date()) {
      return {
        success: false,
        error: 'La date de publication est déjà passée — modifiez le post pour choisir une date future',
      }
    }
  }

  // ─── Préparer les données de mise à jour ────────────────────────────────
  const updateData: {
    status: Post['status']
    scheduledFor?: null
    failureReason?: null
  } = { status: newStatus }

  if (currentStatus === 'SCHEDULED' && newStatus === 'DRAFT') {
    // SCHEDULED → DRAFT : effacer la date (annulation de la planification)
    updateData.scheduledFor = null
  }

  if (currentStatus === 'FAILED' && newStatus === 'DRAFT') {
    // FAILED → DRAFT : effacer le message d'erreur pour un retry propre
    updateData.failureReason = null
  }

  // ─── Mettre à jour en base de données ───────────────────────────────────
  try {
    const updatedPost = await prisma.post.update({
      where: { id: postId },
      data: updateData,
    })

    // ─── Effets de bord Inngest selon la transition ───────────────────────
    // Opération non-bloquante : un échec Inngest (ex: INNGEST_EVENT_KEY absent
    // en développement) ne doit PAS rollback la mise à jour DB déjà persistée.
    // En production, Inngest est configuré et l'event sera envoyé correctement.
    try {
      if (currentStatus === 'SCHEDULED' && newStatus === 'DRAFT') {
        // SCHEDULED → DRAFT : annuler le run zombie en état sleeping.
        // 'post/cancel' correspond au `cancelOn` de publish-scheduled-post.ts.
        await inngest.send({
          name: 'post/cancel',
          data: { postId },
        })
      }

      if (currentStatus === 'DRAFT' && newStatus === 'SCHEDULED') {
        // DRAFT → SCHEDULED : programmer la publication via Inngest.
        // scheduledFor est garanti non-null et futur par la validation ci-dessus.
        await inngest.send({
          name: 'post/schedule',
          data: {
            postId,
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            scheduledFor: existingPost.scheduledFor!.toISOString(),
          },
        })
      }
    } catch (inngestError) {
      // Log sans faire échouer la requête — le statut DB est déjà mis à jour.
      console.warn('[updatePostStatus] Inngest send échoué (non-bloquant) :', inngestError)
    }

    // Invalider les caches des pages affectées
    revalidatePath('/kanban')
    revalidatePath('/compose')
    revalidatePath('/calendar')

    return { success: true, post: mapPrismaPost(updatedPost) }
  } catch (error) {
    console.error('[updatePostStatus] Erreur :', error)
    return { success: false, error: 'Erreur lors de la mise à jour du statut' }
  }
}
