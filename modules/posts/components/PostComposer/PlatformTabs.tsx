/**
 * @file modules/posts/components/PostComposer/PlatformTabs.tsx
 * @module posts
 * @description Barre d'onglets par plateforme pour le PostComposer.
 *   Affiche un onglet "Tous" (contenu de base commun) + un onglet par plateforme
 *   sélectionnée dans le brouillon. Permet de basculer entre les vues et d'initier
 *   la personnalisation du contenu par canal.
 *
 *   Indicateurs visuels :
 *   - Badge ✎ (crayon) : contenu personnalisé sur cette plateforme
 *   - Badge ⚠ : le contenu dépasse les limites de la plateforme
 *
 *   Interaction avec le contexte :
 *   - Lit : activePlatformTab, platforms, activeText, activeMediaUrls, isPlatformCustomized
 *   - Écrit : setActivePlatformTab, customizePlatform, resetPlatform
 *
 * @example
 *   <PostComposer>
 *     <PostComposer.PlatformTabs />
 *     <PostComposer.Editor />
 *   </PostComposer>
 */

'use client'

import { AlertTriangle, Pencil, RotateCcw } from 'lucide-react'
import { Fragment } from 'react'

import { PlatformIcon } from '@/modules/platforms/components/PlatformIcon'
import { getPlatformViolations } from '@/modules/platforms/config/platform-rules'
import type { Platform } from '@/modules/platforms/types'
import { useDraftStore } from '@/modules/posts/store/draft.store'

import { usePostComposerContext } from './context'

// ─── Constantes ───────────────────────────────────────────────────────────────

/** Labels lisibles en français pour chaque plateforme */
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
 * Barre d'onglets du PostComposer permettant de passer du contenu commun
 * au contenu spécifique à chaque plateforme.
 *
 * Ne prend aucune prop : tout est lu depuis le contexte PostComposer.
 *
 * Affichage :
 * - Onglet "Tous" toujours visible (onglet de base, commun à toutes les plateformes)
 * - Un onglet par plateforme sélectionnée
 * - Si 0 plateforme sélectionnée : seul l'onglet "Tous" est affiché
 */
export function PlatformTabs(): React.JSX.Element {
  const {
    activePlatformTab,
    setActivePlatformTab,
    platforms,
    isPlatformCustomized,
    customizePlatform,
    resetPlatform,
  } = usePostComposerContext()

  // Lire les overrides directement depuis le store pour détecter les violations
  // par plateforme (même sur les onglets non actifs)
  const { platformOverrides, text: baseText, mediaUrls: baseMediaUrls } = useDraftStore()

  // Si aucune plateforme sélectionnée, pas d'onglets à afficher (sauf "Tous")
  if (platforms.length === 0) return <></>

  return (
    <div
      role="tablist"
      aria-label="Onglets de contenu par plateforme"
      className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none"
    >
      {/* ── Onglet "Tous" (contenu de base) ─────────────────────────────────── */}
      <button
        role="tab"
        type="button"
        aria-selected={activePlatformTab === null}
        onClick={() => setActivePlatformTab(null)}
        className={[
          'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all',
          'whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          activePlatformTab === null
            ? 'bg-primary text-primary-foreground shadow-sm'
            : 'text-muted-foreground hover:bg-muted hover:text-foreground',
        ].join(' ')}
      >
        Tous
      </button>

      {/* Séparateur visuel */}
      <div className="h-4 w-px bg-border" aria-hidden="true" />

      {/* ── Onglets par plateforme ─────────────────────────────────────────── */}
      {platforms.map((platform) => {
        const isActive = activePlatformTab === platform
        const isCustomized = isPlatformCustomized(platform)

        // Calculer les violations pour cette plateforme
        // (en utilisant le contenu qu'elle afficherait : override ou base)
        const platformContent = platformOverrides[platform]
        const textToCheck = platformContent?.text ?? baseText
        const mediaToCheck = platformContent?.mediaUrls ?? baseMediaUrls
        const violations = getPlatformViolations(platform, textToCheck, mediaToCheck)
        const hasViolations = violations.length > 0

        return (
          <Fragment key={platform}>
            <PlatformTabButton
              platform={platform}
              label={PLATFORM_LABELS[platform]}
              isActive={isActive}
              isCustomized={isCustomized}
              hasViolations={hasViolations}
              violationMessages={violations.map((v) => v.message)}
              onClick={() => setActivePlatformTab(platform)}
            />

            {/* Menu contextuel d'override (visible uniquement sur l'onglet actif) */}
            {isActive && (
              <PlatformTabActions
                isCustomized={isCustomized}
                onCustomize={() => customizePlatform(platform)}
                onReset={() => resetPlatform(platform)}
              />
            )}
          </Fragment>
        )
      })}
    </div>
  )
}

// ─── Sous-composants ──────────────────────────────────────────────────────────

/**
 * Bouton d'un onglet de plateforme.
 * Affiche l'icône, le nom, et les badges d'état (personnalisé, violation).
 *
 * @param platform - Plateforme représentée
 * @param label - Libellé lisible de la plateforme
 * @param isActive - Vrai si cet onglet est sélectionné
 * @param isCustomized - Vrai si la plateforme a un override de contenu
 * @param hasViolations - Vrai si le contenu dépasse les limites de la plateforme
 * @param violationMessages - Messages d'erreur pour le tooltip
 * @param onClick - Callback de clic sur l'onglet
 */
function PlatformTabButton({
  platform,
  label,
  isActive,
  isCustomized,
  hasViolations,
  violationMessages,
  onClick,
}: {
  platform: Platform
  label: string
  isActive: boolean
  isCustomized: boolean
  hasViolations: boolean
  violationMessages: string[]
  onClick: () => void
}): React.JSX.Element {
  return (
    <button
      role="tab"
      type="button"
      aria-selected={isActive}
      aria-label={`${label}${isCustomized ? ' (personnalisé)' : ''}${hasViolations ? ' (avertissement)' : ''}`}
      onClick={onClick}
      className={[
        'flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-all',
        'whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        isActive
          ? 'bg-muted text-foreground shadow-sm'
          : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
      ].join(' ')}
    >
      {/* Icône de la plateforme */}
      <PlatformIcon platform={platform} className="size-3.5 shrink-0" />

      {/* Nom de la plateforme (masqué sur petits écrans) */}
      <span className="hidden sm:inline">{label}</span>

      {/* Badge "personnalisé" */}
      {isCustomized && (
        <span
          className="flex size-4 items-center justify-center rounded-full bg-primary/20 text-primary"
          title="Contenu personnalisé"
        >
          <Pencil className="size-2.5" />
        </span>
      )}

      {/* Badge "violation" — affiché seulement si problème ET pas de badge personnalisé
          (pour ne pas surcharger l'UI) */}
      {hasViolations && !isCustomized && (
        <span
          className="flex size-4 items-center justify-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-900/30"
          title={violationMessages.join(' | ')}
        >
          <AlertTriangle className="size-2.5" />
        </span>
      )}

      {/* Badge combiné : personnalisé ET violation */}
      {hasViolations && isCustomized && (
        <span
          className="flex size-4 items-center justify-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-900/30"
          title={violationMessages.join(' | ')}
        >
          <AlertTriangle className="size-2.5" />
        </span>
      )}
    </button>
  )
}

/**
 * Actions contextuelles d'un onglet de plateforme actif.
 * Affiche un bouton "Personnaliser" ou "Réinitialiser" selon l'état.
 *
 * @param platform - Plateforme concernée
 * @param isCustomized - Vrai si un override existe
 * @param onCustomize - Callback pour créer l'override (copie le contenu de base)
 * @param onReset - Callback pour supprimer l'override
 */
function PlatformTabActions({
  isCustomized,
  onCustomize,
  onReset,
}: {
  isCustomized: boolean
  onCustomize: () => void
  onReset: () => void
}): React.JSX.Element {
  if (isCustomized) {
    return (
      <button
        type="button"
        onClick={onReset}
        className={[
          'flex items-center gap-1 rounded-md px-2 py-1 text-xs',
          'text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        ].join(' ')}
        title="Supprimer la personnalisation et revenir au contenu commun"
      >
        <RotateCcw className="size-3" />
        <span className="hidden sm:inline">Réinitialiser</span>
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={onCustomize}
      className={[
        'flex items-center gap-1 rounded-md px-2 py-1 text-xs',
        'text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
      ].join(' ')}
      title="Personnaliser le contenu spécifiquement pour cette plateforme"
    >
      <Pencil className="size-3" />
      <span className="hidden sm:inline">Personnaliser</span>
    </button>
  )
}
