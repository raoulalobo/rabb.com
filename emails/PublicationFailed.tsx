/**
 * @file emails/PublicationFailed.tsx
 * @description Template React Email envoyé quand la publication d'un post échoue.
 *   Envoyé par la fonction Inngest handle-post-failure.ts.
 *   Inclut un lien direct pour réouvrir le post dans le compositeur.
 *
 * @example
 *   import { PublicationFailedEmail } from '@/emails/PublicationFailed'
 *   await resend.emails.send({
 *     react: PublicationFailedEmail({
 *       userName: 'Marie',
 *       postText: 'Mon super post...',
 *       platform: 'instagram',
 *       failureReason: 'Token expiré',
 *       postUrl: 'https://ogolong.com/compose?postId=abc123',
 *     }),
 *   })
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

interface PublicationFailedEmailProps {
  /** Prénom ou nom de l'utilisateur */
  userName: string
  /** Début du texte du post (max 100 caractères) */
  postText: string
  /** Plateforme sur laquelle la publication a échoué (1 post = 1 plateforme) */
  platform: string
  /** Message d'erreur de getlate.dev */
  failureReason: string
  /** URL directe vers le post dans le compositeur */
  postUrl: string
}

// ─── Composant ────────────────────────────────────────────────────────────────

/**
 * Template d'email d'échec de publication.
 * Notifie l'utilisateur qu'un post planifié n'a pas pu être publié.
 */
export function PublicationFailedEmail({
  userName,
  postText,
  platform,
  failureReason,
  postUrl,
}: PublicationFailedEmailProps): React.JSX.Element {
  // Capitalise le nom de la plateforme pour l'affichage
  const platformLabel = platform.charAt(0).toUpperCase() + platform.slice(1)

  return (
    <Html lang="fr">
      <Head />
      <Preview>⚠️ Échec de publication sur {platformLabel} — ogolong</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          {/* En-tête */}
          <Heading style={styles.heading}>⚠️ Échec de publication</Heading>

          <Text style={styles.text}>Bonjour {userName},</Text>

          <Text style={styles.text}>
            Nous n&apos;avons pas pu publier votre post sur{' '}
            <strong>{platformLabel}</strong>.
          </Text>

          {/* Extrait du post */}
          <Section style={styles.postPreview}>
            <Text style={styles.postText}>&quot;{postText}…&quot;</Text>
          </Section>

          {/* Raison de l'échec */}
          <Text style={styles.text}>
            <strong>Raison :</strong> {failureReason}
          </Text>

          <Hr style={styles.hr} />

          <Text style={styles.text}>
            Vous pouvez rouvrir votre post et le republier en cliquant sur le bouton ci-dessous :
          </Text>

          {/* Bouton d'action */}
          <Button href={postUrl} style={styles.button}>
            Rouvrir et republier
          </Button>

          <Hr style={styles.hr} />

          {/* Pied de page */}
          <Text style={styles.footer}>
            Vous recevez cet email car vous avez activé les notifications d&apos;échec sur ogolong.
            <br />
            Pour les désactiver, rendez-vous dans vos{' '}
            <a href={`${postUrl.split('/compose')[0]}/settings`} style={styles.link}>
              paramètres
            </a>
            .
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

// ─── Styles inline ────────────────────────────────────────────────────────────
// React Email requiert des styles inline (pas de classes CSS)

const styles = {
  body: {
    backgroundColor: '#f4f4f5',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  container: {
    margin: '40px auto',
    backgroundColor: '#ffffff',
    borderRadius: '8px',
    padding: '40px',
    maxWidth: '560px',
  },
  heading: {
    fontSize: '24px',
    fontWeight: '700',
    color: '#18181b',
    marginBottom: '24px',
  },
  text: {
    fontSize: '15px',
    color: '#3f3f46',
    lineHeight: '1.6',
    margin: '12px 0',
  },
  postPreview: {
    backgroundColor: '#fafafa',
    borderLeft: '3px solid #e4e4e7',
    padding: '12px 16px',
    margin: '16px 0',
    borderRadius: '4px',
  },
  postText: {
    fontSize: '14px',
    color: '#71717a',
    fontStyle: 'italic',
    margin: '0',
  },
  button: {
    backgroundColor: '#18181b',
    color: '#ffffff',
    padding: '12px 24px',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '600',
    textDecoration: 'none',
    display: 'inline-block',
    margin: '8px 0',
  },
  hr: {
    borderColor: '#e4e4e7',
    margin: '24px 0',
  },
  footer: {
    fontSize: '12px',
    color: '#a1a1aa',
    lineHeight: '1.6',
  },
  link: {
    color: '#18181b',
    textDecoration: 'underline',
  },
} as const
