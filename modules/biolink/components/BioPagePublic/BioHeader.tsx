/**
 * @file modules/biolink/components/BioPagePublic/BioHeader.tsx
 * @module biolink
 * @description En-tête de section affiché sur la page publique Bio Link.
 *   Correspond au type de lien "header" : un texte centré en gras,
 *   sans lien cliquable, utilisé pour structurer visuellement la page
 *   en séparant les groupes de liens par thématique.
 *
 *   La couleur du texte est héritée du thème parent (via les classes
 *   appliquées au conteneur dans BioPageView).
 *
 * @example
 *   // Afficher un titre de section "Mes réseaux"
 *   <BioHeader title="Mes réseaux" />
 *
 * @example
 *   // Utilisé dans BioPageView pour les liens de type "header"
 *   {link.type === 'header' && <BioHeader title={link.title} />}
 */

'use client'

// ─── Props ────────────────────────────────────────────────────────────────────

interface BioHeaderProps {
  /** Texte du titre de section à afficher */
  title: string
}

// ─── Composant ────────────────────────────────────────────────────────────────

/**
 * Titre de section non-cliquable sur la page Bio Link publique.
 * Rendu comme un texte centré en gras avec un espacement vertical.
 * Hérite la couleur du texte du thème parent appliqué par BioPageView.
 *
 * @param title - Texte du titre de section (ex: "Mes projets", "Boutique")
 * @returns Élément div contenant le titre centré et en gras
 */
export function BioHeader({ title }: BioHeaderProps): React.JSX.Element {
  return (
    // Conteneur avec padding vertical pour espacer du contenu adjacent
    <div className="px-4 py-3 text-center">
      {/* Titre en gras, taille légèrement supérieure au corps de texte */}
      <h2 className="text-base font-bold">{title}</h2>
    </div>
  )
}
