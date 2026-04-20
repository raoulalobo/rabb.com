/**
 * @file modules/analytics/components/AnalyticsExport.tsx
 * @module analytics
 * @description Bouton d'export des données analytics en CSV.
 *   Génère un fichier CSV côté client à partir des données déjà chargées
 *   dans le hook useAnalytics (pas d'appel API supplémentaire).
 *
 *   Colonnes CSV :
 *   Date, Plateforme, Texte, Likes, Commentaires, Partages, Vues,
 *   Impressions, Portée, Clics, Taux d'engagement (%)
 *
 *   Le fichier est nommé : SocialTDL-analytics-{date}.csv
 *
 * @example
 *   <AnalyticsExport posts={analyticsPosts?.posts} />
 */

'use client'

import { Download } from 'lucide-react'

import { Button } from '@/components/ui/button'

// ─── Types ───────────────────────────────────────────────────────────────────

/** Post analytics minimal pour l'export (même shape que useAnalytics) */
interface ExportablePost {
  id: string
  text: string
  platform: string
  publishedAt: string
  metrics: {
    likes: number
    comments: number
    shares: number
    views: number
    impressions: number
    reach: number
    clicks: number
    engagementRate: number
  }
}

interface AnalyticsExportProps {
  /** Posts avec métriques (depuis useAnalytics → analyticsPosts.posts) */
  posts: ExportablePost[] | undefined
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Échappe une valeur pour l'inclure dans un CSV.
 * Entoure de guillemets si la valeur contient une virgule, un guillemet ou un saut de ligne.
 *
 * @param value - Valeur brute à échapper
 * @returns Valeur sécurisée pour CSV
 *
 * @example
 *   escapeCsvValue('Mon post, avec virgule') // → '"Mon post, avec virgule"'
 *   escapeCsvValue('Simple')                 // → 'Simple'
 */
function escapeCsvValue(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

/**
 * Convertit un tableau de posts en contenu CSV (string).
 *
 * @param posts - Posts à convertir
 * @returns Contenu CSV avec en-têtes et lignes de données
 */
function generateCsv(posts: ExportablePost[]): string {
  const headers = [
    'Date',
    'Plateforme',
    'Texte',
    'Likes',
    'Commentaires',
    'Partages',
    'Vues',
    'Impressions',
    'Portée',
    'Clics',
    'Taux engagement (%)',
  ]

  const rows = posts.map((post) => [
    post.publishedAt ? new Date(post.publishedAt).toLocaleDateString('fr-FR') : '',
    post.platform,
    escapeCsvValue(post.text.replace(/\n/g, ' ').slice(0, 200)),
    post.metrics.likes,
    post.metrics.comments,
    post.metrics.shares,
    post.metrics.views,
    post.metrics.impressions,
    post.metrics.reach,
    post.metrics.clicks,
    post.metrics.engagementRate.toFixed(2),
  ])

  return [headers.join(','), ...rows.map((row) => row.join(','))].join('\n')
}

/**
 * Déclenche le téléchargement d'un fichier CSV dans le navigateur.
 *
 * @param csvContent - Contenu CSV (string)
 * @param filename - Nom du fichier à télécharger
 */
function downloadCsv(csvContent: string, filename: string): void {
  // BOM UTF-8 pour que Excel affiche correctement les accents
  const bom = '\uFEFF'
  const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()

  // Libérer la mémoire après téléchargement
  URL.revokeObjectURL(url)
}

// ─── Composant ────────────────────────────────────────────────────────────────

/**
 * Bouton d'export CSV pour les données analytics.
 * Désactivé si aucun post n'est disponible.
 *
 * @param posts - Posts avec métriques à exporter
 * @returns Bouton "Exporter CSV"
 */
export function AnalyticsExport({ posts }: AnalyticsExportProps): React.JSX.Element {
  const hasData = posts && posts.length > 0

  const handleExport = (): void => {
    if (!hasData) return

    const csvContent = generateCsv(posts)
    const date = new Date().toISOString().slice(0, 10)
    downloadCsv(csvContent, `SocialTDL-analytics-${date}.csv`)
  }

  return (
    <Button
      variant="outline"
      size="sm"
      className="gap-1.5 text-xs"
      onClick={handleExport}
      disabled={!hasData}
      title={hasData ? `Exporter ${posts.length} posts en CSV` : 'Aucune donnée à exporter'}
    >
      <Download className="size-3.5" />
      Exporter CSV
    </Button>
  )
}
