/**
 * @file app/(dashboard)/queue/page.tsx
 * @description Page File d'attente — Server Component.
 *
 *   Affiche la grille de créneaux horaires récurrents (7 jours de la semaine).
 *   L'utilisateur peut créer, modifier, activer/désactiver et supprimer des créneaux.
 *   Les créneaux définissent les horaires récurrents pour la publication automatique.
 *
 *   Route : /queue (protégée par le layout du dashboard)
 *
 * @example
 *   // Accessible via : http://localhost:3000/queue
 */

import { CalendarClock, Clock, Layers, Zap } from 'lucide-react'

import { QueueGrid } from '@/modules/queue/components/QueueGrid'

// ─── Métadonnées ─────────────────────────────────────────────────────────────

export const metadata = {
  title: "File d'attente — ogolong",
  description: 'Définissez vos créneaux horaires récurrents pour programmer automatiquement vos posts.',
}

// ─── Page ────────────────────────────────────────────────────────────────────

/**
 * Page principale de la file d'attente.
 * Affiche un en-tête explicatif et la grille QueueGrid (Client Component).
 *
 * @returns Page avec grille de créneaux 7 jours
 */
export default function QueuePage(): React.JSX.Element {
  return (
    <div className="space-y-6">
      {/* ── En-tête de la page ──────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">File d&apos;attente</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Définissez vos créneaux horaires récurrents. Les posts en attente seront
          automatiquement programmés sur ces créneaux.
        </p>
      </div>

      {/* ── Guide explicatif ─────────────────────────────────────────────── */}
      <div className="rounded-lg border bg-muted/30 p-4 space-y-4">
        <h2 className="text-sm font-semibold text-foreground">
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
                Définissez les jours et heures où vous souhaitez publier chaque semaine (ex : lundi 9h, mercredi 14h, vendredi 18h).
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
                Créez vos posts comme d&apos;habitude. Au lieu de choisir une date, ajoutez-les à la file d&apos;attente.
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
                Vos posts sont automatiquement programmés sur le prochain créneau libre. Plus besoin de choisir la date manuellement.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-start gap-2 rounded-md bg-background/60 px-3 py-2">
          <Clock className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Astuce :</span> créez plusieurs créneaux par jour pour publier plus souvent. Vous pouvez aussi filtrer par plateforme — un créneau Instagram et un créneau TikTok à des heures différentes.
          </p>
        </div>
      </div>

      {/* ── Grille de créneaux (Client Component) ────────────────────────── */}
      <QueueGrid />
    </div>
  )
}
