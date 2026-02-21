/**
 * @file tests/unit/modules/posts/post.schema.test.ts
 * @description Tests unitaires des schémas Zod et utilitaires du module posts.
 *   Vérifie :
 *   - PostCreateSchema (validation texte, plateforme unique, médias, planification)
 *   - PostUpdateSchema (id requis, champs partiels)
 *   - getCharLimit (limite de caractères par plateforme)
 *   - MediaUploadRequestSchema (type MIME, taille)
 *
 *   Modèle simplifié : 1 post = 1 plateforme (platform string, pas platforms[]).
 */

import { describe, expect, it } from 'vitest'

import {
  MediaUploadRequestSchema,
  PostCreateSchema,
  PostUpdateSchema,
  getCharLimit,
} from '@/modules/posts/schemas/post.schema'

// ─── getCharLimit ─────────────────────────────────────────────────────────────

describe('getCharLimit', () => {
  it('retourne 280 pour Twitter', () => {
    expect(getCharLimit('twitter')).toBe(280)
  })

  it('retourne 2200 pour Instagram', () => {
    expect(getCharLimit('instagram')).toBe(2200)
  })

  it('retourne 2200 pour TikTok', () => {
    expect(getCharLimit('tiktok')).toBe(2200)
  })

  it('retourne 5000 pour YouTube', () => {
    expect(getCharLimit('youtube')).toBe(5000)
  })

  it('retourne 63206 pour Facebook', () => {
    expect(getCharLimit('facebook')).toBe(63206)
  })

  it('retourne 300 pour Bluesky', () => {
    expect(getCharLimit('bluesky')).toBe(300)
  })

  it('retourne 3000 pour LinkedIn', () => {
    expect(getCharLimit('linkedin')).toBe(3000)
  })

  it('retourne 63206 (max Facebook) pour une plateforme inconnue (fallback)', () => {
    expect(getCharLimit('unknown_platform')).toBe(63206)
  })
})

// ─── PostCreateSchema ─────────────────────────────────────────────────────────

describe('PostCreateSchema', () => {
  const validPost = {
    text: 'Mon super post Instagram !',
    platform: 'instagram',
  }

  it('valide un post minimal (texte + une plateforme)', () => {
    const result = PostCreateSchema.safeParse(validPost)
    expect(result.success).toBe(true)
  })

  it('ajoute status DRAFT par défaut', () => {
    const result = PostCreateSchema.safeParse(validPost)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.status).toBe('DRAFT')
    }
  })

  it('ajoute mediaUrls vide par défaut', () => {
    const result = PostCreateSchema.safeParse(validPost)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.mediaUrls).toEqual([])
    }
  })

  it('rejette un texte vide', () => {
    expect(
      PostCreateSchema.safeParse({ ...validPost, text: '' }).success,
    ).toBe(false)
  })

  it('rejette un texte trop long (> 63206 chars)', () => {
    expect(
      PostCreateSchema.safeParse({
        ...validPost,
        text: 'a'.repeat(63207),
      }).success,
    ).toBe(false)
  })

  it('rejette si la plateforme est une chaîne vide', () => {
    expect(
      PostCreateSchema.safeParse({ ...validPost, platform: '' }).success,
    ).toBe(false)
  })

  it('accepte n\'importe quelle chaîne non vide comme plateforme', () => {
    // Le schéma accepte n'importe quel identifiant de plateforme valide
    const result = PostCreateSchema.safeParse({ ...validPost, platform: 'tiktok' })
    expect(result.success).toBe(true)
  })

  it('accepte des mediaUrls valides', () => {
    const result = PostCreateSchema.safeParse({
      ...validPost,
      mediaUrls: ['https://storage.supabase.co/object/public/post-media/user/photo.jpg'],
    })
    expect(result.success).toBe(true)
  })

  it('rejette une URL de média invalide', () => {
    expect(
      PostCreateSchema.safeParse({
        ...validPost,
        mediaUrls: ['not-a-url'],
      }).success,
    ).toBe(false)
  })

  it('rejette plus de 35 médias', () => {
    // Limite portée à 35 (TikTok, la plateforme la plus permissive)
    expect(
      PostCreateSchema.safeParse({
        ...validPost,
        mediaUrls: Array.from({ length: 36 }, (_, i) => `https://example.com/media/${i}.jpg`),
      }).success,
    ).toBe(false)
  })

  it('accepte un statut SCHEDULED explicite', () => {
    const result = PostCreateSchema.safeParse({
      ...validPost,
      status: 'SCHEDULED',
    })
    expect(result.success).toBe(true)
  })

  it('rejette un statut invalide', () => {
    expect(
      PostCreateSchema.safeParse({ ...validPost, status: 'PENDING' }).success,
    ).toBe(false)
  })

  it('accepte une date de planification future', () => {
    const futureDate = new Date()
    futureDate.setDate(futureDate.getDate() + 1) // Demain

    const result = PostCreateSchema.safeParse({
      ...validPost,
      scheduledFor: futureDate,
    })
    expect(result.success).toBe(true)
  })

  it('rejette une date de planification passée', () => {
    const pastDate = new Date()
    pastDate.setDate(pastDate.getDate() - 1) // Hier

    expect(
      PostCreateSchema.safeParse({
        ...validPost,
        scheduledFor: pastDate,
      }).success,
    ).toBe(false)
  })
})

// ─── PostUpdateSchema ─────────────────────────────────────────────────────────

describe('PostUpdateSchema', () => {
  it('valide une mise à jour avec id seul', () => {
    const result = PostUpdateSchema.safeParse({ id: 'post_abc123' })
    expect(result.success).toBe(true)
  })

  it('rejette un update sans id', () => {
    expect(
      PostUpdateSchema.safeParse({ text: 'Nouveau texte' }).success,
    ).toBe(false)
  })

  it('rejette un id vide', () => {
    expect(
      PostUpdateSchema.safeParse({ id: '' }).success,
    ).toBe(false)
  })

  it('accepte un update partiel avec id + texte', () => {
    const result = PostUpdateSchema.safeParse({
      id: 'post_abc123',
      text: 'Texte mis à jour',
    })
    expect(result.success).toBe(true)
  })

  it('accepte un update complet', () => {
    const futureDate = new Date()
    futureDate.setDate(futureDate.getDate() + 7)

    const result = PostUpdateSchema.safeParse({
      id: 'post_abc123',
      text: 'Texte complet mis à jour',
      platform: 'instagram',
      mediaUrls: ['https://example.com/photo.jpg'],
      scheduledFor: futureDate,
      status: 'SCHEDULED',
    })
    expect(result.success).toBe(true)
  })
})

// ─── MediaUploadRequestSchema ─────────────────────────────────────────────────

describe('MediaUploadRequestSchema', () => {
  it('valide une image JPEG', () => {
    const result = MediaUploadRequestSchema.safeParse({
      filename: 'photo.jpg',
      mimeType: 'image/jpeg',
      size: 1024 * 1024, // 1 Mo
    })
    expect(result.success).toBe(true)
  })

  it('valide une vidéo MP4', () => {
    const result = MediaUploadRequestSchema.safeParse({
      filename: 'video.mp4',
      mimeType: 'video/mp4',
      size: 50 * 1024 * 1024, // 50 Mo
    })
    expect(result.success).toBe(true)
  })

  it('rejette un type MIME non autorisé (PDF)', () => {
    expect(
      MediaUploadRequestSchema.safeParse({
        filename: 'document.pdf',
        mimeType: 'application/pdf',
        size: 1024,
      }).success,
    ).toBe(false)
  })

  it('rejette un fichier dépassant 500 Mo', () => {
    expect(
      MediaUploadRequestSchema.safeParse({
        filename: 'huge.mp4',
        mimeType: 'video/mp4',
        size: 501 * 1024 * 1024, // 501 Mo
      }).success,
    ).toBe(false)
  })

  it('rejette un nom de fichier vide', () => {
    expect(
      MediaUploadRequestSchema.safeParse({
        filename: '',
        mimeType: 'image/jpeg',
        size: 1024,
      }).success,
    ).toBe(false)
  })
})
