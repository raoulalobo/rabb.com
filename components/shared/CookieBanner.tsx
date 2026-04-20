/**
 * @file components/shared/CookieBanner.tsx
 * @module shared
 * @description Bannière de consentement aux cookies — conformité RGPD minimale.
 *
 *   socialtdl.net n'utilise que des cookies de session essentiels (aucun cookie
 *   publicitaire ni analytique tiers). Cette bannière informe l'utilisateur et
 *   enregistre son consentement dans localStorage pour ne plus s'afficher.
 *
 *   Comportement :
 *   - Absent si `localStorage.socialtdl_cookie_consent` est défini
 *   - Présent en bas d'écran au premier chargement (navigation privée = toujours présent)
 *   - Clic "J'ai compris" → stocke le consentement + disparaît immédiatement
 *   - Lien "En savoir plus" → /privacy
 *
 *   Design : barre fixe en bas de viewport, au-dessus de tout autre contenu (z-50),
 *   séparée par une bordure supérieure, fond `bg-card` pour lisibilité.
 *
 * @example
 *   // Dans app/layout.tsx, après <Toaster /> :
 *   <CookieBanner />
 */

'use client'

import { useEffect, useState } from 'react'

import Link from 'next/link'

import { Button } from '@/components/ui/button'

// Clé localStorage pour persister le consentement cookies de l'utilisateur.
// Valeur stockée : "true" (chaîne) — présence suffit à indiquer le consentement.
const CONSENT_KEY = 'socialtdl_cookie_consent'

/**
 * Bannière RGPD de consentement aux cookies.
 * Client Component car elle lit/écrit dans localStorage.
 *
 * Flux :
 *   1. Montage → vérifie localStorage (côté client uniquement — évite l'hydration mismatch)
 *   2. Si consentement absent → affiche la bannière
 *   3. Clic "J'ai compris" → `localStorage.setItem(CONSENT_KEY, 'true')` + masque
 *
 * @returns Barre fixe en bas de viewport, ou null si déjà consenti
 */
export function CookieBanner(): React.JSX.Element | null {
  // `null` = non déterminé (SSR), `false` = pas de consentement, `true` = consenti
  const [hasConsented, setHasConsented] = useState<boolean | null>(null)

  // Lecture du localStorage après le montage côté client uniquement.
  // useEffect garantit que ce code ne s'exécute pas en SSR
  // → évite le warning d'hydration (localStorage n'existe pas côté serveur).
  useEffect(() => {
    const stored = localStorage.getItem(CONSENT_KEY)
    // Si la clé est présente (quelle que soit sa valeur), le consentement est acquis
    setHasConsented(stored !== null)
  }, [])

  /**
   * Enregistre le consentement dans localStorage et masque la bannière.
   * Appelé au clic sur "J'ai compris".
   */
  function handleAccept(): void {
    localStorage.setItem(CONSENT_KEY, 'true')
    setHasConsented(true)
  }

  // Pendant le SSR ou avant la lecture localStorage : ne rien rendre
  // Évite le flash/mismatch d'hydration côté client
  if (hasConsented === null || hasConsented === true) return null

  return (
    // Barre fixe en bas de viewport, au-dessus du contenu (z-50)
    <div
      role="banner"
      aria-label="Consentement aux cookies"
      className="fixed bottom-0 inset-x-0 z-50 border-t bg-card shadow-lg"
    >
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3 sm:py-4">
        {/* ── Message d'information ── */}
        <p className="text-sm text-muted-foreground">
          Nous utilisons uniquement des cookies essentiels au fonctionnement du service.{' '}
          <Link
            href="/privacy"
            className="text-foreground underline underline-offset-2 hover:no-underline"
          >
            En savoir plus
          </Link>
        </p>

        {/* ── Bouton de validation ── */}
        <Button
          size="sm"
          variant="default"
          onClick={handleAccept}
          // shrink-0 : empêche le bouton de se rétrécir si le texte est long sur mobile
          className="shrink-0"
        >
          J&rsquo;ai compris
        </Button>
      </div>
    </div>
  )
}
