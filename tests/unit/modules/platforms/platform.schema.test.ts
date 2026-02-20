/**
 * @file tests/unit/modules/platforms/platform.schema.test.ts
 * @description Tests unitaires des schémas Zod du module platforms.
 *   Vérifie la validation des plateformes, des données de connexion et de déconnexion.
 */

import { describe, expect, it } from 'vitest'

import {
  ConnectPlatformSchema,
  ConnectedPlatformSchema,
  DisconnectPlatformSchema,
  PlatformEnum,
} from '@/modules/platforms/schemas/platform.schema'

// ─── PlatformEnum ─────────────────────────────────────────────────────────────

describe('PlatformEnum', () => {
  it('accepte les 4 plateformes prioritaires', () => {
    expect(PlatformEnum.safeParse('instagram').success).toBe(true)
    expect(PlatformEnum.safeParse('tiktok').success).toBe(true)
    expect(PlatformEnum.safeParse('youtube').success).toBe(true)
    expect(PlatformEnum.safeParse('facebook').success).toBe(true)
  })

  it('accepte les plateformes secondaires', () => {
    expect(PlatformEnum.safeParse('twitter').success).toBe(true)
    expect(PlatformEnum.safeParse('linkedin').success).toBe(true)
    expect(PlatformEnum.safeParse('bluesky').success).toBe(true)
    expect(PlatformEnum.safeParse('reddit').success).toBe(true)
    expect(PlatformEnum.safeParse('google_business').success).toBe(true)
  })

  it('rejette une plateforme inconnue', () => {
    expect(PlatformEnum.safeParse('snapbook').success).toBe(false)
    expect(PlatformEnum.safeParse('myspace').success).toBe(false)
    expect(PlatformEnum.safeParse('').success).toBe(false)
  })

  it('est sensible à la casse (minuscules uniquement)', () => {
    expect(PlatformEnum.safeParse('Instagram').success).toBe(false)
    expect(PlatformEnum.safeParse('TIKTOK').success).toBe(false)
  })
})

// ─── ConnectPlatformSchema ────────────────────────────────────────────────────

describe('ConnectPlatformSchema', () => {
  it('valide une plateforme valide', () => {
    const result = ConnectPlatformSchema.safeParse({ platform: 'instagram' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.platform).toBe('instagram')
    }
  })

  it('rejette une plateforme manquante', () => {
    expect(ConnectPlatformSchema.safeParse({}).success).toBe(false)
  })

  it('rejette une plateforme inconnue', () => {
    expect(ConnectPlatformSchema.safeParse({ platform: 'unknown' }).success).toBe(false)
  })

  it('rejette un objet vide', () => {
    expect(ConnectPlatformSchema.safeParse(null).success).toBe(false)
  })
})

// ─── DisconnectPlatformSchema ─────────────────────────────────────────────────

describe('DisconnectPlatformSchema', () => {
  it('valide un ID non vide', () => {
    const result = DisconnectPlatformSchema.safeParse({ connectedPlatformId: 'cpl_abc123' })
    expect(result.success).toBe(true)
  })

  it('rejette un ID vide', () => {
    expect(DisconnectPlatformSchema.safeParse({ connectedPlatformId: '' }).success).toBe(false)
  })

  it('rejette un ID manquant', () => {
    expect(DisconnectPlatformSchema.safeParse({}).success).toBe(false)
  })
})

// ─── ConnectedPlatformSchema ──────────────────────────────────────────────────

describe('ConnectedPlatformSchema', () => {
  const validPlatform = {
    id: 'cpl_abc123',
    userId: 'usr_xyz',
    platform: 'instagram',
    lateProfileId: 'prof_abc',
    accountName: '@marie',
    isActive: true,
    connectedAt: new Date(),
  }

  it('valide un objet complet', () => {
    expect(ConnectedPlatformSchema.safeParse(validPlatform).success).toBe(true)
  })

  it('valide avec avatarUrl optionnel', () => {
    expect(
      ConnectedPlatformSchema.safeParse({
        ...validPlatform,
        avatarUrl: 'https://example.com/avatar.jpg',
      }).success,
    ).toBe(true)
  })

  it('rejette si avatarUrl est une URL invalide', () => {
    expect(
      ConnectedPlatformSchema.safeParse({
        ...validPlatform,
        avatarUrl: 'not-a-url',
      }).success,
    ).toBe(false)
  })

  it('rejette si platform est invalide', () => {
    expect(
      ConnectedPlatformSchema.safeParse({
        ...validPlatform,
        platform: 'unknown',
      }).success,
    ).toBe(false)
  })

  it('rejette si id est manquant', () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id: _id, ...withoutId } = validPlatform
    expect(ConnectedPlatformSchema.safeParse(withoutId).success).toBe(false)
  })
})
