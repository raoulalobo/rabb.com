/**
 * @file modules/posts/components/PostComposer/PlatformContentEditor.tsx
 * @module posts
 * @description Editeur de contenu personnalise par plateforme avec preview des limites.
 *   Affiche un panneau d'edition sous les onglets de plateforme quand l'utilisateur
 *   active la personnalisation pour une plateforme specifique.
 *
 *   Fonctionnalites :
 *   - Affiche le texte personnalise de l'onglet actif avec compteur de caracteres
 *   - Barre de progression coloree (vert → orange → rouge) selon la limite
 *   - Badge indiquant le nombre de caracteres restants
 *   - Bouton pour reinitialiser la personnalisation (retour au contenu de base)
 *   - Informations sur les contraintes de la plateforme (max chars, medias)
 *
 *   Interaction avec le contexte PostComposer :
 *   - Lit : activePlatformTab, activeText, isPlatformCustomized, platforms
 *   - Ecrit : customizePlatform, resetPlatform, setActiveText
 *
 *   Ce composant est rendu uniquement quand :
 *   - Au moins 2 plateformes sont selectionnees
 *   - L'onglet actif est une plateforme specifique (pas "Tous")
 *
 * @example
 *   <PostComposer>
 *     <PostComposer.PlatformTabs />
 *     <PlatformContentEditor />
 *     <PostComposer.Editor />
 *   </PostComposer>
 */

'use client'

import { AlertTriangle, Pencil, RotateCcw } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { PLATFORM_RULES } from '@/modules/platforms/config/platform-rules'
import type { Platform } from '@/modules/platforms/types'
import { getCharLimit } from '@/modules/posts/schemas/post.schema'

import { usePostComposerContext } from './context'

// ─── Labels lisibles par plateforme ──────────────────────────────────────────

/** Labels en francais pour chaque plateforme (identiques a PlatformTabs.tsx) */
const PLATFORM_LABELS: Record<Platform, string> = {
  instagram: 'Instagram',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  facebook: 'Facebook',
  twitter: 'Twitter / X',
  linkedin: 'LinkedIn',
  bluesky: 'Bluesky',
  threads: 'Threads',
  reddit: 'Reddit',
  pinterest: 'Pinterest',
  telegram: 'Telegram',
  snapchat: 'Snapchat',
  google_business: 'Google Business',
}

// ─── Composant ────────────────────────────────────────────────────────────────

/**
 * Panneau d'information et d'actions pour la personnalisation par plateforme.
 * Affiche les limites de la plateforme active et un apercu du contenu.
 *
 * Rendu conditionnel :
 * - Masque si < 2 plateformes selectionnees (pas de personalisation necessaire)
 * - Masque si l'onglet "Tous" est actif (pas de plateforme specifique)
 * - Affiche un CTA "Personnaliser" si l'onglet n'a pas d'override
 * - Affiche un resume avec bouton "Reinitialiser" si l'override est actif
 *
 * @returns Le panneau d'information ou null si non applicable
 *
 * @example
 *   // Dans le PostComposer, entre PlatformTabs et Editor :
 *   <PlatformContentEditor />
 */
export function PlatformContentEditor(): React.JSX.Element | null {
  const {
    activePlatformTab,
    activeText,
    platforms,
    isPlatformCustomized,
    customizePlatform,
    resetPlatform,
    readOnly,
  } = usePostComposerContext()

  // ─── Conditions de masquage ─────────────────────────────────────────────────
  // Pas de personnalisation possible si < 2 plateformes
  if (platforms.length < 2) return null
  // Pas de plateforme specifique selectionnee (onglet "Tous")
  if (activePlatformTab === null) return null

  const platform = activePlatformTab
  const isCustomized = isPlatformCustomized(platform)
  const label = PLATFORM_LABELS[platform] ?? platform
  const charLimit = getCharLimit(platform)
  const charCount = activeText.length
  const remaining = charLimit - charCount
  const isOverLimit = remaining < 0
  const progress = Math.min((charCount / charLimit) * 100, 100)

  // Regles de la plateforme (max photos, videos, texte requis, etc.)
  const rules = PLATFORM_RULES[platform]

  return (
    <Card className="border-dashed">
      <CardHeader className="flex flex-row items-center justify-between gap-2 py-2 px-3">
        {/* ── Titre avec badge de plateforme ────────────────────────────────── */}
        <div className="flex items-center gap-2">
          <Badge variant={isCustomized ? 'default' : 'secondary'} className="text-xs">
            {label}
          </Badge>

          {isCustomized ? (
            <span className="flex items-center gap-1 text-xs text-primary">
              <Pencil className="size-3" aria-hidden="true" />
              Personnalise
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">
              Utilise le contenu commun
            </span>
          )}
        </div>

        {/* ── Actions ─────────────────────────────────────────────────────── */}
        {!readOnly && (
          <div className="flex items-center gap-1">
            {isCustomized ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => resetPlatform(platform)}
                className="h-7 gap-1 text-xs text-muted-foreground hover:text-destructive"
                title="Supprimer la personnalisation et revenir au contenu commun"
              >
                <RotateCcw className="size-3" />
                <span className="hidden sm:inline">Reinitialiser</span>
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => customizePlatform(platform)}
                className="h-7 gap-1 text-xs text-muted-foreground hover:text-primary"
                title="Personnaliser le contenu pour cette plateforme"
              >
                <Pencil className="size-3" />
                <span className="hidden sm:inline">Personnaliser</span>
              </Button>
            )}
          </div>
        )}
      </CardHeader>

      <CardContent className="px-3 pb-2 pt-0">
        {/* ── Barre de progression des caracteres ───────────────────────────── */}
        <div className="space-y-1.5">
          {/* Barre visuelle */}
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={[
                'h-full rounded-full transition-all duration-300',
                isOverLimit
                  ? 'bg-destructive'
                  : progress >= 90
                    ? 'bg-amber-500'
                    : 'bg-primary',
              ].join(' ')}
              style={{ width: `${Math.min(progress, 100)}%` }}
              role="progressbar"
              aria-valuenow={charCount}
              aria-valuemin={0}
              aria-valuemax={charLimit}
              aria-label={`${charCount} caracteres sur ${charLimit} autorises`}
            />
          </div>

          {/* Compteur textuel + infos plateforme */}
          <div className="flex items-center justify-between text-[11px]">
            {/* Infos de la plateforme */}
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-muted-foreground">
              <span>
                {charLimit.toLocaleString('fr-FR')} car. max
              </span>
              {rules && (
                <>
                  {rules.maxPhotos > 0 && (
                    <span>{rules.maxPhotos} photo{rules.maxPhotos > 1 ? 's' : ''}</span>
                  )}
                  {rules.maxVideos > 0 && (
                    <span>{rules.maxVideos} video{rules.maxVideos > 1 ? 's' : ''}</span>
                  )}
                  {rules.requiresMedia && (
                    <span className="text-amber-600 dark:text-amber-400">media requis</span>
                  )}
                </>
              )}
            </div>

            {/* Compteur de caracteres restants */}
            <span
              className={[
                'tabular-nums font-medium',
                isOverLimit
                  ? 'text-destructive'
                  : progress >= 90
                    ? 'text-amber-500'
                    : 'text-muted-foreground',
              ].join(' ')}
            >
              {isOverLimit && (
                <AlertTriangle className="mr-0.5 inline size-3" aria-hidden="true" />
              )}
              {isOverLimit ? `-${Math.abs(remaining)}` : remaining}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
