/**
 * @file app/(legal)/privacy/page.tsx
 * @module legal
 * @description Page de politique de confidentialité RGPD — socialtdl.net.
 *   Accessible sans connexion à /privacy.
 *
 *   Contenu :
 *   - Responsable du traitement
 *   - Données collectées et finalités
 *   - Base légale (art. 6.1.b RGPD — exécution du contrat)
 *   - Hébergement et transferts de données
 *   - Durée de conservation
 *   - Droits des utilisateurs (accès, rectification, effacement, portabilité, opposition)
 *   - Contact RGPD : privacy@socialtdl.net
 */

import type { Metadata } from 'next'
import Link from 'next/link'

// ─── Métadonnées SEO ───────────────────────────────────────────────────────────

export const metadata: Metadata = {
  title: 'Politique de confidentialité',
  description:
    'Découvrez comment socialtdl.net collecte, utilise et protège vos données personnelles conformément au RGPD.',
}

// ─── Composants de mise en page du contenu légal ──────────────────────────────

/**
 * Titre de section (h2) avec séparateur visuel.
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
 * Liste à puces pour les éléments de données ou droits.
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
 * Page statique de politique de confidentialité RGPD.
 * Server Component pur — contenu statique, pas de fetch.
 *
 * @returns Page complète avec les mentions RGPD obligatoires
 */
export default function PrivacyPage(): React.JSX.Element {
  return (
    <article>
      {/* ── En-tête ── */}
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Politique de confidentialité</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Dernière mise à jour : mars 2025
        </p>
      </header>

      {/* ── Introduction ── */}
      <P>
        socialtdl.net (&ldquo;nous&rdquo;, &ldquo;notre service&rdquo;) s&rsquo;engage à protéger la vie
        privée de ses utilisateurs. Cette politique explique quelles données personnelles nous
        collectons, pourquoi nous les collectons et comment nous les utilisons, conformément au
        Règlement Général sur la Protection des Données (RGPD — Règlement UE 2016/679).
      </P>

      {/* ── 1. Responsable du traitement ── */}
      <SectionTitle>1. Responsable du traitement</SectionTitle>
      <P>
        Le responsable du traitement des données personnelles collectées via socialtdl.net est :{' '}
        <strong>socialtdl.net</strong>.
      </P>
      <P>
        Contact RGPD :{' '}
        <a
          href="mailto:privacy@socialtdl.net"
          className="text-foreground underline hover:no-underline"
        >
          privacy@socialtdl.net
        </a>
      </P>

      {/* ── 2. Données collectées ── */}
      <SectionTitle>2. Données personnelles collectées</SectionTitle>
      <P>Nous collectons les données suivantes lors de votre utilisation du service :</P>
      <BulletList
        items={[
          'Données d\'identification : nom, adresse email',
          'Données de contenu : textes de posts, images et vidéos que vous publiez ou planifiez',
          'Données de comptes sociaux connectés : noms de profils, identifiants des plateformes (Instagram, TikTok, YouTube, Facebook)',
          'Données de navigation : adresse IP, type de navigateur, pages visitées (logs serveur)',
          'Données de session : token de session (cookie HttpOnly, durée 48h)',
        ]}
      />
      <P>
        Nous ne collectons pas de données de paiement directement — tout paiement éventuel est
        géré par un prestataire tiers (Stripe) qui dispose de sa propre politique de confidentialité.
      </P>

      {/* ── 3. Finalités et bases légales ── */}
      <SectionTitle>3. Finalités du traitement et bases légales</SectionTitle>
      <P>
        Toutes nos activités de traitement reposent sur l&rsquo;une des bases légales suivantes
        du RGPD :
      </P>

      {/* Tableau des finalités */}
      <div className="mb-4 overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-4 py-2 text-left font-medium text-foreground">Finalité</th>
              <th className="px-4 py-2 text-left font-medium text-foreground">Base légale (RGPD)</th>
            </tr>
          </thead>
          <tbody className="divide-y text-muted-foreground">
            <tr>
              <td className="px-4 py-2">Création et gestion de votre compte</td>
              <td className="px-4 py-2">Exécution du contrat (art. 6.1.b)</td>
            </tr>
            <tr>
              <td className="px-4 py-2">Publication et planification de contenu</td>
              <td className="px-4 py-2">Exécution du contrat (art. 6.1.b)</td>
            </tr>
            <tr>
              <td className="px-4 py-2">Envoi d&rsquo;emails transactionnels (notifications)</td>
              <td className="px-4 py-2">Exécution du contrat (art. 6.1.b)</td>
            </tr>
            <tr>
              <td className="px-4 py-2">Amélioration du service et détection d&rsquo;erreurs</td>
              <td className="px-4 py-2">Intérêt légitime (art. 6.1.f)</td>
            </tr>
            <tr>
              <td className="px-4 py-2">Conformité légale et fiscale</td>
              <td className="px-4 py-2">Obligation légale (art. 6.1.c)</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ── 4. Hébergement et transferts ── */}
      <SectionTitle>4. Hébergement et transferts de données</SectionTitle>
      <P>
        Vos données sont hébergées par les prestataires suivants, liés à nous par des accords de
        traitement de données conformes au RGPD :
      </P>
      <BulletList
        items={[
          'Vercel Inc. (hébergement applicatif) — San Francisco, CA, USA. Transfert encadré par les Clauses Contractuelles Types (CCT) de l\'Union européenne.',
          'Supabase Inc. (base de données PostgreSQL et stockage fichiers) — Région Europe (EU West). Les données restent dans l\'Union européenne.',
          'Zernio (API de publication sur réseaux sociaux) — voir la politique de confidentialité de Zernio pour les données transmises lors des publications.',
        ]}
      />

      {/* ── 5. Durée de conservation ── */}
      <SectionTitle>5. Durée de conservation</SectionTitle>
      <P>
        Vos données personnelles sont conservées tant que votre compte est actif. En cas de
        suppression de votre compte (via <strong>Paramètres &gt; Supprimer mon compte</strong>),
        l&rsquo;ensemble de vos données sont supprimées dans un délai de 30 jours, sauf obligation
        légale de conservation (ex : données comptables conservées 10 ans selon la loi française).
      </P>
      <P>
        Les logs serveurs (adresse IP, requêtes) sont conservés 90 jours à des fins de sécurité et
        de débogage.
      </P>

      {/* ── 6. Cookies ── */}
      <SectionTitle>6. Cookies et traceurs</SectionTitle>
      <P>
        socialtdl.net utilise uniquement des cookies <strong>strictement nécessaires</strong> au
        fonctionnement du service. Il n&rsquo;existe pas de cookie publicitaire, analytique tiers,
        ou de tracking sur notre service.
      </P>
      <BulletList
        items={[
          'Cookie de session better-auth (HttpOnly, Secure, SameSite=Lax) : maintient votre connexion. Durée : 48 heures glissantes.',
          'Stockage local (localStorage) : préférences d\'interface (thème, filtres). Aucune donnée personnelle.',
        ]}
      />

      {/* ── 7. Droits des utilisateurs ── */}
      <SectionTitle>7. Vos droits RGPD</SectionTitle>
      <P>
        Conformément au RGPD, vous disposez des droits suivants concernant vos données personnelles :
      </P>
      <BulletList
        items={[
          'Droit d\'accès (art. 15) : obtenir une copie de vos données via le bouton "Exporter mes données" dans Paramètres',
          'Droit de rectification (art. 16) : corriger vos informations dans Paramètres > Profil',
          'Droit à l\'effacement (art. 17) : supprimer votre compte et toutes vos données via Paramètres > Supprimer mon compte',
          'Droit à la portabilité (art. 20) : télécharger vos données au format JSON via Paramètres > Exporter mes données',
          'Droit d\'opposition (art. 21) : vous opposer au traitement de vos données sur la base de notre intérêt légitime',
          'Droit de limitation (art. 18) : demander la limitation du traitement de vos données',
        ]}
      />
      <P>
        Pour exercer ces droits ou pour toute question relative à vos données, contactez notre
        délégué à la protection des données :{' '}
        <a
          href="mailto:privacy@socialtdl.net"
          className="text-foreground underline hover:no-underline"
        >
          privacy@socialtdl.net
        </a>
        . Nous nous engageons à répondre dans un délai d&rsquo;un mois.
      </P>
      <P>
        Vous disposez également du droit d&rsquo;introduire une réclamation auprès de la CNIL
        (Commission Nationale de l&rsquo;Informatique et des Libertés) :{' '}
        <a
          href="https://www.cnil.fr"
          target="_blank"
          rel="noopener noreferrer"
          className="text-foreground underline hover:no-underline"
        >
          www.cnil.fr
        </a>
        .
      </P>

      {/* ── 8. Sécurité ── */}
      <SectionTitle>8. Sécurité des données</SectionTitle>
      <P>
        Nous mettons en œuvre des mesures techniques et organisationnelles appropriées pour
        protéger vos données contre tout accès non autorisé, altération, divulgation ou
        destruction. Ces mesures comprennent notamment :
      </P>
      <BulletList
        items={[
          'Chiffrement des communications via HTTPS/TLS',
          'Mots de passe hachés (bcrypt) — jamais stockés en clair',
          'Cookies de session HttpOnly et Secure pour prévenir le vol de session',
          'Accès à la base de données limité aux services internes',
          'Row Level Security (RLS) sur Supabase',
        ]}
      />

      {/* ── 9. Modifications ── */}
      <SectionTitle>9. Modifications de cette politique</SectionTitle>
      <P>
        Nous pouvons modifier cette politique de confidentialité. En cas de modification
        substantielle, nous vous en informerons par email au moins 30 jours avant l&rsquo;entrée
        en vigueur des nouvelles dispositions. La date de dernière mise à jour est indiquée en
        haut de cette page.
      </P>

      {/* ── Navigation vers les autres pages légales ── */}
      <div className="mt-12 pt-6 border-t text-sm text-muted-foreground">
        <p>
          Voir aussi :{' '}
          <Link href="/terms" className="text-foreground underline hover:no-underline">
            Conditions Générales d&rsquo;Utilisation
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
