/**
 * @file app/(dashboard)/settings/SpeechSettings.tsx
 * @description Composant Client pour les préférences de dictée vocale.
 *   Affiche un slider permettant de régler le délai de silence avant arrêt
 *   automatique du micro (1s à 10s, défaut 5s).
 *
 *   La valeur est lue et écrite dans `useAppStore` (Zustand) avec persistance
 *   automatique dans localStorage via le middleware `persist`.
 *
 * @example
 *   // Dans settings/page.tsx (Server Component) :
 *   <SpeechSettings />
 */

'use client'

import { Mic } from 'lucide-react'

import { useAppStore } from '@/store/app.store'

// ─── Constantes ───────────────────────────────────────────────────────────────

/** Valeur minimale du slider en ms */
const MIN_MS = 1000
/** Valeur maximale du slider en ms */
const MAX_MS = 10000
/** Pas du slider en ms */
const STEP_MS = 1000

// ─── Composant ────────────────────────────────────────────────────────────────

/**
 * Section de réglage de la dictée vocale dans /settings.
 * Lit et écrit `speechSilenceTimeoutMs` dans le store global (persisté).
 */
export function SpeechSettings(): React.JSX.Element {
  const speechSilenceTimeoutMs = useAppStore((s) => s.speechSilenceTimeoutMs)
  const setSpeechSilenceTimeout = useAppStore((s) => s.setSpeechSilenceTimeout)

  /** Valeur en secondes pour l'affichage */
  const seconds = speechSilenceTimeoutMs / 1000

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-5">
      {/* ── En-tête ── */}
      <div className="flex items-start gap-3">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Mic className="size-4" />
        </div>
        <div>
          <p className="text-sm font-medium leading-none">Silence avant arrêt du micro</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Durée de silence après laquelle la dictée s'arrête automatiquement.
            Plus la valeur est élevée, plus tu peux faire des pauses en parlant.
          </p>
        </div>
        {/* Valeur actuelle en grand — feedback immédiat pendant le glissement */}
        <div className="ml-auto shrink-0 text-right">
          <span className="text-2xl font-bold tabular-nums text-foreground">{seconds}</span>
          <span className="ml-1 text-sm text-muted-foreground">s</span>
        </div>
      </div>

      {/* ── Slider ── */}
      <div className="space-y-2">
        <input
          type="range"
          min={MIN_MS}
          max={MAX_MS}
          step={STEP_MS}
          value={speechSilenceTimeoutMs}
          onChange={(e) => setSpeechSilenceTimeout(Number(e.target.value))}
          aria-label="Délai de silence avant arrêt du micro"
          className={[
            'w-full h-2 rounded-full appearance-none cursor-pointer',
            'bg-muted accent-primary',
            // Thumb : taille uniforme sur tous les navigateurs
            '[&::-webkit-slider-thumb]:appearance-none',
            '[&::-webkit-slider-thumb]:size-4',
            '[&::-webkit-slider-thumb]:rounded-full',
            '[&::-webkit-slider-thumb]:bg-primary',
            '[&::-webkit-slider-thumb]:cursor-pointer',
            '[&::-moz-range-thumb]:size-4',
            '[&::-moz-range-thumb]:rounded-full',
            '[&::-moz-range-thumb]:bg-primary',
            '[&::-moz-range-thumb]:border-0',
            '[&::-moz-range-thumb]:cursor-pointer',
          ].join(' ')}
        />

        {/* Étiquettes min / max */}
        <div className="flex justify-between text-[11px] text-muted-foreground select-none">
          <span>{MIN_MS / 1000}s</span>
          <span>{MAX_MS / 1000}s</span>
        </div>
      </div>

      {/* ── Boutons de raccourci ── */}
      <div className="flex flex-wrap gap-2">
        {[2, 3, 5, 7, 10].map((s) => {
          const ms = s * 1000
          const isActive = speechSilenceTimeoutMs === ms
          return (
            <button
              key={s}
              type="button"
              onClick={() => setSpeechSilenceTimeout(ms)}
              className={[
                'rounded-md border px-3 py-1 text-xs font-medium transition-colors',
                isActive
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground',
              ].join(' ')}
              aria-pressed={isActive}
            >
              {s}s
            </button>
          )
        })}
      </div>
    </div>
  )
}
