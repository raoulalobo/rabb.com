/**
 * @file modules/posts/components/FailureAlert.tsx
 * @module posts
 * @description Bandeau d'erreur réutilisable pour les posts FAILED.
 *   Affiche la raison de l'échec, un conseil actionnable, un lien interne
 *   (si applicable, ex: /settings) et un bouton "Replanifier" si le retry est possible.
 *
 *   Deux modes :
 *   - compact=false (défaut) : bandeau complet avec summary + advice + actions
 *   - compact=true           : summary seul (pour popover ou espaces restreints)
 *
 *   Utilise getFailureAdvice() pour analyser la failureReason par pattern-matching.
 *
 * @example
 *   // Bandeau complet dans un Dialog d'édition
 *   <FailureAlert failureReason="Compte tiktok déconnecté de Late" onRetry={handleRetry} />
 *
 * @example
 *   // Version compacte dans un Popover
 *   <FailureAlert failureReason="Token expired" compact />
 */

'use client'

import Link from 'next/link'

import { AlertTriangle, RefreshCw } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { getFailureAdvice } from '@/modules/posts/utils/failure-advice'

// ─── Props ────────────────────────────────────────────────────────────────────

interface FailureAlertProps {
  /** Raison de l'échec stockée en DB (failureReason du post) */
  failureReason: string
  /** Callback de replanification — affiche le bouton "Replanifier" si fourni */
  onRetry?: () => void
  /** true = affichage compact (summary seul, sans conseil ni actions) */
  compact?: boolean
}

// ─── Composant ────────────────────────────────────────────────────────────────

/**
 * Bandeau d'alerte rouge affichant la raison d'échec d'un post + conseil actionnable.
 *
 * @param failureReason - Chaîne d'erreur analysée par getFailureAdvice()
 * @param onRetry       - Si fourni et canRetry=true, affiche un bouton "Replanifier"
 * @param compact       - Si true, n'affiche que le summary (pour popover/chip)
 *
 * @returns Div stylisée rouge avec icône, texte et actions conditionnelles
 */
export function FailureAlert({
  failureReason,
  onRetry,
  compact = false,
}: FailureAlertProps): React.JSX.Element {
  // Analyse la failureReason et retourne summary + advice + actionLink + canRetry
  const advice = getFailureAdvice(failureReason)

  // ── Mode compact : summary seul ───────────────────────────────────────────
  if (compact) {
    return (
      <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 dark:border-red-800 dark:bg-red-950/30">
        <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-red-500" />
        <p className="text-xs text-red-700 dark:text-red-400">
          <span className="font-medium">{advice.summary}</span>
          {' — '}
          {advice.advice}
        </p>
      </div>
    )
  }

  // ── Mode complet : summary + advice + actions ─────────────────────────────
  return (
    <div
      role="alert"
      className="space-y-2 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-950/30"
    >
      {/* En-tête : icône + summary */}
      <div className="flex items-center gap-2">
        <AlertTriangle className="size-4 shrink-0 text-red-500" />
        <span className="text-sm font-semibold text-red-700 dark:text-red-400">
          {advice.summary}
        </span>
      </div>

      {/* Conseil actionnable */}
      <p className="text-sm text-red-600 dark:text-red-300">
        {advice.advice}
      </p>

      {/* Actions : lien interne + bouton retry (conditionnels) */}
      {(advice.actionLink || (advice.canRetry && onRetry)) && (
        <div className="flex items-center gap-2 pt-1">
          {/* Lien interne (ex: /settings pour reconnecter un compte) */}
          {advice.actionLink && advice.actionLabel && (
            <Button variant="outline" size="sm" asChild>
              <Link href={advice.actionLink}>{advice.actionLabel}</Link>
            </Button>
          )}

          {/* Bouton replanifier (visible si canRetry ET callback fourni) */}
          {advice.canRetry && onRetry && (
            <Button
              variant="destructive"
              size="sm"
              onClick={onRetry}
              className="gap-1.5"
            >
              <RefreshCw className="size-3.5" />
              Replanifier
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
