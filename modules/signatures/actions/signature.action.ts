/**
 * @file modules/signatures/actions/signature.action.ts
 * @module signatures
 * @description Server Actions Next.js pour la gestion des signatures.
 *   Toutes les actions vérifient la session utilisateur et l'ownership
 *   avant toute opération DB.
 *
 *   Actions disponibles :
 *   - `listSignatures(platform?)` — liste les signatures (toutes ou par plateforme)
 *   - `upsertSignature(rawData)`  — crée ou met à jour une signature
 *   - `setDefaultSignature(id)`  — définit la signature par défaut pour sa plateforme
 *   - `deleteSignature(id)`      — supprime et promeut le suivant si c'était le défaut
 *
 * @example
 *   // Lister les signatures Instagram de l'user connecté
 *   const sigs = await listSignatures('instagram')
 *
 *   // Créer une signature
 *   await upsertSignature({ name: 'CTA', text: '#photo', platform: 'instagram' })
 *
 *   // Définir comme défaut
 *   await setDefaultSignature('clxxx')
 *
 *   // Supprimer
 *   await deleteSignature('clxxx')
 */

'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { SignatureUpsertSchema } from '@/modules/signatures/schemas/signature.schema'
import type { Signature } from '@/modules/signatures/types'

// ─── Helpers internes ─────────────────────────────────────────────────────────

/**
 * Récupère l'utilisateur connecté ou lance une erreur si non authentifié.
 * Utilisé au début de chaque Server Action pour garantir la sécurité.
 *
 * @returns userId de l'utilisateur connecté
 * @throws Error si non authentifié
 */
async function requireUserId(): Promise<string> {
  // `headers()` de next/headers transmet les cookies de la requête courante,
  // requis par better-auth pour identifier la session utilisateur.
  const session = await auth.api.getSession({
    headers: await headers(),
  })
  if (!session?.user?.id) {
    throw new Error('Non authentifié')
  }
  return session.user.id
}

/**
 * Convertit un enregistrement Prisma en type Signature du domaine.
 * Garantit que les dates sont bien des objets Date (Prisma les retourne déjà en Date).
 *
 * @param raw - Enregistrement Prisma brut
 * @returns Signature typée
 */
function toSignature(raw: {
  id: string
  userId: string
  name: string
  text: string
  platform: string
  isDefault: boolean
  createdAt: Date
  updatedAt: Date
}): Signature {
  return {
    id: raw.id,
    userId: raw.userId,
    name: raw.name,
    text: raw.text,
    platform: raw.platform,
    isDefault: raw.isDefault,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  }
}

// ─── Actions ──────────────────────────────────────────────────────────────────

/**
 * Liste les signatures de l'utilisateur connecté.
 * Si `platform` est fourni, filtre par plateforme.
 * Ordre : défaut en premier, puis par createdAt DESC.
 *
 * @param platform - Filtre optionnel par plateforme ("instagram", "linkedin", etc.)
 * @returns Tableau de Signature, triées : défaut d'abord puis les plus récentes
 *
 * @example
 *   // Toutes les signatures
 *   const all = await listSignatures()
 *
 *   // Signatures Instagram uniquement
 *   const insta = await listSignatures('instagram')
 */
export async function listSignatures(platform?: string): Promise<Signature[]> {
  const userId = await requireUserId()

  const rows = await prisma.signature.findMany({
    where: {
      userId,
      // Filtre par plateforme si fourni, sinon toutes
      ...(platform ? { platform } : {}),
    },
    // Défaut en premier, puis du plus récent au plus ancien
    orderBy: [
      { isDefault: 'desc' },
      { createdAt: 'desc' },
    ],
  })

  return rows.map(toSignature)
}

/**
 * Crée ou met à jour une signature.
 * - Si `rawData.id` est absent → création (platform obligatoire)
 * - Si `rawData.id` est présent → mise à jour de la signature existante
 *
 * Validé via Zod (SignatureUpsertSchema) côté serveur.
 * Ownership vérifié : l'user ne peut modifier que ses propres signatures.
 *
 * @param rawData - Données brutes du formulaire (non validées)
 * @returns La signature créée ou mise à jour
 * @throws ZodError si les données sont invalides
 * @throws Error si ownership ko ou non authentifié
 *
 * @example
 *   // Création
 *   const sig = await upsertSignature({
 *     name: 'Hashtags courts',
 *     text: '#photo #lifestyle',
 *     platform: 'instagram',
 *   })
 *
 *   // Mise à jour
 *   const updated = await upsertSignature({
 *     id: 'clxxx',
 *     name: 'Hashtags longs',
 *     text: '#photo #lifestyle #reels #instagood',
 *     platform: 'instagram',
 *   })
 */
export async function upsertSignature(rawData: unknown): Promise<Signature> {
  const userId = await requireUserId()
  const data = SignatureUpsertSchema.parse(rawData)

  let signature

  if (data.id) {
    // Mise à jour : vérifier que la signature appartient à l'user
    const existing = await prisma.signature.findUnique({ where: { id: data.id } })
    if (!existing || existing.userId !== userId) {
      throw new Error('Signature introuvable ou accès refusé')
    }

    signature = await prisma.signature.update({
      where: { id: data.id },
      data: {
        name: data.name,
        text: data.text,
        // La plateforme n'est pas modifiable après création (évite les incohérences)
      },
    })
  } else {
    // Création : si c'est la première signature de cette plateforme, elle devient défaut
    const existingCount = await prisma.signature.count({
      where: { userId, platform: data.platform },
    })

    signature = await prisma.signature.create({
      data: {
        userId,
        name: data.name,
        text: data.text,
        platform: data.platform,
        // Première signature de cette plateforme → automatiquement par défaut
        isDefault: existingCount === 0,
      },
    })
  }

  revalidatePath('/signatures')
  return toSignature(signature)
}

/**
 * Définit une signature comme "par défaut" pour sa plateforme.
 * Utilise une transaction Prisma pour garantir l'atomicité :
 * 1. Remet isDefault = false sur toutes les signatures de la plateforme
 * 2. Met isDefault = true sur la signature cible
 *
 * Ownership vérifié avant la transaction.
 *
 * @param id - ID de la signature à promouvoir comme défaut
 * @throws Error si signature introuvable, ownership ko ou non authentifié
 *
 * @example
 *   await setDefaultSignature('clxxx')
 *   // Toutes les autres signatures Instagram de l'user passent à isDefault = false
 *   // La signature clxxx passe à isDefault = true
 */
export async function setDefaultSignature(id: string): Promise<void> {
  const userId = await requireUserId()

  // Vérifier l'ownership et récupérer la plateforme
  const existing = await prisma.signature.findUnique({ where: { id } })
  if (!existing || existing.userId !== userId) {
    throw new Error('Signature introuvable ou accès refusé')
  }

  const { platform } = existing

  // Transaction atomique : reset toutes + set celle-ci
  await prisma.$transaction([
    // Étape 1 : remettre à false tous les défauts de la plateforme
    prisma.signature.updateMany({
      where: { userId, platform },
      data: { isDefault: false },
    }),
    // Étape 2 : définir la signature cible comme défaut
    prisma.signature.update({
      where: { id },
      data: { isDefault: true },
    }),
  ])

  revalidatePath('/signatures')
}

/**
 * Supprime une signature.
 * Si la signature supprimée était le défaut (isDefault = true), la suivante
 * (par createdAt DESC) est automatiquement promue comme nouveau défaut.
 *
 * Ownership vérifié avant suppression.
 *
 * @param id - ID de la signature à supprimer
 * @throws Error si signature introuvable, ownership ko ou non authentifié
 *
 * @example
 *   await deleteSignature('clxxx')
 *   // Si clxxx était le défaut, la signature suivante devient défaut automatiquement
 */
export async function deleteSignature(id: string): Promise<void> {
  const userId = await requireUserId()

  // Vérifier l'ownership et si c'était le défaut
  const existing = await prisma.signature.findUnique({ where: { id } })
  if (!existing || existing.userId !== userId) {
    throw new Error('Signature introuvable ou accès refusé')
  }

  const { platform, isDefault } = existing

  // Supprimer la signature
  await prisma.signature.delete({ where: { id } })

  // Si c'était le défaut, promouvoir la suivante (la plus récente restante)
  if (isDefault) {
    const next = await prisma.signature.findFirst({
      where: { userId, platform },
      orderBy: { createdAt: 'desc' },
    })

    if (next) {
      await prisma.signature.update({
        where: { id: next.id },
        data: { isDefault: true },
      })
    }
  }

  revalidatePath('/signatures')
}
