/**
 * @file app/(dashboard)/signatures/page.tsx
 * @module signatures
 * @description Page de gestion des signatures.
 *   Server Component : charge les signatures groupées par plateforme via `listSignatures()`,
 *   puis passe les données aux sections Client Component pour le CRUD en temps réel.
 *
 *   Structure de la page :
 *   - En-tête : titre + description
 *   - Une `SignaturePlatformSection` pour chacune des 5 plateformes prioritaires
 *     (DISPLAYED_PLATFORMS) + les plateformes qui ont déjà des signatures (non régressif)
 *   - Si aucune plateforme connectée : message d'invitation à connecter un compte
 *
 *   Les sections sont triées selon DISPLAYED_PLATFORMS (plateformes prioritaires d'abord).
 *
 * @example
 *   // Accessible via la sidebar : /signatures
 *   // Server Component → chargement statique des données initiales
 */

import { Separator } from '@/components/ui/separator'
import type { LatePlatform } from '@/lib/late'
import { DISPLAYED_PLATFORMS } from '@/modules/platforms/constants'
import { listSignatures } from '@/modules/signatures/actions/signature.action'
import { SignaturePlatformSection } from '@/modules/signatures/components/SignaturePlatformSection'
import type { SignaturesByPlatform } from '@/modules/signatures/types'

// ─── Page ─────────────────────────────────────────────────────────────────────

/**
 * Page /signatures — gestion des signatures textuelles par plateforme.
 * Charge toutes les signatures de l'utilisateur et les groupe par plateforme.
 * Affiche les 5 plateformes prioritaires + celles ayant déjà des signatures.
 *
 * @returns Page avec une section par plateforme prioritaire (même sans signatures)
 */
export default async function SignaturesPage(): Promise<React.JSX.Element> {
  // Chargement de toutes les signatures de l'utilisateur connecté
  const allSignatures = await listSignatures()

  // Groupement par plateforme
  const byPlatform = allSignatures.reduce<SignaturesByPlatform>((acc, sig) => {
    if (!acc[sig.platform]) acc[sig.platform] = []
    acc[sig.platform]!.push(sig)
    return acc
  }, {})

  // Plateformes avec des signatures existantes non incluses dans DISPLAYED_PLATFORMS
  // (non régressif : un utilisateur qui avait des signatures Snapchat les voit toujours)
  const platformsWithSigs = Object.keys(byPlatform).filter(
    (p) => !DISPLAYED_PLATFORMS.includes(p as LatePlatform),
  )

  // Afficher les 5 plateformes prioritaires + celles qui ont déjà des signatures
  const platformsToShow: LatePlatform[] = [
    ...DISPLAYED_PLATFORMS,
    ...platformsWithSigs as LatePlatform[],
  ]

  return (
    <div className="container max-w-3xl py-8 space-y-8">
      {/* ── En-tête ────────────────────────────────────────────────────── */}
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Signatures</h1>
        <p className="text-sm text-muted-foreground">
          Créez des blocs de texte réutilisables (hashtags, CTA, liens) par réseau social.
          Insérez-les en un clic dans vos posts depuis le Composer.
        </p>
      </div>

      <Separator />

      {/* ── Sections par plateforme ────────────────────────────────────── */}
      <div className="space-y-10">
        {platformsToShow.map((platform) => (
          <SignaturePlatformSection
            key={platform}
            platform={platform}
            // Signatures de cette plateforme (tableau vide si aucune)
            initialSignatures={byPlatform[platform] ?? []}
          />
        ))}
      </div>
    </div>
  )
}
