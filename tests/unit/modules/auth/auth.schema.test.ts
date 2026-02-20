/**
 * @file tests/unit/modules/auth/auth.schema.test.ts
 * @description Tests unitaires pour les schémas Zod d'authentification.
 *   Vérifie la validation correcte et le rejet des données invalides
 *   pour LoginSchema, RegisterSchema et ForgotPasswordSchema.
 */

import { describe, expect, it } from 'vitest'

import {
  ForgotPasswordSchema,
  LoginSchema,
  RegisterSchema,
} from '@/modules/auth/schemas/auth.schema'

// ─── LoginSchema ──────────────────────────────────────────────────────────────

describe('LoginSchema', () => {
  it('valide un email et mot de passe corrects', () => {
    const result = LoginSchema.safeParse({
      email: 'user@example.com',
      password: 'motdepasse123',
    })
    expect(result.success).toBe(true)
  })

  it("normalise l'email en minuscules", () => {
    const result = LoginSchema.safeParse({
      email: 'USER@EXAMPLE.COM',
      password: 'motdepasse123',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.email).toBe('user@example.com')
    }
  })

  it('rejette un email invalide', () => {
    const result = LoginSchema.safeParse({
      email: 'pas-un-email',
      password: 'motdepasse123',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.email).toBeDefined()
    }
  })

  it('rejette un email vide', () => {
    const result = LoginSchema.safeParse({ email: '', password: 'motdepasse123' })
    expect(result.success).toBe(false)
  })

  it('rejette un mot de passe vide', () => {
    const result = LoginSchema.safeParse({ email: 'user@example.com', password: '' })
    expect(result.success).toBe(false)
  })
})

// ─── RegisterSchema ───────────────────────────────────────────────────────────

describe('RegisterSchema', () => {
  const validData = {
    name: 'Marie Dupont',
    email: 'marie@example.com',
    password: 'motdepasse123',
    confirmPassword: 'motdepasse123',
  }

  it('valide une inscription correcte', () => {
    const result = RegisterSchema.safeParse(validData)
    expect(result.success).toBe(true)
  })

  it('rejette un nom trop court (< 2 chars)', () => {
    const result = RegisterSchema.safeParse({ ...validData, name: 'A' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.name).toBeDefined()
    }
  })

  it('rejette un mot de passe trop court (< 8 chars)', () => {
    const result = RegisterSchema.safeParse({
      ...validData,
      password: 'court',
      confirmPassword: 'court',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.password).toBeDefined()
    }
  })

  it('rejette des mots de passe qui ne correspondent pas', () => {
    const result = RegisterSchema.safeParse({
      ...validData,
      confirmPassword: 'autrepassword',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.confirmPassword).toBeDefined()
    }
  })

  it('rejette un email invalide', () => {
    const result = RegisterSchema.safeParse({ ...validData, email: 'pasunemail' })
    expect(result.success).toBe(false)
  })

  it('rejette un mot de passe trop long (> 72 chars)', () => {
    const result = RegisterSchema.safeParse({
      ...validData,
      password: 'a'.repeat(73),
      confirmPassword: 'a'.repeat(73),
    })
    expect(result.success).toBe(false)
  })
})

// ─── ForgotPasswordSchema ─────────────────────────────────────────────────────

describe('ForgotPasswordSchema', () => {
  it('valide un email correct', () => {
    const result = ForgotPasswordSchema.safeParse({ email: 'user@example.com' })
    expect(result.success).toBe(true)
  })

  it('rejette un email invalide', () => {
    const result = ForgotPasswordSchema.safeParse({ email: 'pasunemail' })
    expect(result.success).toBe(false)
  })

  it('rejette un email vide', () => {
    const result = ForgotPasswordSchema.safeParse({ email: '' })
    expect(result.success).toBe(false)
  })
})
