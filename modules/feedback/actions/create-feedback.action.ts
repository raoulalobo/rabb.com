/**
 * @file modules/feedback/actions/create-feedback.action.ts
 * @module feedback
 * @description Server Action pour créer un feedback utilisateur.
 *   Vérifie la session, valide les données avec Zod, puis insère en DB via Prisma.
 *
 * @example
 *   // Depuis FeedbackForm.tsx
 *   const result = await createFeedback({ category: 'bug', message: 'Le calendrier...' })
 *   if (result.success) toast.success('Merci pour votre retour !')
 */

'use server'

import { headers } from 'next/headers'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { FeedbackSchema } from '@/modules/feedback/schemas/feedback.schema'

import type { FeedbackFormData } from '@/modules/feedback/schemas/feedback.schema'

// ─── Types ────────────────────────────────────────────────────────────────────

/** Résultat standard de la Server Action */
interface ActionResult {
  success: boolean
  error?: string
}

// ─── Action ───────────────────────────────────────────────────────────────────

/**
 * Crée un feedback en base de données pour l'utilisateur courant.
 *
 * @param data - Données du formulaire (catégorie + message)
 * @returns `{ success: true }` ou `{ success: false, error: string }`
 *
 * @example
 *   await createFeedback({ category: 'feature', message: 'Il serait bien de...' })
 */
export async function createFeedback(data: FeedbackFormData): Promise<ActionResult> {
  // ── Vérification de la session ─────────────────────────────────────────────
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return { success: false, error: 'Non authentifié' }

  // ── Validation Zod ─────────────────────────────────────────────────────────
  const result = FeedbackSchema.safeParse(data)
  if (!result.success) {
    return { success: false, error: result.error.issues[0].message }
  }

  // ── Insertion en base ──────────────────────────────────────────────────────
  try {
    await prisma.feedback.create({
      data: {
        userId: session.user.id,
        category: result.data.category,
        message: result.data.message,
      },
    })
  } catch (err) {
    console.error('[createFeedback] Erreur Prisma :', err)
    return { success: false, error: 'Erreur lors de l\'envoi du feedback' }
  }

  return { success: true }
}
