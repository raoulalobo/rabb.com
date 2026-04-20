/**
 * @file components/brand/WordmarkLogo.tsx
 * @module brand
 * @description Logo vectoriel (SVG inline) du wordmark "SocialTDL".
 *
 *   Pourquoi un SVG inline et non un fichier .svg ou PNG :
 *   - Pixel-perfect à toutes les tailles (pas de pixellisation)
 *   - Hérite de la font Geist Sans du document parent via CSS
 *   - Dégradés natifs (bleu → orange) définis par des <linearGradient>
 *   - Pas de requête réseau supplémentaire (< 1KB dans le bundle)
 *   - Accessible : role="img" + aria-label pour les lecteurs d'écran
 *
 *   Dégradés reproduisant la charte visuelle de l'image source :
 *   - "Social" : bleu foncé → bleu clair (#1e3a8a → #60a5fa)
 *   - "TDL"    : orange → rouge (#f59e0b → #dc2626)
 *
 *   Le viewBox 280×60 définit le ratio 4.67:1. La hauteur réelle est
 *   contrôlée via la prop `className` (ex: "h-8 w-auto" → 32px de haut,
 *   ~149px de large).
 *
 * @example
 *   // Dans la Sidebar
 *   <WordmarkLogo className="h-8 w-auto" />
 *
 *   // Dans la landing navbar (plus grand)
 *   <WordmarkLogo className="h-10 w-auto" />
 */

interface WordmarkLogoProps {
  /** Classes Tailwind (ex: "h-8 w-auto") — contrôle la taille de rendu */
  className?: string
  /** Label ARIA personnalisé (défaut: "SocialTDL") */
  'aria-label'?: string
}

/**
 * Wordmark SVG "SocialTDL" avec dégradés bleu et orange.
 *
 * @param props.className   - Classes CSS (Tailwind) — principalement pour la taille
 * @param props.aria-label  - Label accessibilité (défaut "SocialTDL")
 * @returns SVG inline du wordmark, scalable à toutes les tailles
 */
export function WordmarkLogo({
  className,
  'aria-label': ariaLabel = 'SocialTDL',
}: WordmarkLogoProps): React.JSX.Element {
  return (
    <svg
      viewBox="0 0 280 60"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={ariaLabel}
      className={className}
    >
      <defs>
        {/*
         * Dégradé "Social" — bleu foncé à gauche → bleu clair à droite.
         * Trois stops pour un dégradé plus riche (comme l'image source).
         */}
        <linearGradient id="wmSocialGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#1e3a8a" />
          <stop offset="50%" stopColor="#2563eb" />
          <stop offset="100%" stopColor="#60a5fa" />
        </linearGradient>
        {/*
         * Dégradé "TDL" — orange vif à gauche → rouge à droite.
         * Reproduit la chaleur de la moitié droite du logo original.
         */}
        <linearGradient id="wmTdlGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#dc2626" />
        </linearGradient>
      </defs>
      {/*
       * Texte SVG : fontWeight 900 + italic + letter-spacing condensé
       * pour un look "bold italique" proche du logo source.
       * fontFamily hérite de la font Geist Sans définie sur <body>
       * via la variable CSS --font-geist-sans.
       */}
      <text
        x="0"
        y="46"
        fontFamily="var(--font-geist-sans), system-ui, -apple-system, 'Helvetica Neue', sans-serif"
        fontWeight="900"
        fontStyle="italic"
        fontSize="52"
        letterSpacing="-1.5"
      >
        <tspan fill="url(#wmSocialGrad)">Social</tspan>
        <tspan fill="url(#wmTdlGrad)">TDL</tspan>
      </text>
    </svg>
  )
}
