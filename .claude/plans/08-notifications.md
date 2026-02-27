# Phase 08 — Notifications & Emails

> **Skills à activer** : `next-best-practices`, `frontend-design`
> **Prérequis** : Phase 05 complétée (Inngest opérationnel)

---

## Objectif

Mettre en place les deux emails transactionnels via Resend + React Email :
1. **Échec de publication** — déclenché par Inngest quand un post échoue
2. **Récapitulatif hebdomadaire** — cron Inngest tous les lundis à 9h

---

## Étapes

### 8.1 — Client Resend

```typescript
// lib/resend.ts
/**
 * @file resend.ts
 * @description Client Resend singleton pour l'envoi d'emails.
 *   Ne jamais instancier Resend directement ailleurs.
 *
 * @example
 *   import { resend } from '@/lib/resend'
 *   await resend.emails.send({ from: '...', to: '...', react: <MonEmail /> })
 */
import { Resend } from 'resend'

export const resend = new Resend(process.env.RESEND_API_KEY!)
```

### 8.2 — Template : Échec de publication

```tsx
// emails/PublicationFailed.tsx
/**
 * @file PublicationFailed.tsx
 * @description Template React Email envoyé quand un post planifié échoue.
 *   Design sobre avec les couleurs de ogolong, informations claires sur l'échec.
 *
 * @param userName     - Prénom de l'utilisateur
 * @param postText     - Début du texte du post (max 100 chars)
 * @param platforms    - Plateformes ciblées par le post
 * @param failureReason - Raison de l'échec
 * @param postUrl      - Lien pour rouvrir le post dans ogolong
 */
import {
  Body, Button, Container, Head, Heading, Html,
  Preview, Section, Text, Hr,
} from '@react-email/components'

interface PublicationFailedEmailProps {
  userName:      string
  postText:      string
  platforms:     string[]
  failureReason: string
  postUrl:       string
}

export function PublicationFailedEmail({
  userName,
  postText,
  platforms,
  failureReason,
  postUrl,
}: PublicationFailedEmailProps) {
  return (
    <Html lang="fr">
      <Head />
      <Preview>⚠️ Ton post n'a pas pu être publié sur {platforms.join(', ')}</Preview>
      <Body style={bodyStyle}>
        <Container style={containerStyle}>

          {/* En-tête */}
          <Heading style={headingStyle}>
            ⚠️ Échec de publication
          </Heading>

          <Text style={textStyle}>
            Bonjour {userName},
          </Text>
          <Text style={textStyle}>
            Ton post planifié n'a malheureusement pas pu être publié sur{' '}
            <strong>{platforms.join(', ')}</strong>.
          </Text>

          {/* Extrait du post */}
          <Section style={quoteStyle}>
            <Text style={{ margin: 0, fontStyle: 'italic', color: '#6b7280' }}>
              "{postText}{postText.length >= 100 ? '...' : ''}"
            </Text>
          </Section>

          {/* Raison */}
          <Text style={textStyle}>
            <strong>Raison :</strong> {failureReason}
          </Text>

          <Hr style={hrStyle} />

          {/* CTA */}
          <Text style={textStyle}>
            Tu peux réessayer en ouvrant ton post dans ogolong :
          </Text>
          <Button style={buttonStyle} href={postUrl}>
            Rouvrir le post →
          </Button>

          <Text style={footerStyle}>
            ogolong · Planification de contenu multiplateforme
          </Text>

        </Container>
      </Body>
    </Html>
  )
}

// ─── Styles inline (React Email utilise des styles inline) ────────────────────
const bodyStyle      = { backgroundColor: '#f9fafb', fontFamily: 'sans-serif' }
const containerStyle = { maxWidth: '560px', margin: '40px auto', backgroundColor: '#fff',
                         borderRadius: '8px', padding: '32px', border: '1px solid #e5e7eb' }
const headingStyle   = { fontSize: '20px', color: '#111827', marginBottom: '16px' }
const textStyle      = { fontSize: '14px', color: '#374151', lineHeight: '1.6' }
const quoteStyle     = { backgroundColor: '#f3f4f6', borderLeft: '3px solid #6366f1',
                         padding: '12px 16px', borderRadius: '4px', margin: '16px 0' }
const hrStyle        = { borderColor: '#e5e7eb', margin: '24px 0' }
const buttonStyle    = { backgroundColor: '#6366f1', color: '#fff', padding: '12px 24px',
                         borderRadius: '6px', textDecoration: 'none', fontSize: '14px',
                         fontWeight: 'bold', display: 'inline-block' }
const footerStyle    = { fontSize: '12px', color: '#9ca3af', marginTop: '32px' }
```

### 8.3 — Template : Récapitulatif hebdomadaire

```tsx
// emails/WeeklyRecap.tsx
/**
 * @file WeeklyRecap.tsx
 * @description Template React Email du récapitulatif hebdomadaire.
 *   Envoyé tous les lundis à 9h via cron Inngest.
 *   Contient : nombre de posts publiés, stats aggrégées, top post.
 *
 * @param userName          - Prénom de l'utilisateur
 * @param weekLabel         - Ex: "du 10 au 16 février 2026"
 * @param totalPublished    - Nombre de posts publiés dans la semaine
 * @param totalImpressions  - Total des impressions
 * @param avgEngagement     - Taux d'engagement moyen (%)
 * @param topPost           - Post avec le plus d'impressions
 * @param dashboardUrl      - Lien vers le dashboard analytics ogolong
 */
import {
  Body, Button, Container, Head, Heading, Html,
  Preview, Section, Text, Row, Column, Hr,
} from '@react-email/components'

interface TopPost {
  text:        string
  platforms:   string[]
  impressions: number
}

interface WeeklyRecapEmailProps {
  userName:         string
  weekLabel:        string
  totalPublished:   number
  totalImpressions: number
  avgEngagement:    number
  topPost:          TopPost | null
  dashboardUrl:     string
}

export function WeeklyRecapEmail({
  userName,
  weekLabel,
  totalPublished,
  totalImpressions,
  avgEngagement,
  topPost,
  dashboardUrl,
}: WeeklyRecapEmailProps) {
  return (
    <Html lang="fr">
      <Head />
      <Preview>📊 Ta semaine sur ogolong — {totalPublished} posts publiés</Preview>
      <Body style={bodyStyle}>
        <Container style={containerStyle}>

          <Heading style={headingStyle}>📊 Ta semaine en chiffres</Heading>
          <Text style={textStyle}>Bonjour {userName}, voici ton récap {weekLabel} :</Text>

          {/* Métriques clés */}
          <Section style={metricsSection}>
            <Row>
              <Column style={metricBox}>
                <Text style={metricValue}>{totalPublished}</Text>
                <Text style={metricLabel}>Posts publiés</Text>
              </Column>
              <Column style={metricBox}>
                <Text style={metricValue}>{totalImpressions.toLocaleString('fr-FR')}</Text>
                <Text style={metricLabel}>Impressions</Text>
              </Column>
              <Column style={metricBox}>
                <Text style={metricValue}>{avgEngagement.toFixed(1)}%</Text>
                <Text style={metricLabel}>Engagement</Text>
              </Column>
            </Row>
          </Section>

          {/* Top post */}
          {topPost && (
            <>
              <Hr style={hrStyle} />
              <Text style={{ ...textStyle, fontWeight: 'bold' }}>
                🏆 Ton meilleur post cette semaine :
              </Text>
              <Section style={quoteStyle}>
                <Text style={{ margin: 0, color: '#374151' }}>
                  "{topPost.text.substring(0, 120)}..."
                </Text>
                <Text style={{ margin: '8px 0 0', fontSize: '12px', color: '#9ca3af' }}>
                  {topPost.platforms.join(', ')} · {topPost.impressions.toLocaleString('fr-FR')} impressions
                </Text>
              </Section>
            </>
          )}

          <Hr style={hrStyle} />

          <Button style={buttonStyle} href={dashboardUrl}>
            Voir mes analytics complets →
          </Button>

          <Text style={footerStyle}>
            ogolong · Tu reçois cet email car tu as activé le récap hebdo.{' '}
            <a href={`${dashboardUrl}/settings`} style={{ color: '#6b7280' }}>
              Gérer mes notifications
            </a>
          </Text>

        </Container>
      </Body>
    </Html>
  )
}

const bodyStyle      = { backgroundColor: '#f9fafb', fontFamily: 'sans-serif' }
const containerStyle = { maxWidth: '560px', margin: '40px auto', backgroundColor: '#fff',
                         borderRadius: '8px', padding: '32px', border: '1px solid #e5e7eb' }
const headingStyle   = { fontSize: '20px', color: '#111827', marginBottom: '8px' }
const textStyle      = { fontSize: '14px', color: '#374151', lineHeight: '1.6' }
const metricsSection = { backgroundColor: '#f3f4f6', borderRadius: '8px',
                         padding: '16px', margin: '16px 0' }
const metricBox      = { textAlign: 'center' as const, padding: '0 8px' }
const metricValue    = { fontSize: '28px', fontWeight: 'bold', color: '#6366f1', margin: 0 }
const metricLabel    = { fontSize: '12px', color: '#6b7280', margin: '4px 0 0' }
const quoteStyle     = { backgroundColor: '#f3f4f6', borderLeft: '3px solid #6366f1',
                         padding: '12px 16px', borderRadius: '4px', margin: '8px 0 16px' }
const hrStyle        = { borderColor: '#e5e7eb', margin: '24px 0' }
const buttonStyle    = { backgroundColor: '#6366f1', color: '#fff', padding: '12px 24px',
                         borderRadius: '6px', textDecoration: 'none', fontSize: '14px',
                         fontWeight: 'bold', display: 'inline-block' }
const footerStyle    = { fontSize: '12px', color: '#9ca3af', marginTop: '32px' }
```

### 8.4 — Cron Inngest : récapitulatif hebdomadaire

```typescript
// lib/inngest/functions/weekly-recap.ts
/**
 * @file weekly-recap.ts
 * @description Cron Inngest : envoi du récap hebdo tous les lundis à 9h (UTC+1).
 *   Itère sur tous les utilisateurs ayant activé cette notification.
 */
import { inngest } from '@/lib/inngest/client'
import { prisma } from '@/lib/prisma'
import { late } from '@/lib/late'
import { resend } from '@/lib/resend'
import { WeeklyRecapEmail } from '@/emails/WeeklyRecap'

export const weeklyRecap = inngest.createFunction(
  { id: 'weekly-recap', name: 'Récapitulatif hebdomadaire' },
  // Cron : tous les lundis à 8h UTC (= 9h Paris)
  { cron: '0 8 * * 1' },
  async ({ step }) => {
    // Récupérer les utilisateurs ayant activé le récap hebdo
    const usersWithRecap = await step.run('recuperer-utilisateurs', async () => {
      return prisma.notificationPrefs.findMany({
        where: { emailWeeklyRecap: true },
        include: {
          user: {
            include: { platforms: { where: { isActive: true } } },
          },
        },
      })
    })

    // Envoyer un email par utilisateur (en batch)
    await step.run('envoyer-recaps', async () => {
      const results = await Promise.allSettled(
        usersWithRecap.map(async (pref) => {
          if (pref.user.platforms.length === 0) return // Pas de plateforme connectée

          // Récupérer les stats de la semaine
          const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
          const analytics = await late.analytics.get({
            profileIds: pref.user.platforms.map((p) => p.lateProfileId),
            period: '7d',
          })

          const weekLabel = formatWeekLabel(weekAgo)

          await resend.emails.send({
            from: process.env.RESEND_FROM_EMAIL!,
            to:   pref.user.email,
            subject: `📊 Ton récap ogolong — ${weekLabel}`,
            react: WeeklyRecapEmail({
              userName:         pref.user.name ?? 'Créateur',
              weekLabel,
              totalPublished:   analytics.posts.length,
              totalImpressions: analytics.totalImpressions,
              avgEngagement:    analytics.avgEngagement,
              topPost:          analytics.posts[0] ?? null,
              dashboardUrl:     `${process.env.BETTER_AUTH_URL}/analytics`,
            }),
          })
        })
      )
      return { sent: results.filter((r) => r.status === 'fulfilled').length }
    })
  }
)

/** Formate "du 10 au 16 février 2026" */
function formatWeekLabel(weekStart: Date): string {
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekEnd.getDate() + 6)
  const fmt = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long' })
  return `du ${fmt.format(weekStart)} au ${fmt.format(weekEnd)} ${weekEnd.getFullYear()}`
}
```

### 8.5 — Enregistrement de la nouvelle fonction dans Inngest

```typescript
// app/api/inngest/route.ts — Mettre à jour pour ajouter weeklyRecap
import { weeklyRecap } from '@/lib/inngest/functions/weekly-recap'

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [publishScheduledPost, handlePostFailure, weeklyRecap],
})
```

### 8.6 — Prévisualisation des emails (React Email)

```bash
# Démarrer le serveur de prévisualisation React Email
pnpm email dev
# → http://localhost:3000 (port React Email)
```

Vérifier le rendu des deux templates dans les clients email principaux.

### 8.7 — Page préférences de notifications (dans /settings)

```typescript
// Section dans app/(dashboard)/settings/page.tsx
// modules/notifications/hooks/useNotificationPrefs.ts
```

Formulaire simple avec 2 toggles :
- [ ] M'alerter si un post échoue
- [ ] Recevoir le récapitulatif hebdomadaire

---

## Tests

```bash
# Prévisualiser les emails
pnpm email dev

# Simuler le cron Inngest (Dev Server)
# Dans le dashboard Inngest Dev : déclencher manuellement "weekly-recap"
```

---

## Vérification / Critères de succès

- [ ] Email "Échec de publication" reçu et bien rendu (mobile + desktop)
- [ ] Email "Récapitulatif hebdomadaire" reçu et bien rendu
- [ ] Cron visible dans le dashboard Inngest Dev
- [ ] Préférences de notifications fonctionnelles dans /settings
- [ ] Si `emailOnFailure = false` → email non envoyé
- [ ] Si `emailWeeklyRecap = false` → email non envoyé

---

## Passage à la phase suivante

Une fois cette phase validée → lire `09-deployment.md`.
