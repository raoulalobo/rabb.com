/**
 * @file modules/biolink/components/BioPagePublic/BioSeparator.tsx
 * @module biolink
 * @description Séparateur horizontal décoratif affiché sur la page publique Bio Link.
 *   Correspond au type de lien "separator" : une ligne horizontale subtile
 *   (opacity réduite) qui permet de créer une séparation visuelle entre
 *   les groupes de liens sans titre de section.
 *
 *   La couleur de la ligne est héritée du thème parent et atténuée
 *   par une opacité de 20% pour rester discrète.
 *
 * @example
 *   // Séparateur simple
 *   <BioSeparator />
 *
 * @example
 *   // Séparateur avec classe personnalisée
 *   <BioSeparator className="my-4" />
 *
 * @example
 *   // Utilisé dans BioPageView pour les liens de type "separator"
 *   {link.type === 'separator' && <BioSeparator />}
 */

'use client'

// ─── Props ────────────────────────────────────────────────────────────────────

interface BioSeparatorProps {
  /** Classes Tailwind supplémentaires pour personnaliser l'espacement ou le style */
  className?: string
}

// ─── Composant ────────────────────────────────────────────────────────────────

/**
 * Ligne horizontale décorative pour séparer visuellement les groupes de liens.
 * Rendu comme un élément `<hr>` avec une opacité réduite (20%) et un
 * espacement vertical (my-2) par défaut.
 *
 * @param className - Classes Tailwind optionnelles pour surcharger le style par défaut
 * @returns Élément hr stylisé avec opacité réduite
 */
export function BioSeparator({ className = '' }: BioSeparatorProps): React.JSX.Element {
  return (
    // Ligne horizontale avec opacité réduite et espacement vertical compact
    <hr className={`border-current opacity-20 my-2 ${className}`} />
  )
}
