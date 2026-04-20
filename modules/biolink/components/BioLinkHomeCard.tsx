/**
 * @file modules/biolink/components/BioLinkHomeCard.tsx
 * @module biolink/components
 * @description Widget "Ma Link-in-Bio" affiché sur la page d'accueil du dashboard.
 *
 *   Server Component — pas d'interactivité forte, uniquement des liens. Permet
 *   à l'utilisateur :
 *   - de voir d'un coup d'œil l'état de sa BioPage (publiée/brouillon)
 *   - de retrouver son URL publique `socialtdl.net/u/{slug}`
 *   - d'accéder rapidement à l'éditeur `/biolink` (bouton primary "Éditer")
 *   - de prévisualiser le rendu via `/u/{slug}?preview=1` (lien secondaire "Voir")
 *
 *   **Condition d'affichage** : n'est rendu que si l'utilisateur a déjà une
 *   BioPage. C'est à l'appelant (page dashboard) de vérifier `bioPage !== null`
 *   avant de monter ce composant — ce composant ne fait pas de fetch.
 *
 *   **Invariant** : le composant parent doit passer les champs strictement
 *   nécessaires (select Prisma `{ slug, isPublished, title, avatarUrl }`) pour
 *   éviter de surcharger la page avec des champs non utilisés.
 *
 * @example
 *   const bioPage = await prisma.bioPage.findUnique({
 *     where: { userId },
 *     select: { slug: true, isPublished: true, title: true, avatarUrl: true }
 *   })
 *   {bioPage && <BioLinkHomeCard page={bioPage} />}
 */

import { ExternalLink, Pencil } from 'lucide-react'
import Link from 'next/link'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

// ─── Types ───────────────────────────────────────────────────────────────────

/**
 * Shape minimale de BioPage attendue par le widget — correspond au `select`
 * Prisma recommandé dans le JSDoc plus haut. Garde le contrat explicite pour
 * éviter les régressions si le schéma Prisma change.
 */
export interface BioLinkHomeCardPage {
  slug: string
  isPublished: boolean
  title: string | null
  avatarUrl: string | null
}

interface BioLinkHomeCardProps {
  /** BioPage du user courant — fourni par le parent Server Component */
  page: BioLinkHomeCardPage
}

// ─── Composant ───────────────────────────────────────────────────────────────

/**
 * Rend la carte "Ma Link-in-Bio" avec :
 *  - un avatar rond (48px) ou un placeholder si `avatarUrl` est null
 *  - le titre (ligne 1 uniquement si split \n) ou "Ma Link-in-Bio" par défaut
 *  - un badge statut (vert "Publiée" / neutre "Brouillon")
 *  - l'URL publique en mono (muted)
 *  - deux actions : "Éditer" (primary) et "Voir" (outline ghost, target _blank)
 *
 * @param props.page - BioPage à afficher (slug, isPublished, title, avatarUrl)
 * @returns La card ou un fallback neutre si props invalides (défensif)
 */
export function BioLinkHomeCard({
  page,
}: BioLinkHomeCardProps): React.JSX.Element {
  // On ne garde que la première ligne du titre — le design template split sur \n
  // pour une ligne italique, mais ici dans le widget on reste sur un compact title.
  const displayTitle = (page.title ?? 'Ma Link-in-Bio').split('\n')[0].trim()

  // URL publique affichée au user — pas de protocole pour rester compact
  const publicUrl = `socialtdl.net/u/${page.slug}`

  // Le lien "Voir" pointe vers la version preview pour que l'user voie bien
  // sa page même si elle est en brouillon (isPublished=false).
  const previewHref = `/u/${page.slug}?preview=1`

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* ── Partie gauche : avatar + infos ──────────────────────────────── */}
        <div className="flex items-center gap-4 min-w-0">
          {/* Avatar rond 48px — image ou placeholder neutre */}
          {page.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- image externe Supabase, Image disponible plus tard
            <img
              src={page.avatarUrl}
              alt=""
              className="size-12 rounded-full object-cover border"
            />
          ) : (
            <div className="size-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground text-sm font-medium shrink-0">
              {/* Initiale du titre ou icône générique */}
              {displayTitle.charAt(0).toUpperCase() || '?'}
            </div>
          )}

          {/* Titre + badge + URL */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-base truncate">
                {displayTitle}
              </h3>
              {/* Badge statut : vert si publiée, neutral si brouillon */}
              {page.isPublished ? (
                <Badge
                  variant="secondary"
                  className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 border-transparent"
                >
                  Publiée
                </Badge>
              ) : (
                <Badge variant="secondary">Brouillon</Badge>
              )}
            </div>
            {/* URL mono pour faire "identifiant unique" — muted pour hiérarchie */}
            <p className="mt-1 text-xs font-mono text-muted-foreground truncate">
              {publicUrl}
            </p>
          </div>
        </div>

        {/* ── Partie droite : actions ─────────────────────────────────────── */}
        <div className="flex items-center gap-2 shrink-0">
          {/* CTA primary : éditer la page dans le dashboard */}
          <Button asChild size="sm">
            <Link href="/biolink">
              <Pencil className="size-4" />
              Éditer
            </Link>
          </Button>

          {/* Lien secondaire : ouvrir la preview dans un nouvel onglet */}
          <Button asChild variant="outline" size="sm">
            <a
              href={previewHref}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Voir la prévisualisation dans un nouvel onglet"
            >
              <ExternalLink className="size-4" />
              Voir
            </a>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
