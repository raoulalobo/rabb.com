/**
 * @file tests/unit/modules/posts/bulk-apply-edits.action.test.ts
 * @description Tests unitaires de la Server Action `bulkApplyEdits`.
 *
 *   Vérifie les cas suivants :
 *   - Authentification (session absente → erreur)
 *   - Validation Zod (données invalides → erreur)
 *   - Ownership (seuls les posts de l'utilisateur sont mis à jour)
 *   - Transitions de statut (DRAFT↔SCHEDULED selon scheduledFor)
 *   - Events Inngest (post/cancel + post/schedule selon la transition)
 *   - Filtrage des URLs de médias invalides (data:URI, etc.)
 *   - Réinitialisation des champs de publication (latePostId, failureReason, publishedAt)
 *   - Invalidation du cache Next.js (revalidatePath)
 *   - Résilience Inngest (échec non bloquant)
 *   - Atomicité de la transaction Prisma ($transaction)
 *
 *   Mocks :
 *   - next/headers → headers() retourne un objet Headers vide
 *   - next/cache  → revalidatePath est une fonction espion
 *   - @/lib/auth  → auth.api.getSession est configurable par test
 *   - @/lib/prisma → prisma.post.findMany, update, $transaction contrôlés
 *   - @/lib/inngest/client → inngest.send est un espion resolvant par défaut
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

// ─── Mocks de modules ─────────────────────────────────────────────────────────

// Mock next/headers : évite les erreurs "headers() hors contexte de requête"
vi.mock('next/headers', () => ({
  headers: vi.fn(() => new Headers()),
}))

// Mock next/cache : on veut vérifier les appels à revalidatePath
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

// Mock better-auth : on contrôle la session retournée
vi.mock('@/lib/auth', () => ({
  auth: {
    api: {
      getSession: vi.fn(),
    },
  },
}))

// Mock Prisma : on contrôle findMany, update et $transaction
vi.mock('@/lib/prisma', () => ({
  prisma: {
    post: {
      findMany: vi.fn(),
      update: vi.fn(),
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
import { bulkApplyEdits } from '@/modules/posts/actions/bulk-apply-edits.action'
import type { ProposedEdit } from '@/modules/posts/schemas/post.schema'

// ─── Helpers de test ──────────────────────────────────────────────────────────

/** Crée une session utilisateur factice avec l'ID fourni */
function makeSession(userId = 'user-1') {
  return { user: { id: userId } }
}

/**
 * Crée une ProposedEdit minimale valide.
 * @param overrides - Champs à surcharger
 */
function makeEdit(overrides: Partial<ProposedEdit> = {}): ProposedEdit {
  return {
    postId: 'post-abc',
    text: 'Texte modifié #promo2026',
    mediaUrls: [],
    scheduledFor: null,
    ...overrides,
  }
}

/** Date ISO future : dans 7 jours */
const FUTURE_ISO = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
/** Date ISO passée : hier */
const PAST_ISO = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  // Réinitialise tous les espions avant chaque test pour éviter les contaminations
  vi.resetAllMocks()

  // Par défaut : inngest.send résout silencieusement
  vi.mocked(inngest.send).mockResolvedValue(undefined)
})

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('bulkApplyEdits', () => {
  // ── 1. Non authentifié ────────────────────────────────────────────────────

  it('retourne une erreur si la session est absente', async () => {
    // Simule un utilisateur non connecté
    vi.mocked(auth.api.getSession).mockResolvedValue(null)

    const result = await bulkApplyEdits([makeEdit()])

    expect(result).toEqual({ updated: 0, errors: ['Non authentifié'] })
    // Aucune interaction DB ne doit avoir eu lieu
    expect(prisma.post.findMany).not.toHaveBeenCalled()
  })

  // ── 2. Données invalides (Zod) ────────────────────────────────────────────

  it('retourne une erreur Zod si le tableau d\'edits est vide', async () => {
    // BulkApplyEditsSchema exige min(1) edit
    // La validation Zod s'exécute avant la vérification de session
    vi.mocked(auth.api.getSession).mockResolvedValue(makeSession())

    const result = await bulkApplyEdits([])

    expect(result.updated).toBe(0)
    expect(result.errors.length).toBeGreaterThan(0)
    // Aucune requête DB ne doit s'être produite
    expect(prisma.post.findMany).not.toHaveBeenCalled()
  })

  // ── 3. Aucun post autorisé (ownership) ────────────────────────────────────

  it('retourne une erreur si aucun post appartient à l\'utilisateur', async () => {
    // findMany retourne [] car les posts n'appartiennent pas à cet utilisateur
    vi.mocked(auth.api.getSession).mockResolvedValue(makeSession())
    vi.mocked(prisma.post.findMany).mockResolvedValue([])

    const result = await bulkApplyEdits([makeEdit({ postId: 'post-autre-user' })])

    expect(result).toEqual({ updated: 0, errors: ['Aucun post autorisé trouvé'] })
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  // ── 4. Propriété partielle ─────────────────────────────────────────────────

  it('met à jour uniquement les posts dont l\'ownership est vérifié', async () => {
    // On demande 3 posts mais seulement 2 appartiennent à l'utilisateur
    vi.mocked(auth.api.getSession).mockResolvedValue(makeSession())
    vi.mocked(prisma.post.findMany).mockResolvedValue([
      { id: 'post-1', status: 'DRAFT' },
      { id: 'post-2', status: 'DRAFT' },
      // post-3 absent → pas propriétaire
    ] as ReturnType<typeof prisma.post.findMany> extends Promise<infer T> ? T : never)
    vi.mocked(prisma.$transaction).mockResolvedValue([{}, {}])

    const edits = [
      makeEdit({ postId: 'post-1' }),
      makeEdit({ postId: 'post-2' }),
      makeEdit({ postId: 'post-3' }),
    ]
    const result = await bulkApplyEdits(edits)

    // Seuls 2 posts ont été mis à jour
    expect(result.updated).toBe(2)
    expect(result.errors).toEqual([])
  })

  // ── 5. DRAFT → DRAFT (pas de date) ────────────────────────────────────────

  it('conserve le statut DRAFT si scheduledFor est null', async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(makeSession())
    vi.mocked(prisma.post.findMany).mockResolvedValue([
      { id: 'post-abc', status: 'DRAFT' },
    ] as ReturnType<typeof prisma.post.findMany> extends Promise<infer T> ? T : never)

    // Capturer les données passées à $transaction
    let capturedUpdates: unknown
    vi.mocked(prisma.$transaction).mockImplementation(async (ops) => {
      capturedUpdates = ops
      return [{}]
    })
    vi.mocked(prisma.post.update).mockResolvedValue({} as never)

    await bulkApplyEdits([makeEdit({ scheduledFor: null })])

    // Aucun event Inngest ne doit être envoyé (DRAFT reste DRAFT)
    expect(inngest.send).not.toHaveBeenCalled()
    // La transaction doit avoir été appelée
    expect(prisma.$transaction).toHaveBeenCalledOnce()
    expect(capturedUpdates).toBeDefined()
  })

  // ── 6. DRAFT → SCHEDULED (date future valide) ─────────────────────────────

  it('bascule en SCHEDULED et envoie post/schedule si scheduledFor est futur', async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(makeSession())
    vi.mocked(prisma.post.findMany).mockResolvedValue([
      { id: 'post-abc', status: 'DRAFT' },
    ] as ReturnType<typeof prisma.post.findMany> extends Promise<infer T> ? T : never)
    vi.mocked(prisma.$transaction).mockResolvedValue([{}])
    vi.mocked(prisma.post.update).mockResolvedValue({} as never)

    // INNGEST_EVENT_KEY doit être défini pour déclencher les events
    process.env.INNGEST_EVENT_KEY = 'test-key'

    await bulkApplyEdits([makeEdit({ scheduledFor: FUTURE_ISO })])

    // Un seul event post/schedule doit être envoyé (pas de post/cancel car était DRAFT)
    expect(inngest.send).toHaveBeenCalledOnce()
    const sentEvents = vi.mocked(inngest.send).mock.calls[0][0] as Array<{ name: string }>
    const eventNames = sentEvents.map((e) => e.name)
    expect(eventNames).toContain('post/schedule')
    expect(eventNames).not.toContain('post/cancel')

    // Nettoyage de la variable d'environnement
    delete process.env.INNGEST_EVENT_KEY
  })

  // ── 7. SCHEDULED → DRAFT (date passée) ────────────────────────────────────

  it('bascule en DRAFT et envoie post/cancel si scheduledFor est dans le passé', async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(makeSession())
    vi.mocked(prisma.post.findMany).mockResolvedValue([
      { id: 'post-abc', status: 'SCHEDULED' }, // était planifié
    ] as ReturnType<typeof prisma.post.findMany> extends Promise<infer T> ? T : never)
    vi.mocked(prisma.$transaction).mockResolvedValue([{}])
    vi.mocked(prisma.post.update).mockResolvedValue({} as never)

    process.env.INNGEST_EVENT_KEY = 'test-key'

    await bulkApplyEdits([makeEdit({ scheduledFor: PAST_ISO })])

    // Un event post/cancel doit être envoyé pour annuler l'ancien run
    expect(inngest.send).toHaveBeenCalledOnce()
    const sentEvents = vi.mocked(inngest.send).mock.calls[0][0] as Array<{ name: string }>
    const eventNames = sentEvents.map((e) => e.name)
    expect(eventNames).toContain('post/cancel')
    // Pas de post/schedule car la date passée → statut DRAFT
    expect(eventNames).not.toContain('post/schedule')

    delete process.env.INNGEST_EVENT_KEY
  })

  // ── 8. SCHEDULED → SCHEDULED (nouvelle date future) ──────────────────────

  it('envoie post/cancel + post/schedule si le post était SCHEDULED et reçoit une nouvelle date future', async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(makeSession())
    vi.mocked(prisma.post.findMany).mockResolvedValue([
      { id: 'post-abc', status: 'SCHEDULED' }, // ancien run en cours
    ] as ReturnType<typeof prisma.post.findMany> extends Promise<infer T> ? T : never)
    vi.mocked(prisma.$transaction).mockResolvedValue([{}])
    vi.mocked(prisma.post.update).mockResolvedValue({} as never)

    process.env.INNGEST_EVENT_KEY = 'test-key'

    // Nouvelle date future → doit annuler l'ancien et créer un nouveau run
    await bulkApplyEdits([makeEdit({ scheduledFor: FUTURE_ISO })])

    expect(inngest.send).toHaveBeenCalledOnce()
    const sentEvents = vi.mocked(inngest.send).mock.calls[0][0] as Array<{ name: string }>
    const eventNames = sentEvents.map((e) => e.name)
    // Les deux events doivent être présents
    expect(eventNames).toContain('post/cancel')
    expect(eventNames).toContain('post/schedule')

    delete process.env.INNGEST_EVENT_KEY
  })

  // ── 9. Filtrage des URLs média invalides ──────────────────────────────────

  it('filtre les URLs data:URI et conserve uniquement les URLs http/https', async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(makeSession())
    vi.mocked(prisma.post.findMany).mockResolvedValue([
      { id: 'post-abc', status: 'DRAFT' },
    ] as ReturnType<typeof prisma.post.findMany> extends Promise<infer T> ? T : never)

    // Capturer l'appel update pour vérifier les données persistées
    const capturedUpdates: unknown[] = []
    vi.mocked(prisma.post.update).mockImplementation((args) => {
      capturedUpdates.push(args)
      return Promise.resolve({} as never)
    })
    vi.mocked(prisma.$transaction).mockImplementation(async (ops) => {
      // Exécuter chaque opération pour capturer les données
      return Promise.all((ops as Array<Promise<unknown>>))
    })

    await bulkApplyEdits([
      makeEdit({
        mediaUrls: [
          'http://ok.com/img.jpg',         // valide (commence par http)
          'data:image/png;base64,abc123',  // invalide → doit être filtré
        ],
      }),
    ])

    // Vérifier que seule l'URL http a été persistée
    const updateCall = capturedUpdates[0] as { data: { mediaUrls: string[] } }
    expect(updateCall.data.mediaUrls).toEqual(['http://ok.com/img.jpg'])
    expect(updateCall.data.mediaUrls).not.toContain('data:image/png;base64,abc123')
  })

  // ── 10. Toutes les URLs invalides → tableau vide ──────────────────────────

  it('persiste un tableau vide si toutes les URLs sont invalides', async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(makeSession())
    vi.mocked(prisma.post.findMany).mockResolvedValue([
      { id: 'post-abc', status: 'DRAFT' },
    ] as ReturnType<typeof prisma.post.findMany> extends Promise<infer T> ? T : never)

    const capturedUpdates: unknown[] = []
    vi.mocked(prisma.post.update).mockImplementation((args) => {
      capturedUpdates.push(args)
      return Promise.resolve({} as never)
    })
    vi.mocked(prisma.$transaction).mockImplementation(async (ops) => {
      return Promise.all((ops as Array<Promise<unknown>>))
    })

    await bulkApplyEdits([
      makeEdit({ mediaUrls: ['data:image/png;base64,abc'] }),
    ])

    const updateCall = capturedUpdates[0] as { data: { mediaUrls: string[] } }
    expect(updateCall.data.mediaUrls).toEqual([])
  })

  // ── 11. Réinitialisation des champs de publication ────────────────────────

  it('réinitialise latePostId, failureReason et publishedAt à null', async () => {
    // Un post FAILED doit avoir ses champs de publication remis à zéro
    vi.mocked(auth.api.getSession).mockResolvedValue(makeSession())
    vi.mocked(prisma.post.findMany).mockResolvedValue([
      { id: 'post-abc', status: 'FAILED' },
    ] as ReturnType<typeof prisma.post.findMany> extends Promise<infer T> ? T : never)

    const capturedUpdates: unknown[] = []
    vi.mocked(prisma.post.update).mockImplementation((args) => {
      capturedUpdates.push(args)
      return Promise.resolve({} as never)
    })
    vi.mocked(prisma.$transaction).mockImplementation(async (ops) => {
      return Promise.all((ops as Array<Promise<unknown>>))
    })

    await bulkApplyEdits([makeEdit()])

    const updateCall = capturedUpdates[0] as { data: { latePostId: unknown; failureReason: unknown; publishedAt: unknown } }
    expect(updateCall.data.latePostId).toBeNull()
    expect(updateCall.data.failureReason).toBeNull()
    expect(updateCall.data.publishedAt).toBeNull()
  })

  // ── 12. Invalidation du cache ─────────────────────────────────────────────

  it('appelle revalidatePath pour /compose, /calendar et /', async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(makeSession())
    vi.mocked(prisma.post.findMany).mockResolvedValue([
      { id: 'post-abc', status: 'DRAFT' },
    ] as ReturnType<typeof prisma.post.findMany> extends Promise<infer T> ? T : never)
    vi.mocked(prisma.$transaction).mockResolvedValue([{}])
    vi.mocked(prisma.post.update).mockResolvedValue({} as never)

    await bulkApplyEdits([makeEdit()])

    expect(revalidatePath).toHaveBeenCalledWith('/compose')
    expect(revalidatePath).toHaveBeenCalledWith('/calendar')
    expect(revalidatePath).toHaveBeenCalledWith('/')
  })

  // ── 13. Inngest en erreur (non bloquant) ──────────────────────────────────

  it('retourne le résultat mis à jour même si inngest.send lève une erreur', async () => {
    // Les posts sont bien mis à jour en DB même si Inngest est indisponible
    vi.mocked(auth.api.getSession).mockResolvedValue(makeSession())
    vi.mocked(prisma.post.findMany).mockResolvedValue([
      { id: 'post-abc', status: 'SCHEDULED' }, // → enverra post/cancel
    ] as ReturnType<typeof prisma.post.findMany> extends Promise<infer T> ? T : never)
    vi.mocked(prisma.$transaction).mockResolvedValue([{}])
    vi.mocked(prisma.post.update).mockResolvedValue({} as never)
    // Simuler une panne Inngest
    vi.mocked(inngest.send).mockRejectedValue(new Error('Inngest unavailable'))

    process.env.INNGEST_EVENT_KEY = 'test-key'

    // L'action ne doit pas lever d'exception
    const result = await bulkApplyEdits([makeEdit({ scheduledFor: PAST_ISO })])

    expect(result.updated).toBe(1)
    expect(result.errors).toEqual([])

    delete process.env.INNGEST_EVENT_KEY
  })

  // ── 14. Transaction atomique ──────────────────────────────────────────────

  it('appelle $transaction une seule fois pour N edits valides', async () => {
    // Toutes les mises à jour sont groupées en une seule transaction Prisma
    vi.mocked(auth.api.getSession).mockResolvedValue(makeSession())
    vi.mocked(prisma.post.findMany).mockResolvedValue([
      { id: 'post-1', status: 'DRAFT' },
      { id: 'post-2', status: 'DRAFT' },
      { id: 'post-3', status: 'DRAFT' },
    ] as ReturnType<typeof prisma.post.findMany> extends Promise<infer T> ? T : never)
    vi.mocked(prisma.$transaction).mockResolvedValue([{}, {}, {}])
    vi.mocked(prisma.post.update).mockResolvedValue({} as never)

    const edits = [
      makeEdit({ postId: 'post-1' }),
      makeEdit({ postId: 'post-2' }),
      makeEdit({ postId: 'post-3' }),
    ]
    await bulkApplyEdits(edits)

    // $transaction ne doit avoir été appelé qu'une seule fois
    expect(prisma.$transaction).toHaveBeenCalledOnce()
  })

  // ── 15. Date passée → statut DRAFT ────────────────────────────────────────

  it('détermine le statut DRAFT si scheduledFor est une date passée', async () => {
    // Une date passée ne peut pas être planifiée → DRAFT
    vi.mocked(auth.api.getSession).mockResolvedValue(makeSession())
    vi.mocked(prisma.post.findMany).mockResolvedValue([
      { id: 'post-abc', status: 'DRAFT' },
    ] as ReturnType<typeof prisma.post.findMany> extends Promise<infer T> ? T : never)

    const capturedUpdates: unknown[] = []
    vi.mocked(prisma.post.update).mockImplementation((args) => {
      capturedUpdates.push(args)
      return Promise.resolve({} as never)
    })
    vi.mocked(prisma.$transaction).mockImplementation(async (ops) => {
      return Promise.all((ops as Array<Promise<unknown>>))
    })

    process.env.INNGEST_EVENT_KEY = 'test-key'

    await bulkApplyEdits([makeEdit({ scheduledFor: PAST_ISO })])

    // Le statut persisté doit être DRAFT (pas SCHEDULED)
    const updateCall = capturedUpdates[0] as { data: { status: string } }
    expect(updateCall.data.status).toBe('DRAFT')
    // Pas d'event post/schedule car la date est passée
    const sentEvents = (vi.mocked(inngest.send).mock.calls[0]?.[0] ?? []) as Array<{ name: string }>
    const hasScheduleEvent = sentEvents.some((e) => e.name === 'post/schedule')
    expect(hasScheduleEvent).toBe(false)

    delete process.env.INNGEST_EVENT_KEY
  })
})
