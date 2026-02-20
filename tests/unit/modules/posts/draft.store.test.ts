/**
 * @file tests/unit/modules/posts/draft.store.test.ts
 * @description Tests unitaires du store Zustand du brouillon (draftStore).
 *   Vérifie toutes les actions du store :
 *   - setText, setPlatforms, togglePlatform
 *   - addMediaUrl, removeMediaUrl
 *   - setScheduledFor, setPostId
 *   - reset (remet à l'état initial)
 */

import { act } from 'react'
import { beforeEach, describe, expect, it } from 'vitest'

import { useDraftStore } from '@/modules/posts/store/draft.store'

// ─── Setup ────────────────────────────────────────────────────────────────────

/**
 * Réinitialise le store avant chaque test pour garantir l'isolation.
 * Utilise act() pour les mutations synchrones Zustand.
 */
beforeEach(() => {
  act(() => {
    useDraftStore.getState().reset()
  })
})

// ─── État initial ─────────────────────────────────────────────────────────────

describe('état initial', () => {
  it('a un texte vide', () => {
    expect(useDraftStore.getState().text).toBe('')
  })

  it('n\'a aucune plateforme sélectionnée', () => {
    expect(useDraftStore.getState().platforms).toEqual([])
  })

  it('n\'a aucun média', () => {
    expect(useDraftStore.getState().mediaUrls).toEqual([])
  })

  it('n\'a pas de date de planification', () => {
    expect(useDraftStore.getState().scheduledFor).toBeNull()
  })

  it('n\'a pas d\'ID de post', () => {
    expect(useDraftStore.getState().postId).toBeNull()
  })
})

// ─── setText ──────────────────────────────────────────────────────────────────

describe('setText', () => {
  it('met à jour le texte', () => {
    act(() => {
      useDraftStore.getState().setText('Mon post Instagram !')
    })
    expect(useDraftStore.getState().text).toBe('Mon post Instagram !')
  })

  it('accepte un texte vide', () => {
    act(() => {
      useDraftStore.getState().setText('Texte temporaire')
      useDraftStore.getState().setText('')
    })
    expect(useDraftStore.getState().text).toBe('')
  })

  it('accepte les emojis et caractères spéciaux', () => {
    const text = '🎉 Test avec émojis & caractères spéciaux <script>alert(1)</script>'
    act(() => {
      useDraftStore.getState().setText(text)
    })
    expect(useDraftStore.getState().text).toBe(text)
  })
})

// ─── setPlatforms ─────────────────────────────────────────────────────────────

describe('setPlatforms', () => {
  it('remplace la liste entière des plateformes', () => {
    act(() => {
      useDraftStore.getState().setPlatforms(['instagram', 'tiktok'])
    })
    expect(useDraftStore.getState().platforms).toEqual(['instagram', 'tiktok'])
  })

  it('permet de vider la liste', () => {
    act(() => {
      useDraftStore.getState().setPlatforms(['instagram'])
      useDraftStore.getState().setPlatforms([])
    })
    expect(useDraftStore.getState().platforms).toEqual([])
  })
})

// ─── togglePlatform ───────────────────────────────────────────────────────────

describe('togglePlatform', () => {
  it('ajoute une plateforme si elle est absente', () => {
    act(() => {
      useDraftStore.getState().togglePlatform('instagram')
    })
    expect(useDraftStore.getState().platforms).toContain('instagram')
  })

  it('retire une plateforme si elle est déjà présente', () => {
    act(() => {
      useDraftStore.getState().togglePlatform('instagram')
      useDraftStore.getState().togglePlatform('instagram')
    })
    expect(useDraftStore.getState().platforms).not.toContain('instagram')
  })

  it('gère plusieurs plateformes indépendamment', () => {
    act(() => {
      useDraftStore.getState().togglePlatform('instagram')
      useDraftStore.getState().togglePlatform('tiktok')
      useDraftStore.getState().togglePlatform('facebook')
    })
    const { platforms } = useDraftStore.getState()
    expect(platforms).toContain('instagram')
    expect(platforms).toContain('tiktok')
    expect(platforms).toContain('facebook')
  })

  it('retire seulement la plateforme ciblée', () => {
    act(() => {
      useDraftStore.getState().togglePlatform('instagram')
      useDraftStore.getState().togglePlatform('tiktok')
      useDraftStore.getState().togglePlatform('instagram') // Retire instagram
    })
    const { platforms } = useDraftStore.getState()
    expect(platforms).not.toContain('instagram')
    expect(platforms).toContain('tiktok')
  })
})

// ─── addMediaUrl / removeMediaUrl ─────────────────────────────────────────────

describe('addMediaUrl', () => {
  it('ajoute une URL de média', () => {
    const url = 'https://storage.supabase.co/object/public/post-media/photo.jpg'
    act(() => {
      useDraftStore.getState().addMediaUrl(url)
    })
    expect(useDraftStore.getState().mediaUrls).toContain(url)
  })

  it('ajoute plusieurs URLs', () => {
    act(() => {
      useDraftStore.getState().addMediaUrl('https://example.com/a.jpg')
      useDraftStore.getState().addMediaUrl('https://example.com/b.jpg')
    })
    expect(useDraftStore.getState().mediaUrls).toHaveLength(2)
  })
})

describe('removeMediaUrl', () => {
  it('retire une URL de média existante', () => {
    const url = 'https://example.com/photo.jpg'
    act(() => {
      useDraftStore.getState().addMediaUrl(url)
      useDraftStore.getState().removeMediaUrl(url)
    })
    expect(useDraftStore.getState().mediaUrls).not.toContain(url)
  })

  it('ne fait rien si l\'URL n\'existe pas', () => {
    act(() => {
      useDraftStore.getState().addMediaUrl('https://example.com/a.jpg')
      useDraftStore.getState().removeMediaUrl('https://example.com/inexistant.jpg')
    })
    expect(useDraftStore.getState().mediaUrls).toHaveLength(1)
  })

  it('retire seulement l\'URL ciblée parmi plusieurs', () => {
    act(() => {
      useDraftStore.getState().addMediaUrl('https://example.com/a.jpg')
      useDraftStore.getState().addMediaUrl('https://example.com/b.jpg')
      useDraftStore.getState().removeMediaUrl('https://example.com/a.jpg')
    })
    const { mediaUrls } = useDraftStore.getState()
    expect(mediaUrls).not.toContain('https://example.com/a.jpg')
    expect(mediaUrls).toContain('https://example.com/b.jpg')
  })
})

// ─── setScheduledFor ──────────────────────────────────────────────────────────

describe('setScheduledFor', () => {
  it('définit une date de planification', () => {
    const date = new Date('2024-12-25T10:00:00')
    act(() => {
      useDraftStore.getState().setScheduledFor(date)
    })
    expect(useDraftStore.getState().scheduledFor).toEqual(date)
  })

  it('accepte null pour annuler la planification', () => {
    act(() => {
      useDraftStore.getState().setScheduledFor(new Date())
      useDraftStore.getState().setScheduledFor(null)
    })
    expect(useDraftStore.getState().scheduledFor).toBeNull()
  })
})

// ─── setPostId ────────────────────────────────────────────────────────────────

describe('setPostId', () => {
  it('lie le brouillon à un post DB existant', () => {
    act(() => {
      useDraftStore.getState().setPostId('post_abc123')
    })
    expect(useDraftStore.getState().postId).toBe('post_abc123')
  })

  it('accepte null pour dissocier', () => {
    act(() => {
      useDraftStore.getState().setPostId('post_abc123')
      useDraftStore.getState().setPostId(null)
    })
    expect(useDraftStore.getState().postId).toBeNull()
  })
})

// ─── reset ────────────────────────────────────────────────────────────────────

describe('reset', () => {
  it('remet tout le store à l\'état initial', () => {
    // Remplir le store
    act(() => {
      useDraftStore.getState().setText('Texte à réinitialiser')
      useDraftStore.getState().togglePlatform('instagram')
      useDraftStore.getState().addMediaUrl('https://example.com/photo.jpg')
      useDraftStore.getState().setScheduledFor(new Date())
      useDraftStore.getState().setPostId('post_abc123')
    })

    // Réinitialiser
    act(() => {
      useDraftStore.getState().reset()
    })

    const state = useDraftStore.getState()
    expect(state.text).toBe('')
    expect(state.platforms).toEqual([])
    expect(state.mediaUrls).toEqual([])
    expect(state.scheduledFor).toBeNull()
    expect(state.postId).toBeNull()
  })
})
