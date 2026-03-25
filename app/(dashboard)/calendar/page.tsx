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
import type { PostStatus } from '@/modules/posts/types'

// ─── Métadonnées ──────────────────────────────────────────────────────────────

export const metadata: Metadata = {
  title: 'Calendrier — ogolong',
  description: 'Visualisez et planifiez vos publications sur le calendrier.',
}

// ─── Page ─────────────────────────────────────────────────────────────────────

/**
 * Page Calendrier — Server Component.
 * Vérifie l'authentification, extrait les filtres URL, délègue à CalendarContent (Client).
 */
export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}): Promise<React.JSX.Element> {
  // ── Authentification ───────────────────────────────────────────────────────
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) redirect('/login')

  // ── Extraction des filtres URL (Server Component → props) ─────────────────
  // Exemple : /calendar?status=FAILED → initialStatuses=['FAILED']
  const params = await searchParams
  const VALID_STATUSES: PostStatus[] = ['DRAFT', 'SCHEDULED', 'PUBLISHED', 'PARTIAL', 'FAILED']
  const rawStatuses = Array.isArray(params.status) ? params.status : params.status ? [params.status] : []
  const initialStatuses = rawStatuses.filter((s): s is PostStatus =>
    VALID_STATUSES.includes(s as PostStatus),
  )

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
      <CalendarContent initialStatuses={initialStatuses} />
    </div>
  )
}
