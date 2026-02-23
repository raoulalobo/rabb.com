/**
 * @file app/(dashboard)/not-found.tsx
 * @module app/dashboard
 * @description Page 404 scoped au dashboard — affichée avec la Sidebar et le Header.
 *
 *   Déclenchée dans deux cas :
 *   1. Une page du dashboard appelle `notFound()` (ex: un post inexistant)
 *   2. L'utilisateur navigue vers une URL inconnue sous /dashboard/*
 *      via le catch-all `app/(dashboard)/[...not-found]/page.tsx`
 *
 *   Différence avec `app/not-found.tsx` (racine) :
 *   - Ce fichier hérite automatiquement du layout (dashboard) → Sidebar + Header
 *   - Pas de `min-h-screen` : le layout gère déjà la hauteur plein écran
 *   - Centrage vertical dans la zone `main` (flex-1 overflow-y-auto)
 *
 *   Design : même concept "PostCard FAILED" que la 404 racine,
 *   adapté à l'espace disponible dans le dashboard (sans le grand "404" décoratif).
 *
 * @example
 *   // Déclenchement explicite depuis une page dashboard
 *   import { notFound } from 'next/navigation'
 *   if (!post) notFound()   // → affiche ce fichier avec Sidebar + Header
 */

import Link from 'next/link'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

import type { Metadata } from 'next'

// ─── Métadonnées ──────────────────────────────────────────────────────────────

/**
 * Métadonnées SEO pour la 404 dashboard.
 * Le statut HTTP 404 est envoyé automatiquement par Next.js → noindex implicite.
 */
export const metadata: Metadata = {
  title: 'Page introuvable',
}

// ─── Constantes ───────────────────────────────────────────────────────────────

/**
 * Lignes du "faux post" barré affiché dans la PostCard simulée.
 * Reprend le même concept que la 404 racine, message adapté au contexte dashboard.
 */
const FAKE_POST_LINES = [
  '✨ Nouveau contenu prévu ici...',
  '',
  'Cette page n\'existe pas dans le dashboard.',
  'Vérifiez l\'URL ou revenez à la liste de vos posts.',
  '',
  '#rabb #pageIntrouvable #404',
] as const

// ─── Composant ────────────────────────────────────────────────────────────────

/**
 * Page 404 du dashboard — rendue à l'intérieur du layout (Sidebar + Header).
 *
 * La zone `main` du DashboardLayout fait `flex-1 overflow-y-auto p-6`.
 * Ce composant centre son contenu verticalement dans cet espace disponible
 * via `flex flex-col items-center justify-center min-h-full`.
 *
 * @returns JSX centré dans la zone contenu du dashboard
 */
export default function DashboardNotFound(): React.JSX.Element {
  return (
    /*
     * min-h-full : occupe toute la hauteur de la zone main du layout.
     * gap-6 : espacement cohérent avec les autres pages du dashboard.
     * py-12 : marges verticales confortables sans déborder.
     */
    <div className="flex min-h-full flex-col items-center justify-center gap-6 py-12">

      {/* ── Grand "404" typographique — version compacte ────────────────────── */}
      {/*
       * Taille réduite (text-8xl) par rapport à la 404 racine (text-9xl)
       * car l'espace horizontal est réduit par la sidebar.
       * opacity-20 : élément décoratif, ne doit pas dominer visuellement.
       */}
      <p
        className="select-none font-mono text-8xl font-black leading-none tracking-tighter text-primary opacity-20"
        aria-hidden="true"
      >
        404
      </p>

      {/* ── Fausse PostCard avec statut FAILED ─────────────────────────────── */}
      {/*
       * Reproduit le design des PostCards de /compose :
       * - max-w-md : largeur contenue, lisible dans la zone main
       * - shadow-sm : légère profondeur, identique aux vraies cards
       * - bg-card : suit le thème clair/sombre automatiquement
       */}
      <article
        className="w-full max-w-md rounded-xl border bg-card p-6 shadow-sm"
        role="article"
        aria-label="Post échoué — page introuvable"
      >

        {/* ── En-tête ─────────────────────────────────────────────────────── */}
        <header className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Logo rabb — identique à la PostCard réelle */}
            <div
              className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground"
              aria-label="Logo rabb"
            >
              r
            </div>

            <div className="flex flex-col">
              <span className="text-sm font-semibold leading-tight">rabb.com</span>
              <span className="text-xs text-muted-foreground">Agent IA</span>
            </div>
          </div>

          {/* Badge statut ÉCHOUÉ — variant destructive = rouge */}
          <Badge variant="destructive" className="shrink-0 font-mono text-xs uppercase tracking-wide">
            ÉCHOUÉ
          </Badge>
        </header>

        {/* ── Corps du faux post barré ─────────────────────────────────────── */}
        {/*
         * line-through : simule visuellement un post "raté" / supprimé.
         * text-muted-foreground : atténue le texte barré pour l'effet "grisé".
         */}
        <section
          className="space-y-1 text-sm text-muted-foreground line-through"
          aria-label="Contenu du post (page introuvable)"
        >
          {FAKE_POST_LINES.map((line, index) =>
            line === '' ? (
              <br key={index} aria-hidden="true" />
            ) : (
              <p key={index}>{line}</p>
            )
          )}
        </section>

        {/* ── Séparateur ───────────────────────────────────────────────────── */}
        <hr className="my-4 border-border" aria-hidden="true" />

        {/* ── Footer — métriques + statut ─────────────────────────────────── */}
        <footer className="flex items-center justify-between">
          {/* Métriques sociales simulées à zéro */}
          <div className="flex items-center gap-4 text-xs text-muted-foreground" aria-label="Métriques du post">
            <span className="flex items-center gap-1" title="0 j'aime">
              <span aria-hidden="true">❤️</span>
              <span>0</span>
            </span>
            <span className="flex items-center gap-1" title="0 commentaire">
              <span aria-hidden="true">💬</span>
              <span>0</span>
            </span>
            <span className="flex items-center gap-1" title="0 partage">
              <span aria-hidden="true">📤</span>
              <span>0</span>
            </span>
          </div>

          {/* Message de statut — même format que les vraies PostCards */}
          <span className="text-xs font-medium text-destructive">
            Publication échouée · il y a 0 sec
          </span>
        </footer>
      </article>

      {/* ── Zone d'actions ──────────────────────────────────────────────────── */}
      <div className="flex flex-col items-center gap-3">

        {/* Bouton retour au dashboard — CTA principal */}
        <Button asChild>
          <Link href="/dashboard">
            <span aria-hidden="true" className="mr-1">&larr;</span>
            Retour au dashboard
          </Link>
        </Button>

        {/* Mention d'erreur discrète */}
        <p
          className="text-xs text-muted-foreground"
          aria-live="polite"
        >
          Erreur 404 &middot; Page introuvable
        </p>
      </div>

    </div>
  )
}
