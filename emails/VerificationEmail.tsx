/**
 * @file emails/VerificationEmail.tsx
 * @description Template React Email pour la vérification d'adresse email.
 *   Envoyé automatiquement après l'inscription via better-auth + Plunk.
 *   Contient un bouton CTA pointant vers l'URL de confirmation générée par better-auth.
 *
 * @example
 *   import { VerificationEmail } from '@/emails/VerificationEmail'
 *   const html = await render(VerificationEmail({
 *     url: 'https://ogolong.com/api/auth/verify-email?token=abc123',
 *     name: 'Marie',
 *   }))
 */

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components'

// ─── Props ────────────────────────────────────────────────────────────────────

interface VerificationEmailProps {
  /** URL de vérification générée par better-auth (avec token signé) */
  url: string
  /** Prénom ou nom de l'utilisateur (optionnel) */
  name?: string
}

// ─── Template ─────────────────────────────────────────────────────────────────

/**
 * Template email de vérification d'adresse.
 * Design minimaliste cohérent avec l'identité visuelle ogolong.
 *
 * @param url  - Lien de confirmation à insérer dans le bouton CTA
 * @param name - Prénom affiché dans le corps du message (optionnel)
 */
export function VerificationEmail({ url, name }: VerificationEmailProps): React.JSX.Element {
  const greeting = name ? `Bonjour ${name},` : 'Bonjour,'

  return (
    <Html lang="fr">
      <Head />
      <Preview>Confirme ton adresse email pour accéder à ogolong</Preview>

      <Body style={styles.body}>
        <Container style={styles.container}>

          {/* ── En-tête logo ───────────────────────────────────────────── */}
          <Section style={styles.header}>
            <Text style={styles.logo}>ogolong</Text>
          </Section>

          {/* ── Corps ─────────────────────────────────────────────────── */}
          <Section style={styles.content}>
            <Heading style={styles.heading}>Confirme ton adresse email</Heading>

            <Text style={styles.text}>{greeting}</Text>
            <Text style={styles.text}>
              Merci de t'être inscrit sur ogolong. Clique sur le bouton ci-dessous
              pour confirmer ton adresse email et activer ton compte.
            </Text>

            {/* Bouton CTA — lien de vérification better-auth */}
            <Button href={url} style={styles.button}>
              Confirmer mon adresse email
            </Button>

            <Text style={styles.hint}>
              Ce lien expire dans 24 heures. Si tu n'as pas créé de compte sur
              ogolong, tu peux ignorer cet email.
            </Text>
          </Section>

          <Hr style={styles.hr} />

          {/* ── Pied de page ───────────────────────────────────────────── */}
          <Section style={styles.footer}>
            <Text style={styles.footerText}>
              ogolong · Planification de contenu multiplateforme
            </Text>
            <Text style={styles.footerText}>
              Si le bouton ne fonctionne pas, copie ce lien dans ton navigateur :
            </Text>
            <Text style={styles.link}>{url}</Text>
          </Section>

        </Container>
      </Body>
    </Html>
  )
}

// ─── Styles inline (requis par les clients email) ─────────────────────────────

const styles = {
  body: {
    backgroundColor: '#f4f4f5',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    margin: '0',
    padding: '0',
  },
  container: {
    backgroundColor: '#ffffff',
    borderRadius: '8px',
    margin: '40px auto',
    maxWidth: '520px',
    padding: '0',
  },
  header: {
    backgroundColor: '#18181b',
    borderRadius: '8px 8px 0 0',
    padding: '24px 32px',
  },
  logo: {
    color: '#ffffff',
    fontSize: '20px',
    fontWeight: '700',
    margin: '0',
  },
  content: {
    padding: '32px',
  },
  heading: {
    color: '#18181b',
    fontSize: '22px',
    fontWeight: '700',
    margin: '0 0 16px',
  },
  text: {
    color: '#3f3f46',
    fontSize: '15px',
    lineHeight: '24px',
    margin: '0 0 12px',
  },
  button: {
    backgroundColor: '#18181b',
    borderRadius: '6px',
    color: '#ffffff',
    display: 'block',
    fontSize: '15px',
    fontWeight: '600',
    margin: '24px 0',
    padding: '12px 24px',
    textAlign: 'center' as const,
    textDecoration: 'none',
  },
  hint: {
    color: '#71717a',
    fontSize: '13px',
    lineHeight: '20px',
    margin: '0',
  },
  hr: {
    borderColor: '#e4e4e7',
    margin: '0 32px',
  },
  footer: {
    padding: '24px 32px',
  },
  footerText: {
    color: '#a1a1aa',
    fontSize: '12px',
    lineHeight: '18px',
    margin: '0 0 4px',
  },
  link: {
    color: '#71717a',
    fontSize: '11px',
    lineHeight: '16px',
    margin: '8px 0 0',
    wordBreak: 'break-all' as const,
  },
}
