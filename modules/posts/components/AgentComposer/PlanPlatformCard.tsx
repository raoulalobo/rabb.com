/**
 * @file modules/posts/components/AgentComposer/PlanPlatformCard.tsx
 * @module posts
 * @description Carte de plan par plateforme dans l'AgentComposer.
 *
 *   Affiche et permet l'édition du plan Claude pour une plateforme spécifique :
 *   - Texte adapté (éditable)
 *   - Médias sélectionnés (aperçu + possibilité de retirer)
 *   - Date de planification (si définie par l'agent)
 *   - Rationale de l'agent (explications des choix, non éditable)
 *   - Indicateurs de violation des règles de la plateforme
 *
 *   L'utilisateur peut :
 *   ✅ Modifier le texte pour le personnaliser
 *   ✅ Retirer des médias qu'il ne souhaite pas
 *   ✅ Changer la date/heure de planification
 *   ✗ Ajouter des médias (le pool reste la source — via l'agent uniquement)
 *
 * @example
 *   <PlanPlatformCard
 *     platformPlan={plan.platforms[0]}
 *     onChange={(updated) => updatePlatformPlan(0, updated)}
 *   />
 */

'use client'

import { AlertTriangle, Calendar, Check, ChevronDown, ChevronUp, Info, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'

import { PlatformIcon } from '@/modules/platforms/components/PlatformIcon'
import { PLATFORM_RULES, getPlatformViolations } from '@/modules/platforms/config/platform-rules'
import { PLATFORM_CONFIG } from '@/modules/platforms/constants'
import type { PlatformPlan } from '@/modules/posts/types'

// ─── Props ────────────────────────────────────────────────────────────────────

interface PlanPlatformCardProps {
  /** Plan pour cette plateforme (produit par Claude, potentiellement modifié) */
  platformPlan: PlatformPlan
  /** Callback mis à jour à chaque modification de l'utilisateur */
  onChange: (updated: PlatformPlan) => void
  /**
   * Callback déclenché quand l'utilisateur retire cette plateforme du plan.
   * Si absent, le bouton de retrait n'est pas affiché.
   */
  onRemove?: () => void
  /** Désactiver les modifications (pendant la soumission) */
  disabled?: boolean
}

// ─── Composant ────────────────────────────────────────────────────────────────

/**
 * Carte éditable pour le plan d'une plateforme spécifique.
 * Affiche le texte, les médias et la date avec des indicateurs de validation.
 */
export function PlanPlatformCard({
  platformPlan,
  onChange,
  onRemove,
  disabled = false,
}: PlanPlatformCardProps): React.JSX.Element {
  // Repli du rationale (explication de l'agent) pour ne pas encombrer l'UI
  const [rationaleOpen, setRationaleOpen] = useState(false)

  const config = PLATFORM_CONFIG[platformPlan.platform as keyof typeof PLATFORM_CONFIG]
  const rules = PLATFORM_RULES[platformPlan.platform as keyof typeof PLATFORM_RULES]

  // Calcul mémoïsé des violations (évite de recréer le tableau à chaque rendu)
  // On cast en Platform car platformPlan.platform est string mais getPlatformViolations attend Platform
  const violations = useMemo(
    () =>
      rules
        ? getPlatformViolations(
            platformPlan.platform as Parameters<typeof getPlatformViolations>[0],
            platformPlan.text,
            platformPlan.mediaUrls,
          )
        : [],
    [rules, platformPlan.platform, platformPlan.text, platformPlan.mediaUrls],
  )

  const hasViolations = violations.length > 0

  // ─── Toasts Sonner pour les violations ──────────────────────────────────────

  // Référence sur les violations précédentes pour ne déclencher le toast
  // que sur les NOUVELLES violations (pas au premier rendu ni sur les violations existantes)
  const prevViolationTypesRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    const prevTypes = prevViolationTypesRef.current
    const currentTypes = new Set(violations.map((v) => v.type))

    // Trouver les violations qui viennent d'apparaître (absent du rendu précédent)
    for (const violation of violations) {
      if (!prevTypes.has(violation.type)) {
        const platformLabel = config?.label ?? platformPlan.platform

        // Message personnalisé selon le type de violation
        if (violation.type === 'mixed_not_allowed') {
          const hasVideo = /\.(mp4|mov|avi|webm|mkv|m4v)$/i.test(platformPlan.mediaUrls.join(' '))
          toast.warning(
            `Attention ${platformLabel} : impossible de mixer vidéo et photos dans le même post. ` +
            (hasVideo
              ? 'Retirez les photos ou la vidéo pour respecter les contraintes de la plateforme.'
              : 'Retirez la vidéo ou les photos.'),
            { duration: 8000 },
          )
        } else if (violation.type === 'text_too_long') {
          toast.warning(
            `Le texte dépasse la limite ${platformLabel} (${violation.message}). ` +
            `Raccourcissez-le avant de publier.`,
            { duration: 6000 },
          )
        } else if (violation.type === 'too_many_photos' || violation.type === 'too_many_videos') {
          toast.warning(
            `${platformLabel} : ${violation.message}. Retirez des médias en excès.`,
            { duration: 6000 },
          )
        }
      }
    }

    // Mettre à jour la référence pour le prochain rendu
    prevViolationTypesRef.current = currentTypes
  }, [violations, config?.label, platformPlan.platform, platformPlan.mediaUrls])

  /**
   * Met à jour le texte du plan pour cette plateforme.
   */
  const handleTextChange = (text: string): void => {
    onChange({ ...platformPlan, text })
  }

  /**
   * Retire un média du plan de cette plateforme (par son URL).
   */
  const handleRemoveMedia = (urlToRemove: string): void => {
    onChange({
      ...platformPlan,
      mediaUrls: platformPlan.mediaUrls.filter((url) => url !== urlToRemove),
    })
  }

  /**
   * Met à jour la date de planification (ISO string ou null).
   * La valeur de l'input datetime-local est en heure locale → convertie en UTC.
   */
  const handleScheduledForChange = (localDatetime: string): void => {
    if (!localDatetime) {
      onChange({ ...platformPlan, scheduledFor: null })
      return
    }
    // L'input datetime-local retourne "YYYY-MM-DDTHH:MM" en heure locale
    const utcDate = new Date(localDatetime).toISOString()
    onChange({ ...platformPlan, scheduledFor: utcDate })
  }

  // Valeur de l'input datetime-local (heure locale depuis ISO UTC)
  const scheduledForLocal = platformPlan.scheduledFor
    ? new Date(platformPlan.scheduledFor).toISOString().slice(0, 16)
    : ''

  // Valeur min de l'input = maintenant (pas de planification dans le passé)
  const minDatetime = new Date().toISOString().slice(0, 16)

  return (
    <div
      className={[
        'overflow-hidden rounded-xl border bg-card shadow-sm transition-all',
        hasViolations ? 'border-amber-300' : 'border-border',
      ].join(' ')}
    >
      {/* ── En-tête : plateforme + indicateur de validation ──────────────── */}
      <div
        className="flex items-center gap-3 px-4 py-3"
        style={{ backgroundColor: config?.bgColor ?? '#F9FAFB' }}
      >
        {/* Icône + nom de la plateforme */}
        <div className="flex items-center gap-2">
          <PlatformIcon
            platform={platformPlan.platform as Parameters<typeof PlatformIcon>[0]['platform']}
            className="size-5"
          />
          <span className="text-sm font-semibold" style={{ color: config?.color }}>
            {config?.label ?? platformPlan.platform}
          </span>
        </div>

        {/* Badge des règles clés */}
        {rules && (
          <span className="ml-auto text-xs text-muted-foreground">
            {rules.maxText.toLocaleString('fr-FR')} car. max
            {rules.maxPhotos > 0 && ` · ${rules.maxPhotos} photo${rules.maxPhotos > 1 ? 's' : ''} max`}
            {rules.maxVideos > 0 && ` · ${rules.maxVideos} vidéo max`}
          </span>
        )}

        {/* Indicateur de validation */}
        {hasViolations ? (
          <AlertTriangle className="size-4 shrink-0 text-amber-500" />
        ) : (
          <Check className="size-4 shrink-0 text-green-500" />
        )}

        {/* Bouton retrait de la plateforme du plan.
            Ne touche PAS le fil de conversation (chatHistory) — retire uniquement
            cette entrée de plan.platforms via le callback onRemove du parent. */}
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            disabled={disabled}
            title={`Retirer ${config?.label ?? platformPlan.platform} du plan`}
            className={[
              'ml-1 rounded p-1 text-muted-foreground/60 transition-colors',
              'hover:bg-destructive/10 hover:text-destructive',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              'disabled:cursor-not-allowed disabled:opacity-40',
            ].join(' ')}
            aria-label={`Retirer ${config?.label ?? platformPlan.platform} du plan`}
          >
            <Trash2 className="size-3.5" />
          </button>
        )}
      </div>

      {/* ── Corps : texte + médias + planification ──────────────────────── */}
      <div className="space-y-4 px-4 py-4">
        {/* Éditeur de texte */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-muted-foreground">
              Texte
            </label>
            {/* Compteur de caractères avec couleur si dépassement */}
            <span
              className={[
                'text-xs tabular-nums',
                rules && platformPlan.text.length > rules.maxText
                  ? 'font-medium text-destructive'
                  : 'text-muted-foreground',
              ].join(' ')}
            >
              {platformPlan.text.length.toLocaleString('fr-FR')}
              {rules && ` / ${rules.maxText.toLocaleString('fr-FR')}`}
            </span>
          </div>
          <textarea
            value={platformPlan.text}
            onChange={(e) => handleTextChange(e.target.value)}
            disabled={disabled}
            rows={5}
            className={[
              'w-full resize-y rounded-lg border border-input bg-background px-3 py-2.5',
              'text-sm leading-relaxed placeholder:text-muted-foreground',
              'transition-colors focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30',
              'disabled:cursor-not-allowed disabled:opacity-50',
              rules && platformPlan.text.length > rules.maxText ? 'border-destructive' : '',
            ].join(' ')}
            aria-label={`Texte pour ${config?.label ?? platformPlan.platform}`}
          />
        </div>

        {/* Aperçu des médias sélectionnés pour cette plateforme */}
        {platformPlan.mediaUrls.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">
              Médias sélectionnés ({platformPlan.mediaUrls.length})
            </p>
            <div className="flex flex-wrap gap-2">
              {platformPlan.mediaUrls.map((url) => (
                <MediaPreviewItem
                  key={url}
                  url={url}
                  onRemove={() => handleRemoveMedia(url)}
                  disabled={disabled}
                />
              ))}
            </div>
          </div>
        )}

        {/* Date de planification */}
        <div className="space-y-1.5">
          <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Calendar className="size-3.5" />
            Date de publication
          </label>
          <input
            type="datetime-local"
            value={scheduledForLocal}
            min={minDatetime}
            onChange={(e) => handleScheduledForChange(e.target.value)}
            disabled={disabled}
            className={[
              'w-full rounded-lg border border-input bg-background px-3 py-2',
              'text-sm text-foreground',
              'transition-colors focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30',
              'disabled:cursor-not-allowed disabled:opacity-50',
            ].join(' ')}
            aria-label={`Date de publication pour ${config?.label ?? platformPlan.platform}`}
          />
          {!scheduledForLocal && (
            <p className="text-xs text-muted-foreground">
              Vide = publication immédiate
            </p>
          )}
        </div>

        {/* Rationale de l'agent (repliable) */}
        {platformPlan.rationale && (
          <div>
            <button
              type="button"
              onClick={() => setRationaleOpen((prev) => !prev)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              <Info className="size-3.5" />
              <span>Explication de l&apos;agent</span>
              {rationaleOpen ? (
                <ChevronUp className="size-3.5" />
              ) : (
                <ChevronDown className="size-3.5" />
              )}
            </button>
            {rationaleOpen && (
              <p className="mt-1.5 rounded-lg bg-muted/50 px-3 py-2 text-xs italic text-muted-foreground">
                {platformPlan.rationale}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Sous-composant : aperçu d'un média ──────────────────────────────────────

/**
 * Miniature d'un média sélectionné par l'agent pour cette plateforme.
 * L'utilisateur peut le retirer s'il ne convient pas.
 */
function MediaPreviewItem({
  url,
  onRemove,
  disabled,
}: {
  url: string
  onRemove: () => void
  disabled: boolean
}): React.JSX.Element {
  const isVideo = /\.(mp4|mov|webm|avi)$/i.test(url)

  return (
    <div className="group relative size-16 overflow-hidden rounded-lg border border-border">
      {isVideo ? (
        <video src={url} className="size-full object-cover" muted />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="Média du plan" className="size-full object-cover" />
      )}

      {/* Bouton de retrait au survol */}
      <button
        type="button"
        onClick={onRemove}
        disabled={disabled}
        className={[
          'absolute inset-0 flex items-center justify-center bg-black/50',
          'opacity-0 transition-opacity group-hover:opacity-100',
          'disabled:cursor-not-allowed',
        ].join(' ')}
        aria-label="Retirer ce média du plan"
      >
        <span className="text-white text-lg">×</span>
      </button>
    </div>
  )
}
