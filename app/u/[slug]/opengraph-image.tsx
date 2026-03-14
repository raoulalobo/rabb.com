/**
 * @file app/u/[slug]/opengraph-image.tsx
 * @module biolink
 * @description OG image dynamique pour les pages Bio Link publiques.
 *   Génère une image 1200×630px (format Open Graph standard) à la volée
 *   via `next/og` (ImageResponse).
 *
 *   L'image affiche :
 *   - Avatar de l'utilisateur (ou initiale dans un cercle)
 *   - Titre (nom)
 *   - Bio courte
 *   - Nombre de liens disponibles
 *   - Branding ogolong
 *
 *   Utilisée automatiquement par Next.js quand la page /u/[slug] est partagée
 *   sur les réseaux sociaux (Facebook, Twitter, LinkedIn, Discord, etc.).
 *
 * @example
 *   // URL générée automatiquement par Next.js :
 *   // https://ogolong.com/u/mon-pseudo/opengraph-image
 */

import { ImageResponse } from 'next/og'

import { prisma } from '@/lib/prisma'

// ─── Configuration ────────────────────────────────────────────────────────────

/** Dimensions standard Open Graph (1200×630) */
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

// ─── Types ────────────────────────────────────────────────────────────────────

interface RouteProps {
  params: Promise<{ slug: string }>
}

// ─── Couleurs des thèmes pour le fond de l'OG image ──────────────────────────

const THEME_BACKGROUNDS: Record<string, { bg: string; text: string; accent: string }> = {
  default:  { bg: '#ffffff', text: '#111827', accent: '#6366f1' },
  dark:     { bg: '#030712', text: '#ffffff', accent: '#6366f1' },
  gradient: { bg: '#7c3aed', text: '#ffffff', accent: '#ec4899' },
  minimal:  { bg: '#fafaf9', text: '#292524', accent: '#78716c' },
  neon:     { bg: '#000000', text: '#4ade80', accent: '#4ade80' },
}

// ─── Générateur d'image ──────────────────────────────────────────────────────

/**
 * Génère l'OG image dynamique pour une BioPage.
 * Appelé automatiquement par Next.js lors du partage de la page.
 *
 * @param params - Paramètres de route { slug: string }
 * @returns ImageResponse (image PNG 1200×630)
 */
export default async function OGImage({ params }: RouteProps): Promise<ImageResponse> {
  const { slug } = await params

  // Charger les données de la BioPage
  const page = await prisma.bioPage.findUnique({
    where: { slug },
    select: {
      title: true,
      bio: true,
      avatarUrl: true,
      theme: true,
      accentColor: true,
      links: { where: { isActive: true }, select: { id: true } },
    },
  })

  // Couleurs du thème
  const colors = THEME_BACKGROUNDS[page?.theme ?? 'default'] ?? THEME_BACKGROUNDS.default

  // Nombre de liens actifs
  const linkCount = page?.links.length ?? 0

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.bg,
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        {/* Avatar ou initiale */}
        {page?.avatarUrl ? (
          <img
            src={page.avatarUrl}
            alt=""
            width={120}
            height={120}
            style={{
              borderRadius: '50%',
              objectFit: 'cover',
              border: `4px solid ${colors.accent}`,
            }}
          />
        ) : (
          <div
            style={{
              width: 120,
              height: 120,
              borderRadius: '50%',
              backgroundColor: colors.accent,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 48,
              fontWeight: 700,
              color: '#ffffff',
            }}
          >
            {(page?.title ?? slug)?.[0]?.toUpperCase() ?? '?'}
          </div>
        )}

        {/* Titre */}
        <div
          style={{
            marginTop: 24,
            fontSize: 48,
            fontWeight: 700,
            color: colors.text,
            lineHeight: 1.2,
          }}
        >
          {page?.title ?? slug}
        </div>

        {/* Bio */}
        {page?.bio && (
          <div
            style={{
              marginTop: 12,
              fontSize: 24,
              color: colors.text,
              opacity: 0.7,
              maxWidth: 600,
              textAlign: 'center',
              lineHeight: 1.4,
            }}
          >
            {page.bio.length > 100 ? `${page.bio.slice(0, 100)}…` : page.bio}
          </div>
        )}

        {/* Badge nombre de liens */}
        <div
          style={{
            marginTop: 32,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 20px',
            borderRadius: 999,
            backgroundColor: `${colors.accent}20`,
            color: colors.accent,
            fontSize: 20,
            fontWeight: 600,
          }}
        >
          {linkCount} lien{linkCount !== 1 ? 's' : ''}
        </div>

        {/* Branding */}
        <div
          style={{
            position: 'absolute',
            bottom: 24,
            fontSize: 16,
            color: colors.text,
            opacity: 0.3,
          }}
        >
          ogolong.com
        </div>
      </div>
    ),
    {
      ...size,
    }
  )
}
