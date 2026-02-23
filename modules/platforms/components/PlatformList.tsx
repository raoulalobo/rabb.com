/**
 * @file modules/platforms/components/PlatformList.tsx
 * @module platforms
 * @description Liste des plateformes sociales avec états connect/disconnect.
 *   Orchestre usePlatforms (chargement des données), useConnectPlatform et
 *   useDisconnectPlatform (actions) pour rendre la liste complète des PlatformCard.
 *
 *   Affiche les 4 plateformes prioritaires en premier, puis les autres si connectées.
 *
 * @example
 *   // Dans la page Settings
 *   <PlatformList />
 */

'use client'

import type { LatePlatform } from '@/lib/late'
import { DISPLAYED_PLATFORMS } from '@/modules/platforms/constants'
import { useConnectPlatform, useDisconnectPlatform } from '@/modules/platforms/hooks/useConnectPlatform'
import { usePlatforms } from '@/modules/platforms/hooks/usePlatforms'

import { PlatformCard } from './PlatformCard'
import { PlatformCardSkeleton } from './PlatformCardSkeleton'

/**
 * Liste complète des plateformes sociales.
 * Affiche les 6 plateformes affichées par défaut (DISPLAYED_PLATFORMS : les 4 prioritaires
 * + Twitter + Snapchat) + toutes les autres déjà connectées.
 * Gère les états de chargement et les actions connect/disconnect.
 */
export function PlatformList(): React.JSX.Element {
  const { platforms, isLoading } = usePlatforms()
  const { connect, connectingPlatform } = useConnectPlatform()
  const { disconnect, disconnectingId } = useDisconnectPlatform()

  if (isLoading) return <PlatformCardSkeleton count={6} />

  // Construire la liste à afficher :
  // 1. Toujours afficher les 6 plateformes de DISPLAYED_PLATFORMS
  // 2. Ajouter les plateformes restantes si elles sont déjà connectées
  const connectedOther = platforms.filter(
    (p) => !DISPLAYED_PLATFORMS.includes(p.platform as LatePlatform),
  )

  const platformsToShow: LatePlatform[] = [
    ...DISPLAYED_PLATFORMS,
    ...connectedOther.map((p) => p.platform as LatePlatform),
  ]

  return (
    <div className="space-y-3">
      {platformsToShow.map((platform) => {
        // Chercher le compte connecté correspondant à cette plateforme
        const connectedAccount = platforms.find((p) => p.platform === platform)

        return (
          <PlatformCard
            key={platform}
            platform={platform}
            connectedAccount={connectedAccount}
            isConnecting={connectingPlatform === platform}
            isDisconnecting={
              Boolean(connectedAccount) && disconnectingId === connectedAccount?.id
            }
            onConnect={connect}
            onDisconnect={disconnect}
          />
        )
      })}
    </div>
  )
}
