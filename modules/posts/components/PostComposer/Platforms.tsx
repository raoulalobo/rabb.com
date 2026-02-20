/**
 * @file modules/posts/components/PostComposer/Platforms.tsx
 * @module posts
 * @description Sélecteur de plateformes pour le PostComposer.
 *   Encapsule PlatformPicker en le connectant au contexte du PostComposer.
 *
 *   Interaction avec le contexte :
 *   - Lit : platforms, isSubmitting
 *   - Écrit : setPlatforms
 *
 * @example
 *   <PostComposer>
 *     <PostComposer.Platforms />
 *   </PostComposer>
 */

'use client'

import type { LatePlatform } from '@/lib/late'
import { PlatformPicker } from '@/modules/platforms/components/PlatformPicker'
import type { Platform } from '@/modules/platforms/types'

import { usePostComposerContext } from './context'

// ─── Composant ────────────────────────────────────────────────────────────────

/**
 * Section de sélection des plateformes cibles du post.
 * Délègue l'affichage à PlatformPicker (qui gère le fetch des plateformes connectées).
 * Connecté au draftStore via le contexte PostComposer.
 */
export function Platforms(): React.JSX.Element {
  const { platforms, setPlatforms, isSubmitting } = usePostComposerContext()

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground">Publier sur</p>
      <PlatformPicker
        selected={platforms as LatePlatform[]}
        onChange={(selected) => setPlatforms(selected as Platform[])}
        disabled={isSubmitting}
      />
    </div>
  )
}
