/**
 * @file modules/posts/components/PostComposer/CarouselEditor.tsx
 * @module posts
 * @description Indicateur visuel pour le mode carrousel dans le PostComposer.
 *   Affiche un bandeau informatif rappelant les limites du carrousel :
 *   - Instagram : jusqu'à 10 images/vidéos
 *   - TikTok : jusqu'à 35 photos
 *   - LinkedIn / Facebook : jusqu'à 10/20 images
 *
 *   L'upload de médias se fait toujours via PostComposer.MediaUpload existant.
 *   Ce composant ajoute uniquement le contexte carrousel (compteur, limites).
 *
 *   Visible uniquement quand contentType = "carousel".
 *
 * @example
 *   <PostComposer>
 *     <PostComposer.ContentTypePicker />
 *     {contentType === 'carousel' && <PostComposer.CarouselEditor />}
 *     <PostComposer.MediaUpload />
 *   </PostComposer>
 */

'use client'

import { Images, Info } from 'lucide-react'

import { Badge } from '@/components/ui/badge'

import { usePostComposerContext } from './context'

// ─── Limites de carrousel par plateforme ──────────────────────────────────────

/** Nombre maximum de médias dans un carrousel par plateforme */
const CAROUSEL_LIMITS: Record<string, number> = {
  instagram: 10,
  tiktok: 35,
  facebook: 10,
  linkedin: 20,
}

/** Labels français des plateformes */
const PLATFORM_LABELS: Record<string, string> = {
  instagram: 'Instagram',
  tiktok: 'TikTok',
  facebook: 'Facebook',
  linkedin: 'LinkedIn',
}

// ─── Composant ────────────────────────────────────────────────────────────────

/**
 * Bandeau informatif pour le mode carrousel.
 * Affiche le nombre de médias actuels et la limite par plateforme sélectionnée.
 *
 * @returns Bandeau carrousel ou null si contentType !== "carousel"
 */
export function CarouselEditor(): React.JSX.Element | null {
  const { contentType, activeMediaUrls, platforms } = usePostComposerContext()

  // Ne s'affiche que pour les carrousels
  if (contentType !== 'carousel') return null

  // Trouver la limite la plus restrictive parmi les plateformes sélectionnées
  const relevantPlatforms = platforms.filter((p) => p in CAROUSEL_LIMITS)
  const minLimit = relevantPlatforms.length > 0
    ? Math.min(...relevantPlatforms.map((p) => CAROUSEL_LIMITS[p] ?? 10))
    : 10

  const mediaCount = activeMediaUrls.length
  const isOverLimit = mediaCount > minLimit

  return (
    <div className="rounded-lg border border-dashed p-3 space-y-2">
      {/* ── En-tête ────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Images className="size-4 text-primary" />
          <span className="text-sm font-medium">Mode Carrousel</span>
        </div>
        <Badge variant={isOverLimit ? 'destructive' : 'secondary'} className="text-xs">
          {mediaCount} / {minLimit} médias
        </Badge>
      </div>

      {/* ── Infos par plateforme ───────────────────────────────────────── */}
      {relevantPlatforms.length > 0 && (
        <div className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
          <Info className="size-3 mt-0.5 shrink-0" />
          <span>
            Limites :{' '}
            {relevantPlatforms.map((p, i) => (
              <span key={p}>
                {PLATFORM_LABELS[p] ?? p} ({CAROUSEL_LIMITS[p]})
                {i < relevantPlatforms.length - 1 ? ', ' : ''}
              </span>
            ))}
          </span>
        </div>
      )}

      {/* ── Indication si aucun média ──────────────────────────────────── */}
      {mediaCount === 0 && (
        <p className="text-xs text-muted-foreground italic">
          Ajoutez au moins 2 médias ci-dessous pour créer un carrousel.
        </p>
      )}
    </div>
  )
}
