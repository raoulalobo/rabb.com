/**
 * @file modules/posts/actions/execute-plan.action.ts
 * @module posts
 * @description Server Action : persistance du plan agent approuvé par l'utilisateur.
 *
 *   Reçoit l'AgentPlan confirmé depuis l'UI AgentComposer.
 *   Crée un enregistrement Post de base + un PostPlatformContent par plateforme.
 *   Déclenche un event Inngest si une date de planification est définie.
 *
 *   Flow complet :
 *   1. Authentification + validation Zod du plan
 *   2. Calcul du texte de base, des médias et de la date de planification
 *   3. Création du Post en DB (statut DRAFT ou SCHEDULED)
 *   4. Création des PostPlatformContent (un par plateforme du plan)
 *   5. Si planifié → envoi de l'event Inngest "post/schedule"
 *   6. Retour { success, post }
 *
 * @example
 *   // Dans PlanConfirmation.tsx (après confirmation de l'utilisateur)
 *   const result = await executePlan({
 *     plan: {
 *       platforms: [
 *         { platform: 'instagram', text: '...', mediaUrls: [...], scheduledFor: '2024-03-15T09:00:00Z', rationale: '...' },
 *         { platform: 'tiktok', text: '...', mediaUrls: [...], scheduledFor: null, rationale: '...' },
 *       ],
 *       summary: '...',
 *     },
 *     instruction: 'Publie mes 5 photos sur Instagram et TikTok',
 *   })
 *   if (result.success) {
 *     // result.post.id → ID du post créé
 *     // result.post.status → 'SCHEDULED' ou 'DRAFT'
 *   }
 */

'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { z } from 'zod'

import { auth } from '@/lib/auth'
import { inngest } from '@/lib/inngest/client'
import { prisma } from '@/lib/prisma'
import { validateAgentSession } from '@/modules/posts/actions/agent-session.action'
import type { SavePostResult } from '@/modules/posts/types'

// ─── Schémas de validation ────────────────────────────────────────────────────

/**
 * Schéma de validation d'un plan de plateforme individuel.
 * Correspond à l'interface PlatformPlan de modules/posts/types.ts,
 * mais avec les champs texte/médias potentiellement modifiés par l'utilisateur.
 */
const PlatformPlanInputSchema = z.object({
  /** Identifiant de la plateforme (ex: "instagram") */
  platform: z.string().min(1, 'Plateforme requise'),

  /** Texte adapté par Claude et éventuellement retouché par l'utilisateur */
  text: z
    .string()
    .max(63206, 'Le texte dépasse la limite maximale'),

  /** URLs des médias sélectionnés (max 35 — limite TikTok la plus permissive) */
  mediaUrls: z
    .array(z.string().url())
    .max(35, 'Trop de médias pour cette plateforme'),

  /**
   * Date de publication ISO 8601 ou null = publier immédiatement.
   * Ex: "2024-03-15T09:00:00.000Z"
   */
  scheduledFor: z.string().nullable(),

  /** Explication des choix de l'agent (affiché dans l'UI, non persisté) */
  rationale: z.string(),
})

/**
 * Schéma complet de la requête executePlan.
 * Le plan est transmis tel qu'il a été produit par Claude,
 * avec les modifications éventuelles de l'utilisateur.
 */
const ExecutePlanInputSchema = z.object({
  /** Plan par plateforme (au moins une plateforme requise) */
  plan: z.object({
    platforms: z
      .array(PlatformPlanInputSchema)
      .min(1, 'Le plan doit contenir au moins une plateforme'),
    summary: z.string().optional(),
  }),

  /**
   * Instruction originale de l'utilisateur en langage naturel.
   * Utilisée comme "texte de base" du Post (visible dans /calendar).
   * Si absente, le texte de la première plateforme est utilisé.
   */
  instruction: z.string().max(2000).optional(),

  /**
   * ID de la session agent multi-tours (optionnel).
   * Si fourni, la session sera marquée VALIDATED après la création du Post
   * pour ne plus être proposée comme "reprise" à l'utilisateur.
   */
  sessionId: z.string().optional(),
})

/** Type inféré du schéma d'entrée */
export type ExecutePlanInput = z.infer<typeof ExecutePlanInputSchema>

// ─── executePlan ──────────────────────────────────────────────────────────────

/**
 * Server Action : persiste le plan agent approuvé en base de données.
 *
 * Stratégie de date de planification :
 * - Si plusieurs plateformes ont des scheduledFor différents → date la plus ancienne
 * - Seules les dates dans le futur sont acceptées (les autres sont ignorées)
 * - Si aucune date valide → status = 'DRAFT' (publication immédiate possible)
 *
 * Stratégie du texte de base (Post.text) :
 * - Si `instruction` fournie → utilisée directement comme texte de base
 * - Sinon → texte de la première plateforme du plan
 * Ce texte est visible dans le calendrier et sert de fallback
 * dans Inngest si un PostPlatformContent est absent.
 *
 * @param rawData - Données brutes de l'UI (non validées — validation interne par Zod)
 * @returns { success: true, post } si OK, { success: false, error } si KO
 */
export async function executePlan(rawData: unknown): Promise<SavePostResult> {
  // ── Authentification ─────────────────────────────────────────────────────────
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return { success: false, error: 'Non authentifié' }
  }

  // ── Validation Zod ───────────────────────────────────────────────────────────
  const parsed = ExecutePlanInputSchema.safeParse(rawData)
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Données invalides',
    }
  }

  const { plan, instruction, sessionId } = parsed.data
  const { platforms: platformPlans } = plan

  // ── Calcul des champs du Post de base ────────────────────────────────────────

  // Liste des plateformes ciblées (ordre du plan)
  const platforms = platformPlans.map((p) => p.platform)

  // Union de tous les médias de toutes les plateformes (dédupliqués)
  // Sert de pool général visible dans le calendrier
  const allMediaUrls = [...new Set(platformPlans.flatMap((p) => p.mediaUrls))]

  // Texte de base = instruction naturelle ou texte de la première plateforme
  // L'instruction est plus lisible dans le calendrier que le texte formaté Instagram
  const baseText = instruction?.trim() || platformPlans[0]?.text || ''

  // ── Calcul de la date de planification ───────────────────────────────────────
  // On prend la date la plus proche (min) parmi les plateformes planifiées.
  // Les dates passées ou invalides sont ignorées.
  const now = new Date()
  const scheduledDates = platformPlans
    .filter((p) => p.scheduledFor !== null)
    .map((p) => new Date(p.scheduledFor!))
    .filter((d) => !isNaN(d.getTime()) && d > now)

  const scheduledFor =
    scheduledDates.length > 0
      ? new Date(Math.min(...scheduledDates.map((d) => d.getTime())))
      : null

  // Statut : SCHEDULED si au moins une date valide dans le futur, sinon DRAFT
  const finalStatus: 'DRAFT' | 'SCHEDULED' = scheduledFor ? 'SCHEDULED' : 'DRAFT'

  try {
    // ── Création du Post de base ─────────────────────────────────────────────────
    const post = await prisma.post.create({
      data: {
        userId: session.user.id,
        text: baseText,
        platforms,
        mediaUrls: allMediaUrls,
        scheduledFor,
        status: finalStatus,
      },
    })

    // ── Création des PostPlatformContent (un par plateforme) ─────────────────────
    // Chaque plateforme du plan obtient son propre enregistrement avec
    // le texte adapté et les médias sélectionnés par Claude.
    // On utilise upsert pour idempotence (si appelé plusieurs fois).
    await Promise.all(
      platformPlans.map((platformPlan) =>
        prisma.postPlatformContent.upsert({
          where: {
            // Contrainte unique (postId, platform) → pas de doublon par plateforme
            postId_platform: { postId: post.id, platform: platformPlan.platform },
          },
          create: {
            postId: post.id,
            platform: platformPlan.platform,
            text: platformPlan.text,
            mediaUrls: platformPlan.mediaUrls,
            // PENDING : sera mis à jour par Inngest lors de la publication effective
            status: 'PENDING',
          },
          update: {
            text: platformPlan.text,
            mediaUrls: platformPlan.mediaUrls,
            status: 'PENDING',
            // Nettoyage des données de publication précédentes (en cas de re-soumission)
            latePostId: null,
            failureReason: null,
            publishedAt: null,
          },
        }),
      ),
    )

    // ── Déclenchement Inngest (si planifié) ──────────────────────────────────────
    // Inngest se chargera de publier le post sur chaque plateforme
    // au moment défini par scheduledFor (voir publish-scheduled-post.ts).
    if (finalStatus === 'SCHEDULED' && scheduledFor) {
      await inngest.send({
        name: 'post/schedule',
        data: {
          postId: post.id,
          scheduledFor: scheduledFor.toISOString(),
        },
      })
    }

    // ── Validation de la session agent (si fournie) ───────────────────────────────
    // Marque la session comme VALIDATED pour ne plus la proposer en "reprise".
    // Erreur non bloquante : le post est créé, on continue même si la validation échoue.
    if (sessionId) {
      await validateAgentSession(sessionId, post.id).catch((err) => {
        console.error('[executePlan] Erreur non bloquante — validation session :', err)
      })
    }

    // Invalide le cache des pages qui affichent les posts
    revalidatePath('/calendar')
    revalidatePath('/')

    return {
      success: true,
      post: {
        id: post.id,
        userId: post.userId,
        text: post.text,
        platforms: post.platforms,
        mediaUrls: post.mediaUrls,
        scheduledFor: post.scheduledFor,
        publishedAt: post.publishedAt,
        status: post.status as 'DRAFT' | 'SCHEDULED' | 'PUBLISHED' | 'FAILED',
        latePostId: post.latePostId,
        createdAt: post.createdAt,
        updatedAt: post.updatedAt,
      },
    }
  } catch (error) {
    console.error('[executePlan] Erreur création post depuis plan agent :', error)
    return { success: false, error: 'Erreur lors de la sauvegarde du plan' }
  }
}
