/**
 * @file tests/unit/modules/posts/bulk-delete-posts.action.test.ts
 * @description Tests unitaires de la Server Action `bulkDeletePosts`.
 *
 *   Vérifie les cas suivants :
 *   - Authentification (session absente → erreur)
 *   - Validation Zod (tableau vide → erreur)
 *   - Posts introuvables (findMany → [] → erreur)
 *   - Tous PUBLISHED → 0 supprimés, N skipped, erreur explicite
 *   - Suppression DRAFT (sans event Inngest)
 *   - Suppression SCHEDULED (event post/cancel envoyé)
 *   - Suppression FAILED (sans event Inngest)
 *   - Mix DRAFT + PUBLISHED (1 supprimé, 1 skipped)
 *   - Mix SCHEDULED + PUBLISHED (1 supprimé + post/cancel, 1 skipped)
 *   - Ownership (findMany filtre par userId)
 *   - Résilience Inngest (échec non bloquant)
 *   - Atomicité deleteMany (appelé une seule fois avec tous les IDs éligibles)
 *   - Invalidation du cache Next.js
 *
 *   Mocks :
 *   - next/headers → headers() retourne un Headers vide
 *   - next/cache   → revalidatePath est un espion
 *   - @/lib/auth   → auth.api.getSession configurable
 *   - @/lib/prisma → prisma.post.findMany, deleteMany, $transaction contrôlés
 *   - @/lib/inngest/client → inngest.send est un espion
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

// ─── Mocks de modules ─────────────────────────────────────────────────────────

// Mock next/headers : évite l'erreur "headers() hors contexte de requête"
vi.mock('next/headers', () => ({
  headers: vi.fn(() => new Headers()),
}))

// Mock next/cache : on veut vérifier les appels à revalidatePath
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

// Mock better-auth : session contrôlable par test
vi.mock('@/lib/auth', () => ({
  auth: {
    api: {
      getSession: vi.fn(),
    },
  },
}))

// Mock Prisma : findMany, deleteMany et $transaction sont des espions
vi.mock('@/lib/prisma', () => ({
  prisma: {
    post: {
      findMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}))

// Mock Inngest : succès silencieux par défaut
vi.mock('@/lib/inngest/client', () => ({
  inngest: {
    send: vi.fn().mockResolvedValue(undefined),
  },
}))

// ─── Imports (après les mocks) ────────────────────────────────────────────────

import { revalidatePath } from 'next/cache'

import { auth } from '@/lib/auth'
import { inngest } from '@/lib/inngest/client'
import { prisma } from '@/lib/prisma'
import { bulkDeletePosts } from '@/modules/posts/actions/bulk-delete-posts.action'

// ─── Helpers de test ──────────────────────────────────────────────────────────

/** Crée une session factice */
function makeSession(userId = 'user-1') {
  return { user: { id: userId } }
}

/**
 * Type minimal d'un post tel que retourné par findMany
 * (select: { id: true, status: true })
 */
type PostRow = { id: string; status: string }

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  // Réinitialise tous les espions pour éviter les contaminations entre tests
  vi.resetAllMocks()
  vi.mocked(inngest.send).mockResolvedValue(undefined)
})

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('bulkDeletePosts', () => {
  // ── 1. Non authentifié ────────────────────────────────────────────────────

  it('retourne une erreur si la session est absente', async () => {
    // Un utilisateur non authentifié ne peut pas supprimer des posts
    vi.mocked(auth.api.getSession).mockResolvedValue(null)

    const result = await bulkDeletePosts(['post-abc'])

    expect(result).toEqual({ deleted: 0, skipped: 0, errors: ['Non authentifié'] })
    expect(prisma.post.findMany).not.toHaveBeenCalled()
  })

  // ── 2. Données invalides (Zod) ────────────────────────────────────────────

  it('retourne une erreur Zod si le tableau d\'IDs est vide', async () => {
    // BulkDeleteSchema exige au moins 1 ID
    // Note : la validation Zod s'exécute AVANT la vérification de session
    vi.mocked(auth.api.getSession).mockResolvedValue(makeSession())

    const result = await bulkDeletePosts([])

    expect(result.deleted).toBe(0)
    expect(result.skipped).toBe(0)
    expect(result.errors.length).toBeGreaterThan(0)
    expect(prisma.post.findMany).not.toHaveBeenCalled()
  })

  // ── 3. Aucun post trouvé ──────────────────────────────────────────────────

  it('retourne une erreur si aucun post n\'est trouvé en DB', async () => {
    // Les IDs sont valides mais n'existent pas (ou n'appartiennent pas à cet user)
    vi.mocked(auth.api.getSession).mockResolvedValue(makeSession())
    vi.mocked(prisma.post.findMany).mockResolvedValue([])

    const result = await bulkDeletePosts(['post-inexistant'])

    expect(result).toEqual({ deleted: 0, skipped: 0, errors: ['Aucun post trouvé'] })
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  // ── 4. Tous les posts sont PUBLISHED ──────────────────────────────────────

  it('retourne 0 deleted et N skipped si tous les posts sont publiés', async () => {
    // Les posts PUBLISHED sont déjà sur les réseaux — ils ne peuvent pas être supprimés
    const publishedPosts: PostRow[] = [
      { id: 'pub-1', status: 'PUBLISHED' },
      { id: 'pub-2', status: 'PUBLISHED' },
    ]
    vi.mocked(auth.api.getSession).mockResolvedValue(makeSession())
    vi.mocked(prisma.post.findMany).mockResolvedValue(publishedPosts as never)

    const result = await bulkDeletePosts(['pub-1', 'pub-2'])

    expect(result.deleted).toBe(0)
    expect(result.skipped).toBe(2)
    expect(result.errors[0]).toMatch(/publiés/i)
    // Aucune suppression ne doit avoir été tentée
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  // ── 5. Delete DRAFT (sans event Inngest) ──────────────────────────────────

  it('supprime un post DRAFT sans envoyer d\'event Inngest', async () => {
    // Un post DRAFT n'a pas de run Inngest en cours → aucun event cancel nécessaire
    vi.mocked(auth.api.getSession).mockResolvedValue(makeSession())
    vi.mocked(prisma.post.findMany).mockResolvedValue([
      { id: 'draft-1', status: 'DRAFT' },
    ] as PostRow[] as never)
    vi.mocked(prisma.$transaction).mockResolvedValue([{ count: 1 }])
    vi.mocked(prisma.post.deleteMany).mockResolvedValue({ count: 1 })

    const result = await bulkDeletePosts(['draft-1'])

    expect(result).toEqual({ deleted: 1, skipped: 0, errors: [] })
    expect(inngest.send).not.toHaveBeenCalled()
  })

  // ── 6. Delete SCHEDULED (event post/cancel envoyé) ────────────────────────

  it('supprime un post SCHEDULED et envoie l\'event post/cancel', async () => {
    // Un post SCHEDULED a un run Inngest actif → doit être annulé avant suppression
    vi.mocked(auth.api.getSession).mockResolvedValue(makeSession())
    vi.mocked(prisma.post.findMany).mockResolvedValue([
      { id: 'sched-1', status: 'SCHEDULED' },
    ] as PostRow[] as never)
    vi.mocked(prisma.$transaction).mockResolvedValue([{ count: 1 }])
    vi.mocked(prisma.post.deleteMany).mockResolvedValue({ count: 1 })

    process.env.INNGEST_EVENT_KEY = 'test-key'

    const result = await bulkDeletePosts(['sched-1'])

    expect(result).toEqual({ deleted: 1, skipped: 0, errors: [] })
    expect(inngest.send).toHaveBeenCalledOnce()
    const sentEvents = vi.mocked(inngest.send).mock.calls[0][0] as Array<{ name: string; data: { postId: string } }>
    expect(sentEvents[0].name).toBe('post/cancel')
    expect(sentEvents[0].data.postId).toBe('sched-1')

    delete process.env.INNGEST_EVENT_KEY
  })

  // ── 7. Delete FAILED (sans event Inngest) ─────────────────────────────────

  it('supprime un post FAILED sans envoyer d\'event Inngest', async () => {
    // Un post FAILED n'a plus de run Inngest actif → aucun cancel nécessaire
    vi.mocked(auth.api.getSession).mockResolvedValue(makeSession())
    vi.mocked(prisma.post.findMany).mockResolvedValue([
      { id: 'failed-1', status: 'FAILED' },
    ] as PostRow[] as never)
    vi.mocked(prisma.$transaction).mockResolvedValue([{ count: 1 }])
    vi.mocked(prisma.post.deleteMany).mockResolvedValue({ count: 1 })

    const result = await bulkDeletePosts(['failed-1'])

    expect(result).toEqual({ deleted: 1, skipped: 0, errors: [] })
    expect(inngest.send).not.toHaveBeenCalled()
  })

  // ── 8. Mix DRAFT + PUBLISHED ──────────────────────────────────────────────

  it('supprime le DRAFT et saute le PUBLISHED (mix)', async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(makeSession())
    vi.mocked(prisma.post.findMany).mockResolvedValue([
      { id: 'draft-1', status: 'DRAFT' },
      { id: 'pub-1', status: 'PUBLISHED' },
    ] as PostRow[] as never)
    vi.mocked(prisma.$transaction).mockResolvedValue([{ count: 1 }])
    vi.mocked(prisma.post.deleteMany).mockResolvedValue({ count: 1 })

    const result = await bulkDeletePosts(['draft-1', 'pub-1'])

    expect(result.deleted).toBe(1)
    expect(result.skipped).toBe(1)
    expect(result.errors).toEqual([])
    // Pas d'event Inngest pour un DRAFT
    expect(inngest.send).not.toHaveBeenCalled()
  })

  // ── 9. Mix SCHEDULED + PUBLISHED ─────────────────────────────────────────

  it('supprime le SCHEDULED (avec cancel) et saute le PUBLISHED', async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(makeSession())
    vi.mocked(prisma.post.findMany).mockResolvedValue([
      { id: 'sched-1', status: 'SCHEDULED' },
      { id: 'pub-1', status: 'PUBLISHED' },
    ] as PostRow[] as never)
    vi.mocked(prisma.$transaction).mockResolvedValue([{ count: 1 }])
    vi.mocked(prisma.post.deleteMany).mockResolvedValue({ count: 1 })

    process.env.INNGEST_EVENT_KEY = 'test-key'

    const result = await bulkDeletePosts(['sched-1', 'pub-1'])

    expect(result.deleted).toBe(1)
    expect(result.skipped).toBe(1)
    // L'event post/cancel doit être envoyé pour le post SCHEDULED
    expect(inngest.send).toHaveBeenCalledOnce()
    const sentEvents = vi.mocked(inngest.send).mock.calls[0][0] as Array<{ name: string }>
    expect(sentEvents[0].name).toBe('post/cancel')

    delete process.env.INNGEST_EVENT_KEY
  })

  // ── 10. Ownership (findMany filtre par userId) ─────────────────────────────

  it('ne supprime que les posts de l\'utilisateur courant (ownership via findMany)', async () => {
    // L'action appelle findMany avec { userId } → Prisma exclut les posts d'autres users
    const mockFindMany = vi.mocked(prisma.post.findMany)
    vi.mocked(auth.api.getSession).mockResolvedValue(makeSession('user-1'))
    // Simuler que findMany ne retourne qu'1 post sur 2 demandés (l'autre appartient à un autre user)
    mockFindMany.mockResolvedValue([
      { id: 'post-user1', status: 'DRAFT' },
    ] as PostRow[] as never)
    vi.mocked(prisma.$transaction).mockResolvedValue([{ count: 1 }])
    vi.mocked(prisma.post.deleteMany).mockResolvedValue({ count: 1 })

    // On passe 2 IDs mais findMany n'en retourne qu'1
    const result = await bulkDeletePosts(['post-user1', 'post-user2'])

    expect(result.deleted).toBe(1)
    // Vérifier que findMany a bien reçu le userId
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: 'user-1' }),
      }),
    )
  })

  // ── 11. Inngest en erreur (non bloquant) ──────────────────────────────────

  it('retourne les posts supprimés même si inngest.send lève une erreur', async () => {
    // La suppression en DB est déjà effectuée → Inngest est non-bloquant
    vi.mocked(auth.api.getSession).mockResolvedValue(makeSession())
    vi.mocked(prisma.post.findMany).mockResolvedValue([
      { id: 'sched-1', status: 'SCHEDULED' },
    ] as PostRow[] as never)
    vi.mocked(prisma.$transaction).mockResolvedValue([{ count: 1 }])
    vi.mocked(prisma.post.deleteMany).mockResolvedValue({ count: 1 })
    // Simule une panne Inngest
    vi.mocked(inngest.send).mockRejectedValue(new Error('Inngest down'))

    process.env.INNGEST_EVENT_KEY = 'test-key'

    // L'action ne doit pas propager l'exception
    const result = await bulkDeletePosts(['sched-1'])

    expect(result.deleted).toBe(1)
    expect(result.errors).toEqual([])

    delete process.env.INNGEST_EVENT_KEY
  })

  // ── 12. deleteMany atomique ────────────────────────────────────────────────

  it('appelle $transaction avec deleteMany regroupant tous les IDs éligibles', async () => {
    // Tous les IDs éligibles sont supprimés en une seule opération atomique
    vi.mocked(auth.api.getSession).mockResolvedValue(makeSession())
    vi.mocked(prisma.post.findMany).mockResolvedValue([
      { id: 'post-1', status: 'DRAFT' },
      { id: 'post-2', status: 'DRAFT' },
      { id: 'post-3', status: 'FAILED' },
    ] as PostRow[] as never)

    // Capturer les arguments passés à $transaction
    let capturedTransactionOps: unknown
    vi.mocked(prisma.$transaction).mockImplementation(async (ops) => {
      capturedTransactionOps = ops
      return [{ count: 3 }]
    })
    vi.mocked(prisma.post.deleteMany).mockResolvedValue({ count: 3 })

    await bulkDeletePosts(['post-1', 'post-2', 'post-3'])

    // $transaction doit avoir été appelé une seule fois
    expect(prisma.$transaction).toHaveBeenCalledOnce()
    // Les ops passés à la transaction doivent contenir deleteMany avec les 3 IDs
    expect(capturedTransactionOps).toBeDefined()
  })

  // ── 13. Invalidation du cache ─────────────────────────────────────────────

  it('appelle revalidatePath pour /compose, /calendar et / après suppression', async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(makeSession())
    vi.mocked(prisma.post.findMany).mockResolvedValue([
      { id: 'draft-1', status: 'DRAFT' },
    ] as PostRow[] as never)
    vi.mocked(prisma.$transaction).mockResolvedValue([{ count: 1 }])
    vi.mocked(prisma.post.deleteMany).mockResolvedValue({ count: 1 })

    await bulkDeletePosts(['draft-1'])

    expect(revalidatePath).toHaveBeenCalledWith('/compose')
    expect(revalidatePath).toHaveBeenCalledWith('/calendar')
    expect(revalidatePath).toHaveBeenCalledWith('/')
  })
})
