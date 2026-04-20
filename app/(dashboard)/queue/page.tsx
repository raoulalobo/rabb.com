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

import { QueueGrid } from '@/modules/queue/components/QueueGrid'
import { QueueGuide } from '@/modules/queue/components/QueueGuide'

// ─── Métadonnées ─────────────────────────────────────────────────────────────

export const metadata = {
  title: "File d'attente — SocialTDL",
  description: 'Définissez vos créneaux horaires récurrents pour programmer automatiquement vos posts.',
}

// ─── Page ────────────────────────────────────────────────────────────────────

/**
 * Page principale de la file d'attente.
 * Affiche un en-tête, le guide fermable, et la grille QueueGrid.
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

      {/* ── Guide explicatif (fermable, persisté en localStorage) ──────── */}
      <QueueGuide />

      {/* ── Grille de créneaux (Client Component) ────────────────────────── */}
      <QueueGrid />
    </div>
  )
}
