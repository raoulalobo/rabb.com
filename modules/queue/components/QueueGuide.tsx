/**
 * @file modules/queue/components/QueueGuide.tsx
 * @module queue
 * @description Bandeau explicatif "Comment ça marche" fermable.
 *   Persiste la fermeture en localStorage pour ne pas réapparaître.
 *   L'utilisateur peut le réafficher en vidant son localStorage.
 *
 * @example
 *   <QueueGuide />
 */

'use client'

import { useEffect, useState } from 'react'

import { CalendarClock, Clock, Layers, X, Zap } from 'lucide-react'

// ─── Constantes ──────────────────────────────────────────────────────────────

/** Clé localStorage pour persister la fermeture */
const STORAGE_KEY = 'ogolong_queue_guide_dismissed'

// ─── Composant ────────────────────────────────────────────────────────────────

/**
 * Bandeau explicatif en 3 étapes + astuce.
 * Fermable avec un bouton ×, la fermeture est persistée en localStorage.
 */
export function QueueGuide(): React.JSX.Element | null {
  const [dismissed, setDismissed] = useState(true) // true par défaut pour éviter le flash

  // Lire localStorage au mount (côté client uniquement)
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    setDismissed(stored === 'true')
  }, [])

  const handleDismiss = (): void => {
    setDismissed(true)
    localStorage.setItem(STORAGE_KEY, 'true')
  }

  if (dismissed) return null

  return (
    <div className="relative rounded-lg border bg-muted/30 p-4 space-y-4">
      {/* Bouton fermer */}
      <button
        type="button"
        onClick={handleDismiss}
        className="absolute right-3 top-3 rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label="Fermer le guide"
      >
        <X className="size-4" />
      </button>

      <h2 className="text-sm font-semibold text-foreground pr-8">
        Comment ça marche ?
      </h2>

      <div className="grid gap-3 sm:grid-cols-3">
        {/* Étape 1 */}
        <div className="flex gap-3">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <CalendarClock className="size-4" />
          </div>
          <div>
            <p className="text-sm font-medium">1. Créez vos créneaux</p>
            <p className="text-xs text-muted-foreground">
              Définissez les jours et heures où vous souhaitez publier chaque semaine.
            </p>
          </div>
        </div>

        {/* Étape 2 */}
        <div className="flex gap-3">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Layers className="size-4" />
          </div>
          <div>
            <p className="text-sm font-medium">2. Remplissez la file</p>
            <p className="text-xs text-muted-foreground">
              Créez vos posts comme d&apos;habitude. Au lieu de choisir une date, ajoutez-les à la file.
            </p>
          </div>
        </div>

        {/* Étape 3 */}
        <div className="flex gap-3">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Zap className="size-4" />
          </div>
          <div>
            <p className="text-sm font-medium">3. Publication automatique</p>
            <p className="text-xs text-muted-foreground">
              Vos posts sont programmés sur le prochain créneau libre. Plus besoin de choisir la date.
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-start gap-2 rounded-md bg-background/60 px-3 py-2">
        <Clock className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
        <p className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Astuce :</span> créez plusieurs créneaux par jour pour publier plus souvent. Vous pouvez aussi filtrer par plateforme.
        </p>
      </div>
    </div>
  )
}
