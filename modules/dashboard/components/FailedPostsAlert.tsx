/**
 * @file modules/dashboard/components/FailedPostsAlert.tsx
 * @module dashboard
 * @description Bannière d'alerte conditionnelle affichée sur le dashboard.
 *
 *   Visible uniquement lorsque l'utilisateur a des posts avec le statut FAILED
 *   (erreur de publication). Dans ce cas, affiche un bandeau rouge avec le nombre
 *   de posts en erreur et un lien vers /calendar?status=FAILED pour corriger.
 *
 *   Comportement :
 *   - isLoading → rien affiché (invisible, le layout ne bouge pas)
 *   - postsFailed === 0 → rien affiché
 *   - postsFailed > 0 → bannière rouge avec count + lien
 *
 * @example
 *   // Dans la page /dashboard, au-dessus des cartes KPI :
 *   <FailedPostsAlert />
 */

'use client'

import Link from 'next/link'

import { useDashboardStats } from '@/modules/dashboard/hooks/useDashboardStats'

// ─── Composant ────────────────────────────────────────────────────────────────

/**
 * Bannière d'alerte pour les posts en erreur de publication.
 *
 * Ne rend rien si aucun post n'est en erreur (invisible, pas d'espace réservé).
 * Utilise les données déjà chargées par useDashboardStats — pas de requête supplémentaire.
 *
 * @returns Bannière rouge si postsFailed > 0, null sinon
 *
 * @example
 *   <FailedPostsAlert />
 *   // → null si 0 posts FAILED
 *   // → bannière rouge "2 posts en erreur de publication" si postsFailed = 2
 */
export function FailedPostsAlert(): React.JSX.Element | null {
  const { data, isLoading } = useDashboardStats()

  // Pendant le chargement ou si aucun post échoué : invisible (pas d'espace réservé)
  if (isLoading || !data || data.postsFailed === 0) return null

  const count = data.postsFailed
  // Pluralisation du message : "1 post" vs "2 posts"
  const label = count === 1 ? 'post en erreur de publication' : 'posts en erreur de publication'

  return (
    <div
      role="alert"
      className="flex items-center justify-between gap-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 dark:border-red-800 dark:bg-red-950/30"
    >
      {/* Icône + texte d'alerte */}
      <div className="flex items-center gap-2 text-sm text-red-700 dark:text-red-400">
        {/* Icône triangle d'avertissement */}
        <svg
          className="size-4 shrink-0"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
          <path d="M12 9v4" />
          <path d="M12 17h.01" />
        </svg>
        {/* Nombre de posts + libellé pluralisé */}
        <span>
          <strong>{count}</strong> {label}
        </span>
      </div>

      {/* Lien vers le calendrier filtré sur les posts FAILED pour corriger */}
      <Link
        href="/calendar?status=FAILED"
        className="shrink-0 text-sm font-medium text-red-700 underline-offset-2 hover:underline dark:text-red-400"
      >
        Voir et corriger →
      </Link>
    </div>
  )
}
