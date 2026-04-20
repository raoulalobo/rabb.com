/**
 * @file components/brand/IconLogo.tsx
 * @module brand
 * @description Icon compact "S" de SocialTDL — SVG inline dans un badge arrondi.
 *
 *   Utilisé sur mobile (< sm) en remplacement du wordmark complet qui serait
 *   trop large. Reprend le dégradé bleu→orange de WordmarkLogo pour garder
 *   la cohérence visuelle.
 *
 *   Le badge arrondi fait ressortir la lettre contre n'importe quel fond
 *   (navbar blanche ou sombre).
 *
 * @example
 *   // Swap responsive dans une navbar
 *   <span className="sm:hidden"><IconLogo className="h-8 w-8" /></span>
 *   <span className="hidden sm:block"><WordmarkLogo className="h-8 w-auto" /></span>
 */

interface IconLogoProps {
  /** Classes Tailwind (ex: "h-8 w-8") — doit être carré */
  className?: string
  /** Label ARIA personnalisé (défaut: "SocialTDL") */
  'aria-label'?: string
}

/**
 * Icon carré "S" avec dégradé bleu→orange + badge arrondi sombre.
 *
 * @param props.className   - Classes CSS (carré) pour la taille
 * @param props.aria-label  - Label accessibilité (défaut "SocialTDL")
 * @returns SVG inline du badge icon, scalable à toutes les tailles
 */
export function IconLogo({
  className,
  'aria-label': ariaLabel = 'SocialTDL',
}: IconLogoProps): React.JSX.Element {
  return (
    <svg
      viewBox="0 0 60 60"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={ariaLabel}
      className={className}
    >
      <defs>
        {/*
         * Dégradé diagonal bleu foncé → orange (reprend la palette du wordmark).
         * Appliqué au fond du badge pour un effet "gradient mesh" discret.
         */}
        <linearGradient id="iconBgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#1e3a8a" />
          <stop offset="50%" stopColor="#2563eb" />
          <stop offset="100%" stopColor="#dc2626" />
        </linearGradient>
      </defs>
      {/*
       * Badge arrondi : rx=14 donne un coin arrondi type "app icon iOS".
       * Fond gradient pour identité visuelle reconnaissable à petite taille.
       */}
      <rect width="60" height="60" rx="14" fill="url(#iconBgGrad)" />
      {/*
       * Lettre "S" en blanc centrée — fontWeight 900 + italic pour cohérence
       * typographique avec le wordmark. x/y ajustés pour centrage visuel.
       */}
      <text
        x="30"
        y="46"
        textAnchor="middle"
        fontFamily="var(--font-geist-sans), system-ui, -apple-system, 'Helvetica Neue', sans-serif"
        fontWeight="900"
        fontStyle="italic"
        fontSize="44"
        fill="#ffffff"
      >
        S
      </text>
    </svg>
  )
}
