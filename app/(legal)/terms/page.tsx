/**
 * @file app/(legal)/terms/page.tsx
 * @module legal
 * @description Conditions Générales d'Utilisation (CGU) — socialtdl.net.
 *   Accessible sans connexion à /terms.
 *
 *   Contenu :
 *   - Objet du service (planification de contenu social)
 *   - Conditions d'accès et création de compte
 *   - Obligations de l'utilisateur
 *   - Propriété intellectuelle (le contenu reste à l'utilisateur)
 *   - Limitation de responsabilité
 *   - Résiliation et suppression du compte
 *   - Droit applicable (droit français)
 */

import type { Metadata } from 'next'
import Link from 'next/link'

// ─── Métadonnées SEO ───────────────────────────────────────────────────────────

export const metadata: Metadata = {
  title: 'Conditions Générales d\'Utilisation',
  description:
    'Consultez les Conditions Générales d\'Utilisation du service socialtdl.net, outil de planification de contenu sur les réseaux sociaux.',
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
 * Liste à puces pour les obligations ou conditions.
 *
 * @param props.items - Éléments de la liste
 */
function BulletList({ items }: { items: string[] }): React.JSX.Element {
  return (
    <ul className="mb-3 ml-4 space-y-1 list-disc text-sm text-muted-foreground">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

/**
 * Page statique des Conditions Générales d'Utilisation.
 * Server Component pur — contenu statique, pas de fetch.
 *
 * @returns Page complète avec les CGU du service socialtdl.net
 */
export default function TermsPage(): React.JSX.Element {
  return (
    <article>
      {/* ── En-tête ── */}
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">
          Conditions Générales d&rsquo;Utilisation
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Dernière mise à jour : mars 2025
        </p>
      </header>

      {/* ── Introduction ── */}
      <P>
        Les présentes Conditions Générales d&rsquo;Utilisation (CGU) régissent l&rsquo;accès et
        l&rsquo;utilisation du service socialtdl.net, plateforme de planification de contenu sur
        les réseaux sociaux. En créant un compte, vous acceptez l&rsquo;intégralité des présentes
        CGU.
      </P>

      {/* ── 1. Objet du service ── */}
      <SectionTitle>1. Objet du service</SectionTitle>
      <P>
        socialtdl.net est un outil SaaS (Software as a Service) destiné aux créateurs de contenu
        indépendants. Il permet de :
      </P>
      <BulletList
        items={[
          'Rédiger et composer du contenu pour les réseaux sociaux (Instagram, TikTok, YouTube, Facebook)',
          'Planifier la publication de contenu à une date et heure définies',
          'Connecter ses comptes sociaux via des plateformes tierces',
          'Consulter les statistiques de performance de ses publications',
          'Gérer une bibliothèque de médias (images, vidéos)',
        ]}
      />

      {/* ── 2. Conditions d'accès ── */}
      <SectionTitle>2. Conditions d&rsquo;accès et création de compte</SectionTitle>
      <P>
        L&rsquo;utilisation du service est soumise à la création d&rsquo;un compte personnel.
        Pour créer un compte, vous devez :
      </P>
      <BulletList
        items={[
          'Être une personne physique majeure (18 ans ou plus) ou une personne morale régulièrement constituée',
          'Fournir une adresse email valide et un mot de passe sécurisé',
          'Ne pas créer de compte au nom d\'une autre personne sans son autorisation',
        ]}
      />
      <P>
        Vous êtes responsable de la confidentialité de vos identifiants de connexion. Toute
        utilisation du service depuis votre compte vous est entièrement imputable. En cas de
        compromission de votre compte, vous devez nous en informer immédiatement à{' '}
        <a
          href="mailto:privacy@socialtdl.net"
          className="text-foreground underline hover:no-underline"
        >
          privacy@socialtdl.net
        </a>
        .
      </P>

      {/* ── 3. Obligations de l'utilisateur ── */}
      <SectionTitle>3. Obligations de l&rsquo;utilisateur</SectionTitle>
      <P>
        En utilisant socialtdl.net, vous vous engagez à respecter les règles suivantes. Vous vous
        interdisez notamment de :
      </P>
      <BulletList
        items={[
          'Publier du contenu illégal, haineux, discriminatoire, menaçant, obscène ou contraire aux lois françaises et européennes',
          'Utiliser le service à des fins de spam, hameçonnage (phishing), ou toute forme de sollicitation commerciale non désirée',
          'Contourner les mesures de sécurité du service ou tenter d\'accéder aux données d\'autres utilisateurs',
          'Utiliser des robots, scripts ou outils automatisés non autorisés pour interagir avec le service',
          'Violer les conditions d\'utilisation des plateformes sociales connectées (Instagram, TikTok, YouTube, Facebook)',
          'Revendre, sous-licencier ou exploiter commercialement l\'accès au service sans autorisation préalable écrite',
        ]}
      />
      <P>
        Le non-respect de ces obligations peut entraîner la suspension ou la résiliation
        immédiate de votre compte, sans préavis ni remboursement.
      </P>

      {/* ── 4. Propriété intellectuelle ── */}
      <SectionTitle>4. Propriété intellectuelle</SectionTitle>
      <P>
        <strong>Votre contenu vous appartient.</strong> Les textes, images, vidéos et tout autre
        contenu que vous créez, importez ou publiez via socialtdl.net restent votre propriété
        exclusive. Vous nous accordez uniquement une licence limitée, non exclusive et révocable
        pour traiter et transmettre votre contenu aux plateformes sociales dans le cadre du
        fonctionnement normal du service.
      </P>
      <P>
        Le code source, le design, les marques et logos d&rsquo;socialtdl.net sont la propriété
        exclusive de leurs détenteurs respectifs et sont protégés par les lois sur la propriété
        intellectuelle. Toute reproduction, modification ou utilisation sans autorisation préalable
        est strictement interdite.
      </P>

      {/* ── 5. Disponibilité du service ── */}
      <SectionTitle>5. Disponibilité du service</SectionTitle>
      <P>
        Nous nous efforçons d&rsquo;assurer la disponibilité du service 24h/24 et 7j/7. Cependant,
        des interruptions peuvent survenir pour maintenance, mises à jour ou en cas de force majeure.
        Nous ne pouvons garantir une disponibilité sans interruption ni être tenus responsables
        des conséquences d&rsquo;une indisponibilité temporaire.
      </P>

      {/* ── 6. Limitation de responsabilité ── */}
      <SectionTitle>6. Limitation de responsabilité</SectionTitle>
      <P>
        Dans les limites autorisées par la loi applicable, socialtdl.net ne saurait être tenu
        responsable :
      </P>
      <BulletList
        items={[
          'Des erreurs ou retards de publication imputables aux API des plateformes sociales tierces',
          'De la perte de données consécutive à une défaillance technique indépendante de notre volonté',
          'Du contenu publié par les utilisateurs via le service',
          'Des dommages indirects, manque à gagner ou perte d\'opportunité commerciale',
          'Des modifications des règles ou API des plateformes sociales qui rendraient certaines fonctionnalités indisponibles',
        ]}
      />
      <P>
        Notre responsabilité totale envers vous est limitée au montant des sommes effectivement
        payées au cours des douze (12) derniers mois pour l&rsquo;utilisation du service.
      </P>

      {/* ── 7. Résiliation ── */}
      <SectionTitle>7. Résiliation</SectionTitle>
      <P>
        <strong>Résiliation par l&rsquo;utilisateur :</strong> Vous pouvez supprimer votre compte
        à tout moment depuis{' '}
        <strong>Paramètres &gt; Données &amp; compte &gt; Supprimer mon compte</strong>.
        La suppression est définitive et irréversible. Toutes vos données seront effacées
        conformément à notre{' '}
        <Link href="/privacy" className="text-foreground underline hover:no-underline">
          politique de confidentialité
        </Link>
        .
      </P>
      <P>
        <strong>Résiliation par socialtdl.net :</strong> Nous nous réservons le droit de suspendre
        ou de résilier votre accès en cas de violation des présentes CGU, notamment en cas
        d&rsquo;utilisation abusive, de non-paiement ou d&rsquo;activité illégale. Dans les cas
        non urgents, un préavis de 30 jours vous sera adressé par email.
      </P>

      {/* ── 8. Modifications des CGU ── */}
      <SectionTitle>8. Modifications des présentes CGU</SectionTitle>
      <P>
        Nous nous réservons le droit de modifier les présentes CGU. En cas de modification
        substantielle, vous en serez informé par email au moins 30 jours avant leur entrée en
        vigueur. La poursuite de l&rsquo;utilisation du service après cette date vaut acceptation
        des nouvelles CGU. Si vous refusez les nouvelles CGU, vous devez supprimer votre compte
        avant leur entrée en vigueur.
      </P>

      {/* ── 9. Droit applicable ── */}
      <SectionTitle>9. Droit applicable et juridiction compétente</SectionTitle>
      <P>
        Les présentes CGU sont soumises au droit français. En cas de litige relatif à
        l&rsquo;interprétation ou l&rsquo;exécution des présentes, et à défaut de résolution
        amiable dans un délai de 30 jours, les tribunaux compétents du ressort du siège social
        d&rsquo;socialtdl.net auront compétence exclusive.
      </P>
      <P>
        Conformément aux dispositions du Code de la consommation, les utilisateurs peuvent
        également recourir à la médiation conventionnelle ou à tout mode alternatif de règlement
        des différends en cas de litige.
      </P>

      {/* ── Navigation vers les autres pages légales ── */}
      <div className="mt-12 pt-6 border-t text-sm text-muted-foreground">
        <p>
          Voir aussi :{' '}
          <Link href="/privacy" className="text-foreground underline hover:no-underline">
            Politique de confidentialité
          </Link>
          {' · '}
          <Link href="/legal" className="text-foreground underline hover:no-underline">
            Mentions légales
          </Link>
        </p>
      </div>
    </article>
  )
}
