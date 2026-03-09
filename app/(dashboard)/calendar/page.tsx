/**
 * @file app/(dashboard)/calendar/page.tsx
 * @description Page Calendrier — vue mensuelle des posts planifiés.
 *
 *   Permet à l'utilisateur de :
 *   - Visualiser ses posts planifiés par jour dans une grille mensuelle
 *   - Cliquer sur n'importe quel jour pour créer un nouveau post
 *     (Dialog PostComposer pré-rempli avec la date sélectionnée)
 *
 *   Architecture :
 *   - page.tsx          : Server Component (auth + métadonnées)
 *   - CalendarContent   : Client Component (CalendarGrid + Dialog + PostComposer)
 *
 * @example
 *   // Route : GET /calendar
 */

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

import { auth } from '@/lib/auth'
import { CalendarContent } from '@/modules/posts/components/CalendarView/CalendarContent'

import type { Metadata } from 'next'

// ─── Métadonnées ──────────────────────────────────────────────────────────────

export const metadata: Metadata = {
  title: 'Calendrier — ogolong',
  description: 'Visualisez et planifiez vos publications sur le calendrier.',
}

// ─── Page ─────────────────────────────────────────────────────────────────────

/**
 * Page Calendrier — Server Component.
 * Vérifie l'authentification, puis délègue le rendu à CalendarContent (Client).
 */
export default async function CalendarPage(): Promise<React.JSX.Element> {
  // ── Authentification ───────────────────────────────────────────────────────
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) redirect('/login')

  return (
    <div className="space-y-6">
      {/* ── En-tête ────────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Calendrier</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Cliquez sur un jour pour planifier un nouveau post.
        </p>
      </div>

      {/* ── Contenu principal (Client Component) ─────────────────────── */}
      {/*
       * CalendarContent orchestre :
       * - CalendarGrid  : grille mensuelle cliquable
       * - Dialog        : modal PostComposer pré-rempli avec la date sélectionnée
       */}
      <CalendarContent />
    </div>
  )
}
