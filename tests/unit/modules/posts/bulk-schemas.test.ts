/**
 * @file tests/unit/modules/posts/bulk-schemas.test.ts
 * @description Tests unitaires des schémas Zod dédiés aux opérations bulk (sélection multiple).
 *
 *   Couvre :
 *   - BulkDeleteSchema         : validation des IDs à supprimer (1–100)
 *   - BulkEditBatchSchema      : validation de la requête agent (postIds + instruction + mediaPool)
 *   - ProposedEditSchema       : validation d'une modification IA proposée
 *   - BulkApplyEditsSchema     : validation du tableau de modifications à appliquer
 *   - getCharLimit             : limite de caractères par plateforme (cas bulk spécifiques)
 *
 *   Aucun mock nécessaire : ces schémas sont purement synchrones (Zod).
 */

import { describe, expect, it } from 'vitest'

import {
  BulkApplyEditsSchema,
  BulkDeleteSchema,
  BulkEditBatchSchema,
  ProposedEditSchema,
  getCharLimit,
} from '@/modules/posts/schemas/post.schema'

// ─── BulkDeleteSchema ─────────────────────────────────────────────────────────

describe('BulkDeleteSchema', () => {
  it('accepte 1 ID valide (minimum)', () => {
    // Cas nominal : un seul ID à supprimer
    const result = BulkDeleteSchema.safeParse({ postIds: ['abc123'] })
    expect(result.success).toBe(true)
  })

  it('accepte 100 IDs valides (maximum)', () => {
    // Cas limite supérieur : 100 posts en une seule opération
    const ids = Array.from({ length: 100 }, (_, i) => `post-${i}`)
    const result = BulkDeleteSchema.safeParse({ postIds: ids })
    expect(result.success).toBe(true)
  })

  it('rejette un tableau vide (min 1)', () => {
    // Aucun ID sélectionné → l'opération n'a pas de sens
    const result = BulkDeleteSchema.safeParse({ postIds: [] })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0]?.message).toMatch(/au moins un post/i)
    }
  })

  it('rejette 101 IDs (max 100)', () => {
    // Dépassement de la limite de sécurité (protection contre les abus)
    const ids = Array.from({ length: 101 }, (_, i) => `post-${i}`)
    const result = BulkDeleteSchema.safeParse({ postIds: ids })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0]?.message).toMatch(/maximum 100/i)
    }
  })

  it('rejette un ID qui est une chaîne vide', () => {
    // Un ID vide n'est pas un identifiant valide en base de données
    const result = BulkDeleteSchema.safeParse({ postIds: [''] })
    expect(result.success).toBe(false)
  })

  it('accepte plusieurs IDs valides (cas nominal)', () => {
    // Sélection multiple typique : 3 posts
    const result = BulkDeleteSchema.safeParse({ postIds: ['abc', 'def', 'ghi'] })
    expect(result.success).toBe(true)
  })
})

// ─── BulkEditBatchSchema ──────────────────────────────────────────────────────

describe('BulkEditBatchSchema', () => {
  // Données minimales valides : postIds + instruction (mediaPool aura le défaut [])
  const validBase = {
    postIds: ['abc', 'def'],
    instruction: 'Ajoute #promo2026 à chaque post',
  }

  it('accepte les champs minimaux avec mediaPool par défaut à []', () => {
    // mediaPool est optionnel et doit valoir [] par défaut
    const result = BulkEditBatchSchema.safeParse(validBase)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.mediaPool).toEqual([])
    }
  })

  it('rejette 51 postIds (max 50)', () => {
    // Le bulk edit IA est limité à 50 posts pour contrôler les coûts Claude
    const ids = Array.from({ length: 51 }, (_, i) => `post-${i}`)
    const result = BulkEditBatchSchema.safeParse({ ...validBase, postIds: ids })
    expect(result.success).toBe(false)
  })

  it('rejette une instruction vide (min 1)', () => {
    // Une instruction vide ne peut pas guider l'IA
    const result = BulkEditBatchSchema.safeParse({ ...validBase, instruction: '' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0]?.message).toMatch(/instruction requise/i)
    }
  })

  it('rejette une instruction de 2001 caractères (max 2000)', () => {
    // Protection contre les prompts trop longs envoyés à Claude
    const result = BulkEditBatchSchema.safeParse({
      ...validBase,
      instruction: 'a'.repeat(2001),
    })
    expect(result.success).toBe(false)
  })

  it('accepte une instruction de exactement 2000 caractères (limite)', () => {
    // La limite max doit être inclusive
    const result = BulkEditBatchSchema.safeParse({
      ...validBase,
      instruction: 'a'.repeat(2000),
    })
    expect(result.success).toBe(true)
  })

  it('rejette un mediaPool de 51 items (max 50)', () => {
    // Limite identique aux postIds pour la cohérence
    const pool = Array.from({ length: 51 }, (_, i) => ({
      url: `https://example.com/img-${i}.jpg`,
      type: 'photo' as const,
      filename: `img-${i}.jpg`,
    }))
    const result = BulkEditBatchSchema.safeParse({ ...validBase, mediaPool: pool })
    expect(result.success).toBe(false)
  })

  it('accepte un mediaPool de 50 items (limite)', () => {
    // La limite max doit être inclusive
    const pool = Array.from({ length: 50 }, (_, i) => ({
      url: `https://example.com/img-${i}.jpg`,
      type: 'photo' as const,
      filename: `img-${i}.jpg`,
    }))
    const result = BulkEditBatchSchema.safeParse({ ...validBase, mediaPool: pool })
    expect(result.success).toBe(true)
  })

  it('rejette un mediaPool avec une URL invalide', () => {
    // Chaque media du pool doit avoir une URL valide (http/https)
    const result = BulkEditBatchSchema.safeParse({
      ...validBase,
      mediaPool: [{ url: 'not-a-url', type: 'photo', filename: 'img.jpg' }],
    })
    expect(result.success).toBe(false)
  })

  it('rejette un mediaPool avec un type inconnu', () => {
    // Le type doit être strictement 'photo' ou 'video'
    const result = BulkEditBatchSchema.safeParse({
      ...validBase,
      mediaPool: [{ url: 'https://example.com/img.jpg', type: 'gif', filename: 'img.gif' }],
    })
    expect(result.success).toBe(false)
  })

  it('rejette 0 postIds (min 1)', () => {
    // Au moins un post à modifier
    const result = BulkEditBatchSchema.safeParse({ ...validBase, postIds: [] })
    expect(result.success).toBe(false)
  })
})

// ─── ProposedEditSchema ────────────────────────────────────────────────────────

describe('ProposedEditSchema', () => {
  // Modification minimale valide retournée par l'agent IA
  const validEdit = {
    postId: 'abc123',
    text: 'Mon texte modifié #promo2026',
    mediaUrls: [],
    scheduledFor: null,
  }

  it('accepte une modification valide (texte + mediaUrls vides + scheduledFor null)', () => {
    // Cas le plus courant : modification du texte sans médias ni replanification
    const result = ProposedEditSchema.safeParse(validEdit)
    expect(result.success).toBe(true)
  })

  it('accepte une date ISO future valide', () => {
    // La replanification passe une date ISO 8601 comme string
    const futureIso = '2099-12-31T09:00:00.000Z'
    const result = ProposedEditSchema.safeParse({ ...validEdit, scheduledFor: futureIso })
    expect(result.success).toBe(true)
  })

  it('accepte des mediaUrls valides', () => {
    // L'IA peut attribuer des médias du pool à ce post
    const result = ProposedEditSchema.safeParse({
      ...validEdit,
      mediaUrls: [
        'https://storage.supabase.co/object/public/post-media/photo.jpg',
        'https://cdn.example.com/video.mp4',
      ],
    })
    expect(result.success).toBe(true)
  })

  it('rejette un texte vide (min 1)', () => {
    // L'IA ne peut pas proposer un post sans texte
    const result = ProposedEditSchema.safeParse({ ...validEdit, text: '' })
    expect(result.success).toBe(false)
  })

  it('rejette un texte de 63207 caractères (max 63206)', () => {
    // Limite absolue : Facebook est la plateforme la plus permissive à 63206 chars
    const result = ProposedEditSchema.safeParse({ ...validEdit, text: 'a'.repeat(63207) })
    expect(result.success).toBe(false)
  })

  it('accepte un texte de exactement 63206 caractères (limite)', () => {
    // La limite doit être inclusive
    const result = ProposedEditSchema.safeParse({ ...validEdit, text: 'a'.repeat(63206) })
    expect(result.success).toBe(true)
  })

  it('rejette une URL malformée dans mediaUrls', () => {
    // Une chaîne sans protocole n'est pas une URL valide pour z.string().url()
    // Note : z.string().url() accepte les data:URI — le filtrage data: se fait dans l'action
    const result = ProposedEditSchema.safeParse({
      ...validEdit,
      mediaUrls: ['not-a-url-at-all'],
    })
    expect(result.success).toBe(false)
  })

  it('rejette scheduledFor = "not-a-date" (doit être datetime ISO 8601)', () => {
    // La date doit être parseable en ISO 8601 strict (z.string().datetime())
    const result = ProposedEditSchema.safeParse({ ...validEdit, scheduledFor: 'not-a-date' })
    expect(result.success).toBe(false)
  })

  it('rejette un postId vide', () => {
    // L'ID est requis pour identifier le post en DB
    const result = ProposedEditSchema.safeParse({ ...validEdit, postId: '' })
    expect(result.success).toBe(false)
  })

  it('accepte scheduledFor = null explicitement', () => {
    // null est autorisé explicitement (post sans date de publication)
    const result = ProposedEditSchema.safeParse({ ...validEdit, scheduledFor: null })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.scheduledFor).toBeNull()
    }
  })
})

// ─── BulkApplyEditsSchema ─────────────────────────────────────────────────────

describe('BulkApplyEditsSchema', () => {
  // Un edit minimal valide pour composer les tableaux
  const oneValidEdit = {
    postId: 'abc123',
    text: 'Texte édité',
    mediaUrls: [],
    scheduledFor: null,
  }

  it('accepte 1 edit valide (minimum)', () => {
    // Cas nominal : confirmation d'une seule modification
    const result = BulkApplyEditsSchema.safeParse({ edits: [oneValidEdit] })
    expect(result.success).toBe(true)
  })

  it('rejette un tableau edits vide (min 1)', () => {
    // Il n'y a rien à appliquer si le tableau est vide
    const result = BulkApplyEditsSchema.safeParse({ edits: [] })
    expect(result.success).toBe(false)
  })

  it('rejette 51 edits (max 50)', () => {
    // Aligne avec BulkEditBatchSchema.postIds max 50
    const edits = Array.from({ length: 51 }, (_, i) => ({
      postId: `post-${i}`,
      text: 'Texte',
      mediaUrls: [],
      scheduledFor: null,
    }))
    const result = BulkApplyEditsSchema.safeParse({ edits })
    expect(result.success).toBe(false)
  })

  it('accepte 50 edits valides (limite)', () => {
    // La limite max doit être inclusive
    const edits = Array.from({ length: 50 }, (_, i) => ({
      postId: `post-${i}`,
      text: `Texte du post ${i}`,
      mediaUrls: [],
      scheduledFor: null,
    }))
    const result = BulkApplyEditsSchema.safeParse({ edits })
    expect(result.success).toBe(true)
  })

  it('rejette si un seul edit du tableau est invalide', () => {
    // Zod valide chaque item — un seul invalide fait échouer le tableau
    const edits = [
      oneValidEdit,
      { postId: '', text: '', mediaUrls: [], scheduledFor: null }, // invalide
    ]
    const result = BulkApplyEditsSchema.safeParse({ edits })
    expect(result.success).toBe(false)
  })
})

// ─── getCharLimit (cas bulk) ──────────────────────────────────────────────────

describe('getCharLimit (plateformes bulk)', () => {
  it('retourne 280 pour Twitter', () => {
    expect(getCharLimit('twitter')).toBe(280)
  })

  it('retourne 2200 pour Instagram', () => {
    expect(getCharLimit('instagram')).toBe(2200)
  })

  it('retourne 63206 pour une plateforme inconnue (fallback Facebook max)', () => {
    // Dans un bulk edit, une plateforme inconnue ne doit pas bloquer l'opération
    expect(getCharLimit('unknown')).toBe(63206)
  })

  it('retourne 5000 pour YouTube', () => {
    expect(getCharLimit('youtube')).toBe(5000)
  })

  it('retourne 63206 pour Facebook', () => {
    // Limite maximale absolue utilisée dans PostCreateSchema.text.max()
    expect(getCharLimit('facebook')).toBe(63206)
  })
})
