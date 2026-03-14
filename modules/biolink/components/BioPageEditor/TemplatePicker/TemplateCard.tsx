/**
 * @file modules/biolink/components/BioPageEditor/TemplatePicker/TemplateCard.tsx
 * @module biolink
 * @description Mini-aperçu cliquable d'un template Bio Link (~100×70px).
 *   Rendu JSX pur (pas d'images) : fond du thème + barres simulant des boutons
 *   + petit cercle avatar. Le nom est affiché en dessous.
 *
 * @example
 *   <TemplateCard
 *     template={template}
 *     isActive={activeTemplateId === template.id}
 *     onClick={() => handleApplyTemplate(template)}
 *   />
 */

'use client'

import { cn } from '@/lib/utils'
import type { BioTemplate } from '@/modules/biolink/templates/types'

// ─── Correspondances thème → classes CSS de fond ────────────────────────────

/**
 * Map des thèmes de base vers les classes CSS de fond pour le mini-aperçu.
 * Simplifié : on utilise des couleurs de fond CSS directes pour la preview.
 */
const THEME_BG_CLASSES: Record<string, string> = {
  default: 'bg-white',
  dark: 'bg-zinc-900',
  gradient: '', // Le fond sera appliqué via style inline (gradientFrom/To)
  minimal: 'bg-stone-50',
  neon: 'bg-zinc-950',
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface TemplateCardProps {
  /** Le template à afficher en mini-aperçu */
  template: BioTemplate
  /** Le template est actuellement actif (sélectionné) */
  isActive: boolean
  /** Callback de clic pour appliquer le template */
  onClick: () => void
}

// ─── Composant ────────────────────────────────────────────────────────────────

/**
 * Carte mini-aperçu d'un template (~100×70px).
 * Affiche visuellement le thème : fond coloré/dégradé, barres de boutons,
 * cercle avatar. Ring primary si actif.
 *
 * @param template - Template à prévisualiser
 * @param isActive - Template actuellement sélectionné
 * @param onClick  - Handler de clic
 * @returns Carte cliquable avec mini-aperçu du template
 */
export function TemplateCard({
  template,
  isActive,
  onClick,
}: TemplateCardProps): React.JSX.Element {
  // Déterminer le fond : dégradé si gradientFrom/To, sinon classe du thème
  const hasGradient = template.gradientFrom && template.gradientTo
  const bgStyle = hasGradient
    ? {
        background: `linear-gradient(135deg, ${template.gradientFrom}, ${template.gradientTo})`,
      }
    : undefined

  // Classe CSS du fond (utilisée si pas de dégradé)
  const bgClass = hasGradient ? '' : THEME_BG_CLASSES[template.theme] ?? 'bg-white'

  // Forme des barres de boutons selon buttonShape
  const buttonRadiusClass =
    template.buttonShape === 'rounded-full'
      ? 'rounded-full'
      : template.buttonShape === 'rounded-none'
        ? 'rounded-none'
        : 'rounded-sm'

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group flex flex-col items-center gap-1.5 rounded-lg border-2 p-1.5 transition-all',
        isActive
          ? 'border-primary ring-2 ring-primary/20'
          : 'border-border hover:border-primary/50'
      )}
    >
      {/* Mini-aperçu du thème */}
      <div
        className={cn(
          'flex h-[70px] w-full flex-col items-center justify-center gap-1 rounded-md p-2',
          bgClass
        )}
        style={bgStyle}
      >
        {/* Cercle avatar */}
        <div
          className={cn(
            'size-4 shrink-0',
            template.avatarShape === 'circle'
              ? 'rounded-full'
              : template.avatarShape === 'square'
                ? 'rounded-none'
                : 'rounded-sm'
          )}
          style={{ backgroundColor: template.accentColor }}
        />

        {/* Barres simulant des boutons de liens */}
        {[0.75, 0.6, 0.5].map((width, i) => (
          <div
            key={i}
            className={cn('h-[5px] shrink-0', buttonRadiusClass)}
            style={{
              width: `${width * 100}%`,
              backgroundColor:
                template.buttonVariant === 'outline'
                  ? 'transparent'
                  : template.accentColor,
              border:
                template.buttonVariant === 'outline'
                  ? `1px solid ${template.accentColor}`
                  : 'none',
              boxShadow:
                template.buttonVariant === 'shadow'
                  ? `0 1px 2px ${template.accentColor}40`
                  : 'none',
            }}
          />
        ))}
      </div>

      {/* Nom du template */}
      <span className="line-clamp-1 text-[10px] font-medium text-muted-foreground group-hover:text-foreground">
        {template.name}
      </span>
    </button>
  )
}
