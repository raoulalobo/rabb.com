/**
 * @file modules/biolink/actions/update-biopage-socials.action.ts
 * @module biolink
 * @description Server Action — remplace intégralement `BioPage.socialLinks` (JSON).
 *
 *   Le champ `socialLinks` est stocké en JSON dans Prisma sous la forme :
 *   `[{ platform: 'ig'|'tt'|'yt'|'fb'|'mail', url: string, label?: string }, ...]`
 *
 *   Contrairement aux BioLinks (CRUD individuel), les socials sont peu nombreux
 *   (5 plateformes max) et c'est plus simple de les REMPLACER en bloc à chaque
 *   sauvegarde : l'éditeur envoie l'array complet, on écrase la colonne.
 *
 *   Pour les entrées de type `mail`, on préfixe `mailto:` AVANT de persister
 *   afin que le href soit cliquable tel quel côté page publique (le mapper
 *   `parseSocialLinks` ne fait aucune transformation).
 *
 *   Flux :
 *   1. Auth better-auth
 *   2. Validation Zod via BioSocialsSchema
 *   3. Ownership check (la BioPage appartient bien au user)
 *   4. Normalisation (`mail` → `mailto:...`)
 *   5. Persist dans `socialLinks` + revalidate
 *
 * @example
 *   await updateBioPageSocials([
 *     { platform: 'ig',   url: 'https://instagram.com/mimimaze' },
 *     { platform: 'tt',   url: 'https://tiktok.com/@mimimaze' },
 *     { platform: 'mail', url: 'hello@mimisara.com' },  // deviendra mailto:hello@mimisara.com en DB
 *   ])
 */

'use server'

import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  BioSocialsSchema,
  type BioSocialsInput,
} from '@/modules/biolink/schemas/biopage.schema'

import type { BioPage } from '@prisma/client'

// ─── Action ───────────────────────────────────────────────────────────────────

/**
 * Remplace la liste complète des socials de la BioPage du user courant.
 *
 * @param data - Array des entrées sociales (plateforme canonique + URL ou email).
 *   Les entrées à URL vide doivent être filtrées AVANT l'appel (responsabilité UI).
 * @returns `{ success: true, data: BioPage }` ou `{ success: false, error: string }`
 */
export async function updateBioPageSocials(
  data: BioSocialsInput,
): Promise<{ success: true; data: BioPage } | { success: false; error: string }> {
  // ── Authentification ────────────────────────────────────────────────────────
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) {
    return { success: false, error: 'Non authentifié' }
  }

  // ── Validation Zod (dont regex email pour 'mail', URL http/s pour les autres)
  const parsed = BioSocialsSchema.safeParse(data)
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Données invalides',
    }
  }

  try {
    // ── Ownership check ──────────────────────────────────────────────────────
    const bioPage = await prisma.bioPage.findFirst({
      where: { userId: session.user.id },
    })
    if (!bioPage) {
      return { success: false, error: 'BioPage introuvable' }
    }

    // ── Normalisation : préfixer `mailto:` pour les entrées mail ──────────────
    // Le mapper côté public se contente de passer `url` à `href` tel quel, donc
    // le préfixe doit être appliqué AVANT persist pour que le lien fonctionne.
    const normalized = parsed.data.map((item) => {
      if (item.platform === 'mail' && !item.url.startsWith('mailto:')) {
        return { ...item, url: `mailto:${item.url}` }
      }
      return item
    })

    // ── Persist : remplace intégralement la colonne JSON ──────────────────────
    // `socialLinks` est `Json @default("[]")` — on peut assigner directement
    // un array JS, Prisma le sérialise en JSONB côté PostgreSQL.
    const updated = await prisma.bioPage.update({
      where: { id: bioPage.id },
      data: { socialLinks: normalized },
    })

    // ── Revalidation (dashboard + page publique pour refléter les icônes) ─────
    revalidatePath('/biolink')
    revalidatePath(`/u/${updated.slug}`)

    return { success: true, data: updated }
  } catch (err) {
    console.error('[updateBioPageSocials] Erreur DB :', err)
    return { success: false, error: 'Impossible de mettre à jour les réseaux sociaux' }
  }
}
