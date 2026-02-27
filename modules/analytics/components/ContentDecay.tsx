/**
 * @file modules/analytics/components/ContentDecay.tsx
 * @module analytics
 * @description Affiche la décroissance de performance du contenu dans le temps.
 *   Barres de progression horizontales par fenêtre temporelle (1-2j, 2-7j, 7-30j).
 *   Chaque barre montre quel % de l'engagement total est atteint dans ce délai.
 *   Données : ContentDecayResponse via GET /v1/analytics/content-decay.
 *
 * @example
 *   <ContentDecay data={contentDecay} />
 */

'use client'

import type { ContentDecayResponse } from '@/modules/analytics/types'

// ─── Props ────────────────────────────────────────────────────────────────────

interface ContentDecayProps {
  data: ContentDecayResponse | undefined
}

// ─── Labels des buckets ───────────────────────────────────────────────────────

const BUCKET_LABELS: Record<string, string> = {
  '1-2d': '1-2j',
  '2-7d': '2-7j',
  '7-30d': '7-30j',
}

// ─── Composant ────────────────────────────────────────────────────────────────

/**
 * Barres de progression de la décroissance de contenu.
 * Montrent en combien de temps le contenu atteint son engagement maximal.
 */
export function ContentDecay({ data }: ContentDecayProps): React.JSX.Element {
  // Garde défensive : buckets peut être absent ou non-tableau
  const buckets = Array.isArray(data?.buckets) ? data.buckets : []

  if (buckets.length === 0) {
    return (
      <div className="flex h-16 items-center justify-center text-sm text-muted-foreground">
        Pas assez de données pour analyser la durée de vie du contenu
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {buckets.map((bucket, i) => (
        <div key={bucket.bucket ?? i} className="flex items-center gap-3">
          {/* Label de la fenêtre temporelle */}
          <span className="w-12 shrink-0 text-right text-xs text-muted-foreground">
            {BUCKET_LABELS[bucket.bucket] ?? bucket.bucket}
          </span>

          {/* Barre de progression */}
          <div className="h-5 flex-1 overflow-hidden rounded-md bg-muted/30">
            <div
              className="h-full rounded-md bg-sky-400 transition-all duration-700"
              style={{ width: `${bucket.percentage}%` }}
            />
          </div>

          {/* Pourcentage */}
          <span className="w-10 shrink-0 text-xs font-medium text-muted-foreground">
            {bucket.percentage}%
          </span>
        </div>
      ))}

      {/* Interprétation */}
      {buckets.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {(() => {
            const first = buckets[0]
            if (!first || first.percentage < 80) return null
            return (
              <span>
                💡 Votre contenu atteint <strong>{first.percentage}%</strong> de son
                engagement dans les <strong>{BUCKET_LABELS[first.bucket] ?? first.bucket}</strong>.
              </span>
            )
          })()}
        </p>
      )}
    </div>
  )
}
