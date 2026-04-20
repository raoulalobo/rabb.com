/**
 * @file modules/biolink/actions/create-biolink.action.ts
 * @module biolink
 * @description Server Action — crée un nouveau lien (BioLink) dans une BioPage.
 *
 *   Flux :
 *   1. Vérifie la session better-auth
 *   2. Valide les données via BioLinkSchema
 *   3. Vérifie que la BioPage appartient bien au user (ownership via userId)
 *   4. Calcule `position = max(position) + 1` pour placer le lien en bas
 *   5. Crée la row + revalide /biolink et /u/{slug}
 *
 *   `kind` et `eyebrow` sont persistés dans les colonnes dédiées du modèle
 *   `BioLink` (migration `20260421120000_biolink_kind_eyebrow`) et lus tels quels
 *   par `modules/biolink/mappers.ts` lors du rendu public.
 *
 * @example
 *   await createBioLink({
 *     bioPageId: 'clx123',
 *     title: 'Mon livre',
 *     url: 'https://amzn.to/xxx',
 *     eyebrow: 'Nouveau',
 *     kind: 'primary',
 *   })
 */

'use server'

import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { BioLinkSchema } from '@/modules/biolink/schemas/biopage.schema'

import type { BioLink } from '@prisma/client'

// ─── Schéma local : création (sans isActive car toujours true par défaut) ────

/**
 * Schéma de création d'un BioLink — reprend BioLinkSchema en rendant
 * `isActive` optionnel (défaut true) et en ajoutant `bioPageId`.
 */
const CreateBioLinkSchema = BioLinkSchema.extend({
  /** ID de la BioPage à laquelle le lien sera rattaché */
  bioPageId: z.string().min(1, 'bioPageId est requis'),
  /** Kind avec valeur par défaut "glass" si non fourni */
  kind: BioLinkSchema.shape.kind.default('glass'),
  /** isActive optionnel — true par défaut à la création */
  isActive: z.boolean().default(true),
}).partial({ isActive: true })

/** Payload d'entrée — `kind` et `isActive` peuvent être omis */
type CreateBioLinkPayload = z.input<typeof CreateBioLinkSchema>

// ─── Action ───────────────────────────────────────────────────────────────────

/**
 * Crée un nouveau BioLink rattaché à une BioPage existante.
 *
 * @param data - Données du lien (titre, URL, eyebrow, kind, isActive, bioPageId)
 * @returns `{ success: true, data: BioLink }` ou `{ success: false, error: string }`
 *
 * @example
 *   await createBioLink({ bioPageId, title: 'Boutique', url: 'https://...', kind: 'glass' })
 */
export async function createBioLink(
  data: CreateBioLinkPayload,
): Promise<{ success: true; data: BioLink } | { success: false; error: string }> {
  // ── Authentification ────────────────────────────────────────────────────────
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) {
    return { success: false, error: 'Non authentifié' }
  }

  // ── Validation Zod ──────────────────────────────────────────────────────────
  const parsed = CreateBioLinkSchema.safeParse(data)
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Données invalides',
    }
  }

  const { bioPageId, title, url, eyebrow, kind, isActive } = parsed.data

  try {
    // ── Ownership check : la BioPage doit appartenir au user connecté ────────
    const bioPage = await prisma.bioPage.findFirst({
      where: { id: bioPageId, userId: session.user.id },
    })
    if (!bioPage) {
      return { success: false, error: 'Unauthorized' }
    }

    // ── Calcul de la position : max(position) + 1 (placement en bas) ─────────
    const last = await prisma.bioLink.findFirst({
      where: { bioPageId },
      orderBy: { position: 'desc' },
      select: { position: true },
    })
    const nextPosition = (last?.position ?? -1) + 1

    // ── Création du lien ─────────────────────────────────────────────────────
    // `kind` et `eyebrow` sont persistés dans les colonnes dédiées du modèle BioLink.
    // Une chaîne vide côté eyebrow est normalisée en `null` (retire visuellement l'eyebrow).
    const link = await prisma.bioLink.create({
      data: {
        bioPageId,
        title,
        url,
        kind,
        eyebrow: eyebrow && eyebrow.length > 0 ? eyebrow : null,
        position: nextPosition,
        isActive,
      },
    })

    // ── Revalidation ─────────────────────────────────────────────────────────
    revalidatePath('/biolink')
    revalidatePath(`/u/${bioPage.slug}`)

    return { success: true, data: link }
  } catch (err) {
    console.error('[createBioLink] Erreur DB :', err)
    return { success: false, error: 'Impossible de créer le lien' }
  }
}
