/**
 * @file app/not-found.tsx
 * @module app
 * @description Page 404 de socialtdl.net.
 *
 *   Concept : "publication échouée" — la page simule visuellement une PostCard
 *   avec le statut FAILED, exactement comme dans l'UI réelle de SocialTDL.
 *   C'est fun, cohérent avec le domaine, et immédiatement compréhensible
 *   pour un utilisateur qui connaît l'outil.
 *
 *   Structure :
 *   1. Grand "404" typographique en font-mono
 *   2. Fausse PostCard avec statut FAILED (badge destructive)
 *      - En-tête : logo SocialTDL + nom + badge "ÉCHOUÉ"
 *      - Corps : texte barré simulant un post social qui n'a pas pu être publié
 *      - Footer : métriques à zéro + message "Publication échouée"
 *   3. Bouton de retour au dashboard
 *   4. Mention discrète "Erreur 404 · Page introuvable"
 *   5. Footer légal : liens /privacy, /terms, /legal
 *
 *   Server Component pur — pas de 'use client', pas d'animations JS.
 *   Accessible : contrastes respectés, rôles ARIA, texte alternatif.
 *
 * @example
 *   // Next.js App Router détecte automatiquement ce fichier
 *   // et l'affiche pour toute route inexistante (404)
 *   // → https://socialtdl.net/une-page-qui-nexiste-pas  →  not-found.tsx
 */

import Link from 'next/link'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

import type { Metadata } from 'next'

// ─── Métadonnées ──────────────────────────────────────────────────────────────

/**
 * Métadonnées SEO pour la page 404.
 * Le titre "Page introuvable" est explicite pour les moteurs de recherche.
 * noindex implicite via le statut HTTP 404 que Next.js envoie automatiquement.
 */
export const metadata: Metadata = {
  title: 'Page introuvable — SocialTDL',
  description: 'Cette page n\'existe pas. Retournez au dashboard pour gérer vos posts.',
}

// ─── Constantes ───────────────────────────────────────────────────────────────

/**
 * Contenu du "faux post" affiché barré dans la PostCard.
 * Simulé comme un vrai post social — avec hashtags et émojis.
 * Chaque ligne est un paragraphe distinct pour le rendu.
 */
const FAKE_POST_LINES = [
  '✨ Nouveau post disponible sur SocialTDL...',
  '',
  'Malheureusement, cette page n\'existe pas encore.',
  'On travaille dessus. Restez connectés !',
  '',
  '#SocialTDL #bientôt #PageIntrouvable',
] as const

// ─── Composant ────────────────────────────────────────────────────────────────

/**
 * Page 404 — affichée automatiquement par Next.js App Router pour toute
 * route inexistante. Simule une PostCard avec statut FAILED pour rester
 * cohérent avec l'univers visuel de SocialTDL.
 *
 * @returns JSX de la page 404, centré plein écran, Server Component
 */
export default function NotFound(): React.JSX.Element {
  return (
    /*
     * Conteneur plein écran centré (horizontal + vertical).
     * bg-muted/30 : fond très légèrement teinté pour distinguer
     * la page 404 du dashboard sans casser le design system.
     */
    <main
      className="flex min-h-screen flex-col items-center justify-center gap-8 bg-muted/30 px-4 py-16"
      aria-labelledby="not-found-title"
    >

      {/* ── Grand "404" typographique ───────────────────────────────────────── */}
      {/*
       * font-mono : cohérent avec les codes d'erreur/status techniques.
       * text-primary : couleur de marque pour attirer l'oeil.
       * select-none : évite la sélection accidentelle du nombre décoratif.
       */}
      <p
        className="select-none font-mono text-9xl font-black leading-none tracking-tighter text-primary opacity-20"
        aria-hidden="true"
      >
        404
      </p>

      {/* ── Fausse PostCard avec statut FAILED ─────────────────────────────── */}
      {/*
       * La card reproduit fidèlement le design des PostCards dans /compose :
       * - border + rounded-xl + shadow-sm → même apparence qu'une vraie card
       * - bg-card → suit le thème clair/sombre automatiquement
       * - max-w-md → largeur contenue, lisible sur mobile et desktop
       *
       * role="article" : sémantique correcte pour un "post" social simulé.
       */}
      <article
        className="w-full max-w-md rounded-xl border bg-card p-6 shadow-sm"
        role="article"
        aria-label="Post échoué — page introuvable"
      >

        {/* ── En-tête de la card ─────────────────────────────────────────── */}
        {/*
         * Structure identique à une vraie PostCard :
         * - Logo SocialTDL (carré arrondi bg-primary + "o" blanc)
         * - Nom de l'app "socialtdl.net"
         * - Badge statut FAILED (variant destructive = rouge)
         */}
        <header className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Logo SocialTDL — carré arrondi bg-primary avec lettre "o" blanche */}
            {/*
             * size-8 = 32px : taille standard pour un avatar/logo dans une card.
             * rounded-lg (pas rounded-full) : forme de l'icône app, pas d'avatar.
             * aria-label : description pour les lecteurs d'écran.
             */}
            <div
              className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground"
              aria-label="Logo SocialTDL"
            >
              o
            </div>

            {/* Nom de l'application */}
            <div className="flex flex-col">
              <span className="text-sm font-semibold leading-tight">socialtdl.net</span>
              {/* Sous-titre discret — identique au nom de plateforme dans les vraies cards */}
              <span className="text-xs text-muted-foreground">Agent IA</span>
            </div>
          </div>

          {/* Badge statut "ÉCHOUÉ" — variant destructive = fond rouge */}
          {/*
           * Reproduit exactement le badge affiché sur les posts FAILED dans l'UI.
           * uppercase + tracking-wide : convention des badges de statut dans SocialTDL.
           */}
          <Badge variant="destructive" className="shrink-0 font-mono text-xs uppercase tracking-wide">
            ÉCHOUÉ
          </Badge>
        </header>

        {/* ── Corps du faux post ─────────────────────────────────────────── */}
        {/*
         * Le contenu est barré (line-through) pour simuler visuellement
         * un post qui n'a pas pu être publié — cohérent avec le statut FAILED.
         * text-muted-foreground : atténue le texte barré (effet "supprimé").
         *
         * aria-label sur la section décrit le contenu pour les lecteurs d'écran
         * qui ne comprennent pas le barré visuellement.
         */}
        <section
          className="space-y-1 text-sm text-muted-foreground line-through"
          aria-label="Contenu du post (page introuvable)"
        >
          {FAKE_POST_LINES.map((line, index) =>
            // Ligne vide → <br> pour respecter l'espacement du post social
            line === '' ? (
              <br key={index} aria-hidden="true" />
            ) : (
              <p key={index}>{line}</p>
            )
          )}
        </section>

        {/* ── Séparateur ────────────────────────────────────────────────── */}
        <hr className="my-4 border-border" aria-hidden="true" />

        {/* ── Footer de la card — métriques + statut ────────────────────── */}
        {/*
         * Reproduit le footer des PostCards réelles avec :
         * - Métriques sociales (likes, commentaires, partages) à zéro
         * - Message de statut "Publication échouée"
         *
         * Les métriques à 0 renforcent le thème "post raté".
         * text-muted-foreground + text-xs : discret, comme dans l'UI réelle.
         */}
        <footer className="flex items-center justify-between">
          {/* Métriques sociales simulées */}
          <div className="flex items-center gap-4 text-xs text-muted-foreground" aria-label="Métriques du post">
            {/* Likes */}
            <span className="flex items-center gap-1" title="0 j'aime">
              <span aria-hidden="true">❤️</span>
              <span>0</span>
            </span>

            {/* Commentaires */}
            <span className="flex items-center gap-1" title="0 commentaire">
              <span aria-hidden="true">💬</span>
              <span>0</span>
            </span>

            {/* Partages */}
            <span className="flex items-center gap-1" title="0 partage">
              <span aria-hidden="true">📤</span>
              <span>0</span>
            </span>
          </div>

          {/* Message de statut — reproduit le format des vraies cards */}
          {/*
           * "Publication échouée · il y a 0 sec" : humour subtil qui renforce
           * le thème tout en restant immédiatement compréhensible.
           */}
          <span className="text-xs text-destructive font-medium">
            Publication échouée · il y a 0 sec
          </span>
        </footer>
      </article>

      {/* ── Zone d'actions ─────────────────────────────────────────────────── */}
      <div className="flex flex-col items-center gap-4">

        {/* Bouton de retour — CTA principal de la page */}
        {/*
         * href="/dashboard" : page d'accueil du dashboard (route protégée).
         * variant="default" : bouton primary — c'est l'action principale.
         * size="default" : taille standard, pas besoin d'un "lg" ici.
         */}
        <Button asChild>
          <Link href="/dashboard">
            {/* Flèche gauche Unicode — pas de SVG externe requis */}
            <span aria-hidden="true" className="mr-1">&larr;</span>
            Retour au dashboard
          </Link>
        </Button>

        {/* Mention d'erreur discrète — secondaire, pour les utilisateurs techniques */}
        <p
          id="not-found-title"
          className="text-xs text-muted-foreground"
          aria-live="polite"
        >
          Erreur 404 &middot; Page introuvable
        </p>

        {/* ── Footer légal — liens RGPD ─────────────────────────────────── */}
        {/*
         * Liens légaux obligatoires accessibles même depuis la page 404.
         * Séparés par des points typographiques (aria-hidden pour les lecteurs d'écran).
         */}
        <nav
          className="flex flex-wrap justify-center gap-x-3 gap-y-1 text-xs text-muted-foreground"
          aria-label="Liens légaux"
        >
          <Link href="/privacy" className="hover:text-foreground transition-colors">
            Politique de confidentialité
          </Link>
          <span aria-hidden>·</span>
          <Link href="/terms" className="hover:text-foreground transition-colors">
            CGU
          </Link>
          <span aria-hidden>·</span>
          <Link href="/legal" className="hover:text-foreground transition-colors">
            Mentions légales
          </Link>
        </nav>
      </div>

    </main>
  )
}
