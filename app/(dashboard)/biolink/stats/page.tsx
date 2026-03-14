/**
 * @file app/(dashboard)/biolink/stats/page.tsx
 * @module biolink
 * @description Page de statistiques de la BioPage dans le dashboard.
 *   Server Component protégé par auth : charge la BioPage avec tous les liens
 *   et affiche les statistiques de clics sous forme de graphique + tableau.
 *
 *   Structure :
 *   - En-tête : titre + lien retour vers l'éditeur
 *   - 3 cartes métriques : total clics, nombre de liens, liens actifs
 *   - Graphique en barres horizontales (clics par lien)
 *   - Tableau détaillé (titre, URL, clics, % du total, statut)
 *
 * @example
 *   // Accessible via : /biolink/stats
 */

import { ArrowLeft, ExternalLink, Link2, MousePointerClick } from 'lucide-react'
import Link from 'next/link'

import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { getBioPage } from '@/modules/biolink/actions/biolink.action'
import { ClicksChart } from '@/modules/biolink/components/BioPageStats/ClicksChart'
import { LinkStatsTable } from '@/modules/biolink/components/BioPageStats/LinkStatsTable'

// ─── Page ─────────────────────────────────────────────────────────────────────

/**
 * Page /biolink/stats — statistiques de la page Bio Link.
 * Affiche un résumé des clics et un détail par lien.
 *
 * @returns Page de statistiques avec graphique + tableau
 */
export default async function BioLinkStatsPage(): Promise<React.JSX.Element> {
  const bioPage = await getBioPage()

  // Si pas de BioPage → redirection vers l'éditeur
  if (!bioPage) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Statistiques Bio Link</h1>
          <p className="text-sm text-muted-foreground">
            Créez d'abord votre page Bio Link pour voir les statistiques.
          </p>
        </div>
        <Link href="/biolink">
          <Button>Créer ma page Bio Link</Button>
        </Link>
      </div>
    )
  }

  // Calculer les métriques agrégées
  const totalClicks = bioPage.totalClicks
  const totalLinks = bioPage.links.length
  const activeLinks = bioPage.links.filter((l) => l.isActive).length
  // Lien le plus cliqué
  const topLink = bioPage.links.length > 0
    ? [...bioPage.links].sort((a, b) => b.clicks - a.clicks)[0]
    : null

  return (
    <div className="space-y-6">
      {/* ── En-tête ──────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Link href="/biolink">
            <Button variant="ghost" size="icon" className="size-8">
              <ArrowLeft className="size-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Statistiques</h1>
            <p className="text-sm text-muted-foreground">
              Performances de votre page Bio Link
              {bioPage.slug && (
                <span> · ogolong.com/u/{bioPage.slug}</span>
              )}
            </p>
          </div>
        </div>

        {/* Lien vers la page publique */}
        {bioPage.isPublished && bioPage.slug && (
          <a
            href={`/u/${bioPage.slug}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button variant="outline" size="sm">
              <ExternalLink className="size-4 mr-1" />
              Voir la page
            </Button>
          </a>
        )}
      </div>

      <Separator />

      {/* ── Cartes métriques ─────────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-3">
        {/* Total clics */}
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <MousePointerClick className="size-4" />
            <span className="text-xs font-medium">Total clics</span>
          </div>
          <p className="text-3xl font-bold tabular-nums">
            {totalClicks.toLocaleString('fr-FR')}
          </p>
        </div>

        {/* Nombre de liens */}
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Link2 className="size-4" />
            <span className="text-xs font-medium">Liens</span>
          </div>
          <p className="text-3xl font-bold tabular-nums">
            {activeLinks}
            <span className="text-base font-normal text-muted-foreground ml-1">
              / {totalLinks}
            </span>
          </p>
        </div>

        {/* Lien le plus cliqué */}
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <span className="text-xs font-medium">Meilleur lien</span>
          </div>
          {topLink && topLink.clicks > 0 ? (
            <div>
              <p className="text-sm font-semibold truncate">{topLink.title}</p>
              <p className="text-xs text-muted-foreground">
                {topLink.clicks.toLocaleString('fr-FR')} clics
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Aucun clic</p>
          )}
        </div>
      </div>

      {/* ── Graphique des clics ──────────────────────────────────────── */}
      <ClicksChart links={bioPage.links} />

      {/* ── Tableau détaillé ─────────────────────────────────────────── */}
      <LinkStatsTable links={bioPage.links} totalClicks={totalClicks} />
    </div>
  )
}
