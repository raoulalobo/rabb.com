/**
 * @file app/(legal)/legal/page.tsx
 * @module legal
 * @description Mentions légales obligatoires — ogolong.com.
 *   Accessible sans connexion à /legal.
 *
 *   Contenu obligatoire (Loi pour la Confiance dans l'Économie Numérique — LCEN) :
 *   - Éditeur du site
 *   - Hébergeur
 *   - Directeur de publication
 *   - Propriété intellectuelle
 *   - Contact
 */

import type { Metadata } from 'next'
import Link from 'next/link'

// ─── Métadonnées SEO ───────────────────────────────────────────────────────────

export const metadata: Metadata = {
  title: 'Mentions légales',
  description:
    'Mentions légales obligatoires du site ogolong.com, conformément à la loi LCEN.',
}

// ─── Composants de mise en page du contenu légal ──────────────────────────────

/**
 * Titre de section h2 avec séparateur.
 *
 * @param props.children - Texte du titre
 */
function SectionTitle({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <h2 className="mt-10 mb-3 text-lg font-semibold text-foreground border-b pb-2">
      {children}
    </h2>
  )
}

/**
 * Paragraphe de texte légal avec espacement standard.
 *
 * @param props.children - Contenu du paragraphe
 */
function P({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <p className="mb-3 text-sm leading-relaxed text-muted-foreground">{children}</p>
}

/**
 * Bloc d'information structuré (label + valeur).
 *
 * @param props.label - Libellé du champ
 * @param props.value - Valeur du champ
 */
function InfoRow({ label, value }: { label: string; value: React.ReactNode }): React.JSX.Element {
  return (
    <div className="flex gap-2 py-1.5 text-sm border-b border-dashed last:border-b-0">
      <span className="w-48 shrink-0 font-medium text-foreground">{label}</span>
      <span className="text-muted-foreground">{value}</span>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

/**
 * Page statique des mentions légales.
 * Server Component pur — contenu statique, pas de fetch.
 *
 * Conformément à l'article 6 de la loi n°2004-575 du 21 juin 2004 pour
 * la Confiance dans l'Économie Numérique (LCEN).
 *
 * @returns Page complète avec les mentions légales obligatoires
 */
export default function LegalPage(): React.JSX.Element {
  return (
    <article>
      {/* ── En-tête ── */}
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Mentions légales</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Conformément à la loi n°2004-575 du 21 juin 2004 (LCEN)
        </p>
      </header>

      {/* ── 1. Éditeur du site ── */}
      <SectionTitle>1. Éditeur du site</SectionTitle>
      <div className="rounded-md border p-4 mb-4 space-y-0">
        <InfoRow label="Nom / Raison sociale" value="[NOM / SOCIÉTÉ — À REMPLIR]" />
        <InfoRow label="Forme juridique" value="[FORME JURIDIQUE — À REMPLIR]" />
        <InfoRow label="Siège social" value="[ADRESSE — À REMPLIR]" />
        <InfoRow label="Capital social" value="[CAPITAL — À REMPLIR]" />
        <InfoRow label="SIRET" value="[SIRET — À REMPLIR]" />
        <InfoRow
          label="Contact"
          value={
            <a
              href="mailto:privacy@ogolong.com"
              className="text-foreground underline hover:no-underline"
            >
              privacy@ogolong.com
            </a>
          }
        />
      </div>
      <P>
        <em>
          Note : Les informations marquées [À REMPLIR] doivent être complétées lors du
          lancement officiel du service.
        </em>
      </P>

      {/* ── 2. Directeur de publication ── */}
      <SectionTitle>2. Directeur de la publication</SectionTitle>
      <P>[NOM DU DIRECTEUR DE PUBLICATION — À REMPLIR]</P>

      {/* ── 3. Hébergeur ── */}
      <SectionTitle>3. Hébergeur</SectionTitle>
      <div className="rounded-md border p-4 mb-4 space-y-0">
        <InfoRow label="Raison sociale" value="Vercel Inc." />
        <InfoRow label="Adresse" value="340 Pine Street Suite 603, San Francisco, CA 94104, États-Unis" />
        <InfoRow
          label="Site web"
          value={
            <a
              href="https://vercel.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-foreground underline hover:no-underline"
            >
              vercel.com
            </a>
          }
        />
      </div>
      <P>
        La base de données est hébergée par <strong>Supabase Inc.</strong> dans la région
        Europe de l&rsquo;Ouest (Union européenne), conformément au RGPD.
      </P>

      {/* ── 4. Propriété intellectuelle ── */}
      <SectionTitle>4. Propriété intellectuelle</SectionTitle>
      <P>
        L&rsquo;ensemble du contenu du site ogolong.com (textes, graphismes, logo, icônes,
        images, code source) est protégé par le droit d&rsquo;auteur et constitue une œuvre
        intellectuelle dont l&rsquo;éditeur est titulaire des droits. Toute reproduction,
        représentation, modification, publication, transmission ou dénaturation, totale ou
        partielle, est interdite sans l&rsquo;accord préalable et écrit de l&rsquo;éditeur.
      </P>
      <P>
        Les contenus créés par les utilisateurs (posts, médias) restent leur propriété
        intellectuelle exclusive, conformément à nos{' '}
        <Link href="/terms" className="text-foreground underline hover:no-underline">
          Conditions Générales d&rsquo;Utilisation
        </Link>
        .
      </P>

      {/* ── 5. Liens hypertextes ── */}
      <SectionTitle>5. Liens hypertextes</SectionTitle>
      <P>
        Le site ogolong.com peut contenir des liens vers des sites tiers. Ces liens sont fournis
        à titre informatif uniquement. L&rsquo;éditeur n&rsquo;exerce aucun contrôle sur le
        contenu de ces sites et décline toute responsabilité quant à leur contenu ou leur
        disponibilité. L&rsquo;établissement d&rsquo;un lien vers ogolong.com est soumis à
        accord préalable de l&rsquo;éditeur.
      </P>

      {/* ── 6. Contact ── */}
      <SectionTitle>6. Contact</SectionTitle>
      <P>
        Pour toute question relative aux présentes mentions légales, vous pouvez nous contacter à :
      </P>
      <P>
        <a
          href="mailto:privacy@ogolong.com"
          className="text-foreground underline hover:no-underline"
        >
          privacy@ogolong.com
        </a>
      </P>

      {/* ── Navigation vers les autres pages légales ── */}
      <div className="mt-12 pt-6 border-t text-sm text-muted-foreground">
        <p>
          Voir aussi :{' '}
          <Link href="/privacy" className="text-foreground underline hover:no-underline">
            Politique de confidentialité
          </Link>
          {' · '}
          <Link href="/terms" className="text-foreground underline hover:no-underline">
            Conditions Générales d&rsquo;Utilisation
          </Link>
        </p>
      </div>
    </article>
  )
}
