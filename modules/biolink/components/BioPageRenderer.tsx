/**
 * @file modules/biolink/components/BioPageRenderer.tsx
 * @module biolink/components
 * @description Composant de rendu unifié d'une BioPage publique.
 *
 *   Adaptatif selon la largeur viewport (cassure à **900px**) :
 *   - **Mobile (< 900px)** : bottom-sheet photo-dominant — avatar full-bleed
 *     en fond, nom floating en haut, sheet de liens en bas avec backdrop-blur.
 *   - **Desktop (≥ 900px)** : split layout — photo à gauche (flex), panneau
 *     frosted fixe à droite (460-520px).
 *
 *   Client Component obligatoire car la bascule nécessite `matchMedia` côté
 *   navigateur. Pendant l'hydratation initiale (`isDesktop === null`), le
 *   rendu est vide pour éviter un FOUC.
 *
 *   Design source : `linkinbio.zip → design_handoff_link_in_bio/README.md`
 *   (tokens exacts, dimensions pixel-perfect).
 *
 * @example
 *   // app/u/[slug]/page.tsx
 *   import { BioPageRenderer } from '@/modules/biolink/components/BioPageRenderer'
 *   <BioPageRenderer data={MIMI_SARA_MOCK} />
 */

'use client'

import {
  Facebook,
  Instagram,
  Mail,
  Music2,
  Youtube,
} from 'lucide-react'
import Image from 'next/image'
import { useEffect, useState } from 'react'

import type {
  BioLinkItem,
  BioPageData,
  BioSocial,
  BioSocialKind,
} from '../types'

// ─── Constantes ───────────────────────────────────────────────────────────────

/** Cassure mobile ↔ desktop (imposée par le design handoff) */
const BREAKPOINT = 900

// ─── Props ────────────────────────────────────────────────────────────────────

interface BioPageRendererProps {
  /** Données de la BioPage — déjà fetchées (mock ou DB) par le caller */
  data: BioPageData
}

// ─── Composant principal ──────────────────────────────────────────────────────

/**
 * Aiguillage responsive : rend MobileView ou DesktopView selon la largeur.
 * Pendant l'hydratation (SSR → premier render client), `isDesktop === null`
 * donc on rend un placeholder dark pour éviter le FOUC et le layout shift.
 *
 * @param props.data - Données complètes de la BioPage à afficher
 * @returns MobileView (< 900px) ou DesktopView (≥ 900px)
 */
export function BioPageRenderer({ data }: BioPageRendererProps): React.JSX.Element {
  const [isDesktop, setIsDesktop] = useState<boolean | null>(null)

  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${BREAKPOINT}px)`)
    setIsDesktop(mq.matches)
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  // Placeholder dark pendant l'hydratation — évite le flash blanc
  if (isDesktop === null) {
    return <div className="fixed inset-0 bg-[#0a0806]" aria-hidden="true" />
  }

  return isDesktop ? <DesktopView data={data} /> : <MobileView data={data} />
}

// ─── Social glyph (icône réseau social) ──────────────────────────────────────

/**
 * Map `BioSocialKind` → composant Lucide + label par défaut.
 * Lucide n'a pas TikTok en icône dédiée → fallback `Music2` (note de musique).
 *
 * @param kind - Type de plateforme
 * @returns [Icône Lucide, label accessible par défaut]
 */
function getSocialIcon(kind: BioSocialKind): [typeof Instagram, string] {
  switch (kind) {
    case 'ig': return [Instagram, 'Instagram']
    case 'tt': return [Music2, 'TikTok']
    case 'yt': return [Youtube, 'YouTube']
    case 'mail': return [Mail, 'Email']
    case 'fb': return [Facebook, 'Facebook']
  }
}

/**
 * Icône de réseau social cliquable — ouvre dans un nouvel onglet.
 * Taille 16px en mobile, 18px en desktop (contrôlé par le parent via `size`).
 */
function SocialGlyph({
  social,
  size,
  className,
}: {
  social: BioSocial
  size: number
  className?: string
}): React.JSX.Element {
  const [Icon, defaultLabel] = getSocialIcon(social.kind)
  const label = social.label ?? defaultLabel
  return (
    <a
      href={social.href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${label} — ouvre un nouvel onglet`}
      className={className}
      style={{ display: 'inline-flex', transition: 'opacity 120ms ease' }}
    >
      <Icon size={size} strokeWidth={1.5} />
    </a>
  )
}

// ─── VUE MOBILE — bottom-sheet photo-dominant ────────────────────────────────

/**
 * Rendu mobile : photo en full-bleed avec scrim dégradé, nom floating en haut,
 * sheet de liens en bas (CTA amber + rows glass + socials).
 *
 * Les valeurs pixel (fontSize, positions) proviennent du design handoff.
 * Le nom scale légèrement avec la largeur entre 360px et 900px pour rester
 * proportionné sur tablettes et petits mobiles.
 */
function MobileView({ data }: BioPageRendererProps): React.JSX.Element {
  // Couleurs du design (mobile = #F6F2EC text + #E8B87A accent)
  const text = '#F6F2EC'
  const accent = '#E8B87A'

  return (
    <div
      className="relative h-dvh w-full overflow-hidden"
      style={{
        background: '#0a0806',
        color: text,
        fontFamily: '"Fraunces", Georgia, serif',
      }}
    >
      {/* Avatar full-bleed — priority car LCP critique */}
      <Image
        src={data.avatarUrl}
        alt=""
        fill
        priority
        sizes="100vw"
        style={{ objectFit: 'cover', objectPosition: '55% 25%' }}
      />

      {/* Scrim dégradé : protège le top (status) et le bas (sheet) */}
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(180deg, rgba(0,0,0,0.50) 0%, rgba(0,0,0,0) 22%, rgba(0,0,0,0) 48%, rgba(10,8,6,0.97) 95%)',
        }}
      />

      {/* Top bar : handle (gauche) + status (droite) */}
      <div
        className="absolute left-[22px] right-[22px] top-[28px] z-[3] flex items-center justify-between"
      >
        <div
          style={{
            fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
            fontSize: 10,
            letterSpacing: '2.5px',
            textTransform: 'uppercase',
          }}
        >
          {data.handle}
        </div>
        {data.status && (
          <div
            style={{
              fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
              fontSize: 10,
              letterSpacing: '2px',
              color: accent,
            }}
          >
            ● {data.status}
          </div>
        )}
      </div>

      {/* Nom floating : Fraunces 52px, ligne 1 normal, ligne 2 italique */}
      <div className="absolute left-[22px] right-[22px] top-[72px] z-[3]">
        <div
          style={{
            fontSize: 52,
            lineHeight: 0.88,
            letterSpacing: '-1.5px',
            fontWeight: 400,
          }}
        >
          {data.nameSplit[0]}
          <br />
          <em style={{ fontStyle: 'italic', fontWeight: 300 }}>
            {data.nameSplit[1]}
          </em>
        </div>
        <div
          style={{
            fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
            fontSize: 12,
            letterSpacing: '2px',
            textTransform: 'uppercase',
            marginTop: 10,
            opacity: 0.8,
          }}
        >
          {data.bio}
        </div>
      </div>

      {/* Sheet bottom : CTA amber + rows glass + socials */}
      <div
        className="absolute bottom-0 left-0 right-0 z-[2]"
        style={{ padding: '20px 22px 32px' }}
      >
        <MobileLinkRow
          link={data.links[0]}
          index={1}
          accent={accent}
          text={text}
        />
        {data.links.slice(1).map((l, i) => (
          <MobileLinkRow
            key={l.href}
            link={l}
            index={i + 2}
            accent={accent}
            text={text}
          />
        ))}

        {/* Rangée socials (centrée, opacity 0.85) */}
        <div
          className="flex justify-center"
          style={{ gap: 18, marginTop: 16, opacity: 0.85 }}
        >
          {data.socials.map((s) => (
            <SocialGlyph key={s.kind} social={s} size={16} />
          ))}
        </div>
      </div>
    </div>
  )
}

/**
 * Row individuel dans la sheet mobile — adapte son style selon `link.kind`.
 * - primary : fond amber, titre Fraunces 20px, flèche →
 * - glass   : fond rgba(255,255,255,0.06) + backdrop-blur, titre 15px, flèche ↗
 */
function MobileLinkRow({
  link,
  index,
  accent,
  text,
}: {
  link: BioLinkItem
  index: number
  accent: string
  text: string
}): React.JSX.Element {
  const isPrimary = link.kind === 'primary'
  const indexStr = String(index).padStart(2, '0')

  if (isPrimary) {
    return (
      <a
        href={link.href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`${link.label} — ouvre un nouvel onglet`}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          padding: '18px 20px',
          borderRadius: 18,
          background: accent,
          color: '#1a1208',
          marginBottom: 10,
          textDecoration: 'none',
          transition: 'transform 120ms ease, box-shadow 120ms ease',
        }}
      >
        <div
          style={{
            fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
            fontSize: 11,
            letterSpacing: '1.5px',
            opacity: 0.75,
          }}
        >
          {indexStr}
        </div>
        <div style={{ flex: 1 }}>
          {link.eyebrow && (
            <div
              style={{
                fontSize: 11,
                opacity: 0.7,
                letterSpacing: '1px',
                textTransform: 'uppercase',
              }}
            >
              {link.eyebrow}
            </div>
          )}
          <div
            style={{
              fontSize: 20,
              fontWeight: 600,
              letterSpacing: '-0.4px',
              lineHeight: 1.1,
              fontFamily: '"Fraunces", serif',
            }}
          >
            {link.label}
          </div>
        </div>
        <span style={{ fontSize: 22 }} aria-hidden="true">→</span>
      </a>
    )
  }

  // Glass row (secondaire)
  return (
    <a
      href={link.href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${link.label} — ouvre un nouvel onglet`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '14px 18px',
        borderRadius: 16,
        marginBottom: 8,
        background: 'rgba(255,255,255,0.06)',
        border: '1px solid rgba(255,255,255,0.12)',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        color: text,
        textDecoration: 'none',
        transition: 'background 120ms ease, border-color 120ms ease',
      }}
    >
      <div
        style={{
          fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
          fontSize: 11,
          opacity: 0.55,
          letterSpacing: '1px',
        }}
      >
        {indexStr}
      </div>
      <div style={{ flex: 1 }}>
        {link.eyebrow && (
          <div
            style={{
              fontSize: 10,
              opacity: 0.55,
              letterSpacing: '1px',
              textTransform: 'uppercase',
            }}
          >
            {link.eyebrow}
          </div>
        )}
        <div style={{ fontSize: 15, fontWeight: 500 }}>{link.label}</div>
      </div>
      <span style={{ fontSize: 14, opacity: 0.7 }} aria-hidden="true">↗</span>
    </a>
  )
}

// ─── VUE DESKTOP — split photo + panneau frosted ─────────────────────────────

/**
 * Rendu desktop : photo à gauche (flex:1), panneau frosted à droite (460-520px).
 * Le nom "Mimi / Sara" en Fraunces 96px est ancré en bas à gauche de la photo.
 * Le panneau contient : header (Liens + socials), greeting, tagline, liens, footer.
 */
function DesktopView({ data }: BioPageRendererProps): React.JSX.Element {
  const text = '#ffffff'
  const accent = '#D4A574'

  return (
    <div
      className="relative flex min-h-dvh w-full overflow-hidden"
      style={{
        background: '#0a0806',
        color: text,
        fontFamily: '"Space Grotesk", "Inter", system-ui, sans-serif',
      }}
    >
      {/* LEFT — photo (flex:1) */}
      <div className="relative flex-1 overflow-hidden">
        <Image
          src={data.avatarUrl}
          alt=""
          fill
          priority
          sizes="55vw"
          style={{ objectFit: 'cover', objectPosition: '55% 20%' }}
        />
        {/* Scrim horizontal : fond à droite pour se fondre dans le panneau */}
        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(90deg, rgba(0,0,0,0) 55%, rgba(10,8,6,0.95) 100%)',
          }}
        />

        {/* Top bar : handle + status */}
        <div
          className="absolute left-8 right-8 top-7 flex items-center justify-between"
          style={{
            fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
            fontSize: 12,
            letterSpacing: '2px',
            textTransform: 'uppercase',
            opacity: 0.85,
          }}
        >
          <span>{data.handle}</span>
          {data.status && (
            <span style={{ color: accent }}>● {data.status}</span>
          )}
        </div>

        {/* Nom géant en bas à gauche — Fraunces 96px */}
        <div
          className="absolute bottom-11 left-11"
          style={{ maxWidth: 520 }}
        >
          <div
            style={{
              fontFamily: '"Fraunces", Georgia, serif',
              fontSize: 96,
              lineHeight: 0.88,
              letterSpacing: '-3px',
              fontWeight: 400,
            }}
          >
            {data.nameSplit[0]}
            <br />
            <em style={{ fontStyle: 'italic', fontWeight: 300 }}>
              {data.nameSplit[1]}
            </em>
          </div>
          <div
            style={{
              fontSize: 13,
              letterSpacing: '2px',
              textTransform: 'uppercase',
              fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
              marginTop: 18,
              opacity: 0.85,
            }}
          >
            {data.bio}
          </div>
        </div>
      </div>

      {/* RIGHT — panneau frosted (largeur fixe) */}
      <div
        className="relative flex flex-shrink-0 flex-col"
        style={{
          width: 480,
          background: 'rgba(18,14,10,0.85)',
          backdropFilter: 'blur(28px) saturate(180%)',
          WebkitBackdropFilter: 'blur(28px) saturate(180%)',
          borderLeft: '1px solid rgba(255,255,255,0.08)',
          padding: '48px 40px',
          boxSizing: 'border-box',
        }}
      >
        {/* Header : "Liens · NN" (gauche) + socials (droite) */}
        <div
          className="flex items-center justify-between"
          style={{ marginBottom: 36 }}
        >
          <div
            style={{
              fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
              fontSize: 11,
              letterSpacing: '2.5px',
              textTransform: 'uppercase',
              opacity: 0.55,
            }}
          >
            Liens · {String(data.links.length).padStart(2, '0')}
          </div>
          <div className="flex items-center" style={{ gap: 14 }}>
            {data.socials.map((s) => (
              <SocialGlyph
                key={s.kind}
                social={s}
                size={18}
                className="opacity-65 transition-opacity hover:opacity-100"
              />
            ))}
          </div>
        </div>

        {/* Greeting : "Bienvenue." en Fraunces 28px */}
        <div
          style={{
            fontFamily: '"Fraunces", serif',
            fontSize: 28,
            letterSpacing: '-0.5px',
            lineHeight: 1.15,
            marginBottom: 8,
          }}
        >
          Bienvenue.
        </div>

        {/* Tagline intro */}
        <div
          style={{
            fontSize: 14,
            opacity: 0.65,
            lineHeight: 1.5,
            marginBottom: 32,
            maxWidth: 340,
          }}
        >
          {data.tagline}
        </div>

        {/* CTA primary amber + rows glass */}
        <DesktopLinkRow
          link={data.links[0]}
          index={1}
          accent={accent}
          text={text}
        />
        {data.links.slice(1).map((l, i) => (
          <DesktopLinkRow
            key={l.href}
            link={l}
            index={i + 2}
            accent={accent}
            text={text}
          />
        ))}

        {/* Footer — pushed to bottom via mt-auto */}
        <div className="mt-auto" style={{ paddingTop: 32 }}>
          <div
            style={{
              height: 1,
              background: 'rgba(255,255,255,0.08)',
              marginBottom: 18,
            }}
          />
          <div
            className="flex items-center justify-between"
            style={{
              fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
              fontSize: 10,
              letterSpacing: '1.5px',
              textTransform: 'uppercase',
              opacity: 0.5,
            }}
          >
            {data.footerBrand && <span>{data.footerBrand}</span>}
            {data.footerWebsite && <span>{data.footerWebsite}</span>}
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Row individuel dans le panneau desktop — plus grand que le mobile row.
 * - primary : fond amber + shadow warm, titre Fraunces 22px, flèche →
 * - glass   : fond rgba(255,255,255,0.05), titre 16px, flèche ↗
 */
function DesktopLinkRow({
  link,
  index,
  accent,
  text,
}: {
  link: BioLinkItem
  index: number
  accent: string
  text: string
}): React.JSX.Element {
  const isPrimary = link.kind === 'primary'
  const indexStr = String(index).padStart(2, '0')

  if (isPrimary) {
    return (
      <a
        href={link.href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`${link.label} — ouvre un nouvel onglet`}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          padding: '22px 24px',
          borderRadius: 18,
          background: accent,
          color: '#1a1208',
          marginBottom: 14,
          textDecoration: 'none',
          boxShadow: '0 12px 40px rgba(212,165,116,0.25)',
          transition: 'transform 120ms ease, box-shadow 120ms ease',
        }}
      >
        <div
          style={{
            fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
            fontSize: 11,
            letterSpacing: '1.5px',
            opacity: 0.7,
          }}
        >
          {indexStr}
        </div>
        <div style={{ flex: 1 }}>
          {link.eyebrow && (
            <div
              style={{
                fontSize: 11,
                opacity: 0.7,
                letterSpacing: '1.2px',
                textTransform: 'uppercase',
              }}
            >
              {link.eyebrow}
            </div>
          )}
          <div
            style={{
              fontSize: 22,
              fontWeight: 600,
              letterSpacing: '-0.4px',
              lineHeight: 1.1,
              fontFamily: '"Fraunces", serif',
            }}
          >
            {link.label}
          </div>
        </div>
        <span style={{ fontSize: 22 }} aria-hidden="true">→</span>
      </a>
    )
  }

  // Glass row desktop
  return (
    <a
      href={link.href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${link.label} — ouvre un nouvel onglet`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '18px 22px',
        borderRadius: 14,
        marginBottom: 10,
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.1)',
        color: text,
        textDecoration: 'none',
        transition: 'background 120ms ease, border-color 120ms ease',
      }}
    >
      <div
        style={{
          fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
          fontSize: 11,
          opacity: 0.5,
          letterSpacing: '1px',
        }}
      >
        {indexStr}
      </div>
      <div style={{ flex: 1 }}>
        {link.eyebrow && (
          <div
            style={{
              fontSize: 10,
              opacity: 0.5,
              letterSpacing: '1.2px',
              textTransform: 'uppercase',
            }}
          >
            {link.eyebrow}
          </div>
        )}
        <div style={{ fontSize: 16, fontWeight: 500 }}>{link.label}</div>
      </div>
      <span style={{ fontSize: 15, opacity: 0.65 }} aria-hidden="true">↗</span>
    </a>
  )
}
