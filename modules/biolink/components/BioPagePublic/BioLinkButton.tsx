/**
 * @file modules/biolink/components/BioPagePublic/BioLinkButton.tsx
 * @module biolink
 * @description Bouton-lien cliquable affiché sur la page publique Bio Link.
 *   Chaque bouton représente un BioLink de type "link" : titre + URL de destination.
 *   Au clic, le tracking est déclenché (incrémentation du compteur de clics)
 *   avant la navigation vers l'URL de destination.
 *
 *   Les styles (forme, variante, animation hover) sont passés via className
 *   par le composant parent BioPageView, qui applique les personnalisations
 *   de l'utilisateur (buttonShape, buttonVariant, hoverAnimation).
 *
 * @example
 *   <BioLinkButton
 *     link={{ id: 'lnk_1', type: 'link', title: 'Ma vidéo', url: 'https://youtube.com/...', ... }}
 *     bioPageId="bp_1"
 *     className="rounded-lg bg-gray-100 hover:scale-105"
 *   />
 */

'use client'

import { trackClick } from '@/modules/biolink/actions/biolink.action'
import type { BioLink } from '@/modules/biolink/types'

// ─── Props ────────────────────────────────────────────────────────────────────

interface BioLinkButtonProps {
  /** Données du lien à afficher */
  link: BioLink
  /** ID de la BioPage parente (pour le tracking des clics) */
  bioPageId: string
  /** Classes Tailwind combinées (thème + forme + variante + animation) */
  className?: string
  /** Couleur hex personnalisée du texte du lien (null = couleur du thème) */
  linkColor?: string | null
}

// ─── Composant ────────────────────────────────────────────────────────────────

/**
 * Bouton-lien cliquable sur la page publique.
 * Déclenche le tracking des clics via Server Action avant navigation.
 * Ne rend rien si l'URL est null (sécurité pour les types non-link).
 *
 * @param link       - Données du BioLink (titre, URL, icône)
 * @param bioPageId  - ID de la BioPage (pour tracking)
 * @param className  - Classes Tailwind combinées
 * @returns Lien stylisé en bouton avec tracking, ou null si URL manquante
 */
export function BioLinkButton({ link, bioPageId, className = '', linkColor }: BioLinkButtonProps): React.JSX.Element | null {
  // Sécurité : ne pas rendre si l'URL est null (ne devrait pas arriver pour type=link)
  if (!link.url) return null

  /**
   * Gère le clic sur le lien : envoie le tracking en arrière-plan
   * sans bloquer la navigation (fire & forget).
   */
  function handleClick(): void {
    // Fire & forget : on ne bloque pas la navigation pour attendre le tracking
    trackClick(link.id, bioPageId).catch(() => {
      // Silencieux : le tracking est best-effort, on ne bloque pas l'UX
    })
  }

  return (
    <a
      href={link.url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={handleClick}
      className={`block w-full px-4 py-3 text-center font-medium transition-all ${className}`}
      style={linkColor ? { color: linkColor } : undefined}
    >
      {/* Icône optionnelle (emoji) + titre */}
      <span className="flex items-center justify-center gap-2">
        {link.icon && <span>{link.icon}</span>}
        <span className="truncate">{link.title}</span>
      </span>
    </a>
  )
}
