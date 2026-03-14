/**
 * @file modules/biolink/components/BioPageStats/LinkStatsTable.tsx
 * @module biolink
 * @description Tableau détaillé des statistiques par lien de la BioPage.
 *   Affiche chaque lien avec son titre, URL, nombre de clics,
 *   pourcentage du total et statut (actif/inactif).
 *
 * @example
 *   <LinkStatsTable links={bioPage.links} totalClicks={bioPage.totalClicks} />
 */

'use client'

import { Badge } from '@/components/ui/badge'
import type { BioLink } from '@/modules/biolink/types'

// ─── Props ────────────────────────────────────────────────────────────────────

interface LinkStatsTableProps {
  /** Liste des liens avec leurs statistiques */
  links: BioLink[]
  /** Nombre total de clics sur la page (pour calculer les pourcentages) */
  totalClicks: number
}

// ─── Composant ────────────────────────────────────────────────────────────────

/**
 * Tableau des statistiques détaillées par lien.
 * Colonnes : Titre, URL, Clics, % du total, Statut.
 * Trié par clics décroissants.
 *
 * @param links       - Tableau de BioLink
 * @param totalClicks - Total des clics pour le calcul des pourcentages
 * @returns Tableau HTML responsive
 */
export function LinkStatsTable({ links, totalClicks }: LinkStatsTableProps): React.JSX.Element {
  // Trier par clics décroissants
  const sorted = [...links].sort((a, b) => b.clicks - a.clicks)

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <div className="p-4 border-b">
        <h3 className="text-sm font-semibold text-foreground">
          Détail par lien
        </h3>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-2 py-2 sm:px-4 sm:py-3 text-left font-medium text-muted-foreground">Lien</th>
              <th className="px-2 py-2 sm:px-4 sm:py-3 text-right font-medium text-muted-foreground">Clics</th>
              <th className="px-2 py-2 sm:px-4 sm:py-3 text-right font-medium text-muted-foreground">% du total</th>
              <th className="px-2 py-2 sm:px-4 sm:py-3 text-center font-medium text-muted-foreground">Statut</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((link) => {
              // Pourcentage du total des clics (évite division par zéro)
              const percentage = totalClicks > 0
                ? ((link.clicks / totalClicks) * 100).toFixed(1)
                : '0.0'

              return (
                <tr key={link.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  {/* Titre + URL */}
                  <td className="px-2 py-2 sm:px-4 sm:py-3">
                    <div className="flex items-center gap-2 min-w-0">
                      {link.icon && <span className="text-base">{link.icon}</span>}
                      <div className="min-w-0">
                        <p className="font-medium truncate max-w-[150px] sm:max-w-[250px]">{link.title}</p>
                        <p className="text-xs text-muted-foreground truncate max-w-[150px] sm:max-w-[250px]">
                          {link.url}
                        </p>
                      </div>
                    </div>
                  </td>

                  {/* Clics */}
                  <td className="px-2 py-2 sm:px-4 sm:py-3 text-right font-mono tabular-nums">
                    {link.clicks.toLocaleString('fr-FR')}
                  </td>

                  {/* Pourcentage */}
                  <td className="px-2 py-2 sm:px-4 sm:py-3 text-right font-mono tabular-nums text-muted-foreground">
                    {percentage}%
                  </td>

                  {/* Statut */}
                  <td className="px-2 py-2 sm:px-4 sm:py-3 text-center">
                    <Badge variant={link.isActive ? 'default' : 'secondary'}>
                      {link.isActive ? 'Actif' : 'Inactif'}
                    </Badge>
                  </td>
                </tr>
              )
            })}

            {/* Ligne vide si aucun lien */}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                  Aucun lien créé
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
