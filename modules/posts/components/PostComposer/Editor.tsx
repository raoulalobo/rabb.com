/**
 * @file modules/posts/components/PostComposer/Editor.tsx
 * @module posts
 * @description Zone de saisie du texte du post avec compteur de caractères.
 *   Depuis la Phase 4 (onglets par plateforme) :
 *   - Le texte affiché est `activeText` (base ou override selon l'onglet actif)
 *   - La limite de caractères dépend de l'onglet :
 *     - Onglet "Tous" → limite min de toutes les plateformes sélectionnées
 *     - Onglet plateforme → PLATFORM_RULES[platform].maxText
 *   - Une info-ligne affiche les règles de la plateforme active
 *
 *   Interaction avec le contexte :
 *   - Lit : activeText, activePlatformTab, platforms, isSubmitting
 *   - Écrit : setActiveText
 *
 * @example
 *   <PostComposer>
 *     <PostComposer.Editor placeholder="Quoi de neuf aujourd'hui ?" />
 *   </PostComposer>
 */

'use client'

import { useCallback } from 'react'

import { PLATFORM_RULES } from '@/modules/platforms/config/platform-rules'
import type { Platform } from '@/modules/platforms/types'
import { getCharLimit } from '@/modules/posts/schemas/post.schema'

import { usePostComposerContext } from './context'

// ─── Props ────────────────────────────────────────────────────────────────────

interface EditorProps {
  /** Texte affiché quand le champ est vide */
  placeholder?: string
  /** Nombre de lignes minimales de la textarea */
  rows?: number
}

// ─── Composant ────────────────────────────────────────────────────────────────

/**
 * Zone de texte principale du PostComposer.
 * S'adapte à l'onglet actif : affiche et modifie le contenu de base ou l'override
 * de la plateforme sélectionnée.
 *
 * @param placeholder - Texte d'invite (défaut: "Rédigez votre post...")
 * @param rows - Nombre de lignes minimales (défaut: 6)
 */
export function Editor({
  placeholder = 'Rédigez votre post...',
  rows = 6,
}: EditorProps): React.JSX.Element {
  const { activeText, setActiveText, platforms, activePlatformTab, isSubmitting } =
    usePostComposerContext()

  // ─── Limite de caractères selon l'onglet actif ──────────────────────────────
  // Onglet "Tous" → limite la plus restrictive des plateformes sélectionnées
  // Onglet plateforme → limite spécifique à cette plateforme
  const charLimit = computeCharLimit(activePlatformTab, platforms)
  const charCount = activeText.length
  const remaining = charLimit - charCount
  const isOverLimit = remaining < 0
  const isNearLimit = remaining >= 0 && remaining <= charLimit * 0.1

  /**
   * Handler de changement de texte.
   * Mémoïsé pour éviter les re-renders inutiles de la textarea.
   */
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setActiveText(e.target.value)
    },
    [setActiveText],
  )

  // ─── Message d'info de la plateforme active ─────────────────────────────────
  // Affiché sous l'éditeur quand on est sur un onglet plateforme spécifique
  const platformInfo = activePlatformTab
    ? getPlatformInfoText(activePlatformTab)
    : null

  return (
    <div className="relative">
      {/* Zone de texte principale */}
      <textarea
        value={activeText}
        onChange={handleChange}
        placeholder={placeholder}
        rows={rows}
        disabled={isSubmitting}
        className={[
          'w-full resize-none rounded-none border-0 bg-transparent p-0',
          'text-sm leading-relaxed text-foreground',
          'placeholder:text-muted-foreground/60',
          'focus:outline-none focus:ring-0',
          'disabled:cursor-not-allowed disabled:opacity-50',
          isOverLimit ? 'caret-destructive' : '',
        ].join(' ')}
        aria-label="Texte du post"
        aria-describedby="char-counter"
      />

      {/* Info-ligne des règles de la plateforme active */}
      {platformInfo && (
        <p className="mt-1 text-[11px] text-muted-foreground/70" aria-live="polite">
          {platformInfo}
        </p>
      )}

      {/* Compteur de caractères */}
      <div
        id="char-counter"
        className="flex items-center justify-end gap-2 pt-2"
        aria-live="polite"
        aria-label={`${charCount} caractères sur ${charLimit} autorisés`}
      >
        {/* Barre de progression circulaire légère */}
        <CharProgressRing current={charCount} limit={charLimit} />

        {/* Texte du compteur */}
        <span
          className={[
            'text-xs tabular-nums transition-colors',
            isOverLimit
              ? 'font-semibold text-destructive'
              : isNearLimit
                ? 'text-amber-500'
                : 'text-muted-foreground',
          ].join(' ')}
        >
          {isOverLimit ? `−${Math.abs(remaining)}` : remaining}
        </span>
      </div>
    </div>
  )
}

// ─── Fonctions utilitaires internes ──────────────────────────────────────────

/**
 * Calcule la limite de caractères selon l'onglet actif.
 * - Onglet "Tous" (null) → limite min parmi les plateformes sélectionnées
 * - Onglet plateforme → PLATFORM_RULES[platform].maxText
 *
 * @param activePlatformTab - Onglet actif (null = "Tous")
 * @param platforms - Plateformes sélectionnées dans le brouillon
 * @returns Nombre max de caractères autorisés
 *
 * @example
 *   computeCharLimit(null, ['instagram', 'twitter']) // 280 (min = twitter)
 *   computeCharLimit('twitter', ['instagram', 'twitter']) // 280
 *   computeCharLimit('instagram', ['instagram', 'twitter']) // 2200
 */
function computeCharLimit(activePlatformTab: Platform | null, platforms: string[]): number {
  if (activePlatformTab === null) {
    // Onglet "Tous" : limite la plus restrictive parmi les plateformes sélectionnées
    return platforms.length > 0 ? Math.min(...platforms.map((p) => getCharLimit(p))) : 63206
  }
  // Onglet plateforme : limite spécifique depuis les règles de la plateforme
  return PLATFORM_RULES[activePlatformTab].maxText
}

/**
 * Génère une ligne d'information sur les règles d'une plateforme.
 * Affichée sous l'éditeur quand on est sur un onglet plateforme.
 *
 * @param platform - Plateforme active
 * @returns Texte d'info ou null
 *
 * @example
 *   getPlatformInfoText('instagram') // "Max 2 200 caractères · Max 10 photos · 1 vidéo"
 *   getPlatformInfoText('youtube') // "Max 5 000 caractères · Vidéo requise"
 */
function getPlatformInfoText(platform: Platform): string {
  const rules = PLATFORM_RULES[platform]
  const parts: string[] = []

  // Limite de texte
  parts.push(`Max ${rules.maxText.toLocaleString('fr-FR')} car.`)

  // Limite de photos (si autorisées)
  if (rules.maxPhotos > 0) {
    parts.push(`${rules.maxPhotos} photo${rules.maxPhotos > 1 ? 's' : ''} max`)
  } else if (rules.maxVideos > 0 && rules.maxPhotos === 0) {
    // Pas de photos (ex: YouTube)
    parts.push('photos non supportées')
  }

  // Limite de vidéos (si autorisées)
  if (rules.maxVideos > 0) {
    parts.push(`${rules.maxVideos} vidéo${rules.maxVideos > 1 ? 's' : ''} max`)
  } else {
    parts.push('vidéo non supportée')
  }

  // Média requis (ex: YouTube)
  if (rules.requiresMedia) {
    parts.push('média requis')
  }

  return parts.join(' · ')
}

// ─── Sous-composant interne : anneau de progression ──────────────────────────

/**
 * Anneau SVG affichant la progression des caractères utilisés.
 * Passe du vert → orange → rouge selon le remplissage.
 *
 * @param current - Nombre de caractères saisis
 * @param limit - Limite maximale
 */
function CharProgressRing({
  current,
  limit,
}: {
  current: number
  limit: number
}): React.JSX.Element {
  const SIZE = 20
  const STROKE = 2.5
  const RADIUS = (SIZE - STROKE) / 2
  const CIRCUMFERENCE = 2 * Math.PI * RADIUS
  // Clamp entre 0 et 1 pour le remplissage visuel
  const progress = Math.min(current / limit, 1)
  const offset = CIRCUMFERENCE * (1 - progress)

  // Couleur selon le niveau de remplissage
  const color =
    current > limit
      ? 'var(--destructive)'
      : progress >= 0.9
        ? 'rgb(245, 158, 11)' // amber-500
        : 'var(--primary)'

  return (
    <svg
      width={SIZE}
      height={SIZE}
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      className="rotate-[-90deg]"
      aria-hidden="true"
    >
      {/* Piste de fond */}
      <circle
        cx={SIZE / 2}
        cy={SIZE / 2}
        r={RADIUS}
        fill="none"
        stroke="currentColor"
        strokeWidth={STROKE}
        className="text-muted/30"
      />
      {/* Progression */}
      <circle
        cx={SIZE / 2}
        cy={SIZE / 2}
        r={RADIUS}
        fill="none"
        stroke={color}
        strokeWidth={STROKE}
        strokeDasharray={CIRCUMFERENCE}
        strokeDashoffset={offset}
        strokeLinecap="round"
        className="transition-all duration-200"
      />
    </svg>
  )
}
