/**
 * @file modules/platforms/hooks/useConnectPlatform.ts
 * @module platforms
 * @description Hooks pour connecter et déconnecter une plateforme sociale.
 *   Encapsule les Server Actions avec gestion des toasts (sonner) et
 *   invalidation du cache TanStack Query.
 *
 * @example
 *   const { connect, isConnecting } = useConnectPlatform()
 *   await connect('instagram')  // Redirige vers OAuth getlate.dev
 *
 *   const { disconnect, isDisconnecting } = useDisconnectPlatform()
 *   await disconnect('cpl_abc123')  // Supprime la plateforme
 */

'use client'

import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'

import { connectPlatform } from '@/modules/platforms/actions/connect-platform.action'
import { disconnectPlatform } from '@/modules/platforms/actions/disconnect-platform.action'
import { PLATFORM_CONFIG } from '@/modules/platforms/constants'
import { platformQueryKeys } from '@/modules/platforms/hooks/usePlatforms'
import type { Platform } from '@/modules/platforms/types'

// ─── Types de retour ──────────────────────────────────────────────────────────

interface UseConnectPlatformReturn {
  connect: (platform: Platform) => Promise<void>
  isConnecting: boolean
  connectingPlatform: Platform | null
}

interface UseDisconnectPlatformReturn {
  disconnect: (connectedPlatformId: string, platform: Platform) => Promise<void>
  isDisconnecting: boolean
  disconnectingId: string | null
}

// ─── useConnectPlatform ───────────────────────────────────────────────────────

/**
 * Hook pour initier la connexion OAuth d'une plateforme.
 * Appelle la Server Action, affiche un toast, puis redirige vers l'OAuth.
 *
 * @returns {
 *   connect: (platform: Platform) => Promise<void> — Lance l'OAuth
 *   isConnecting: boolean — Connexion en cours (pour désactiver le bouton)
 *   connectingPlatform: Platform | null — Quelle plateforme est en cours
 * }
 *
 * @example
 *   const { connect, isConnecting, connectingPlatform } = useConnectPlatform()
 *   <Button onClick={() => connect('instagram')} disabled={isConnecting}>
 *     {connectingPlatform === 'instagram' ? 'Connexion...' : 'Connecter'}
 *   </Button>
 */
export function useConnectPlatform(): UseConnectPlatformReturn {
  const [connectingPlatform, setConnectingPlatform] = useState<Platform | null>(null)

  const connect = async (platform: Platform): Promise<void> => {
    setConnectingPlatform(platform)

    const result = await connectPlatform(platform)

    if (!result.success) {
      toast.error(result.error ?? 'Erreur lors de la connexion.')
      setConnectingPlatform(null)
      return
    }

    if (result.redirectUrl) {
      // Redirection vers l'OAuth getlate.dev → le chargement reste actif jusqu'à la navigation
      window.location.href = result.redirectUrl
    }
  }

  return {
    connect,
    isConnecting: connectingPlatform !== null,
    connectingPlatform,
  }
}

// ─── useDisconnectPlatform ────────────────────────────────────────────────────

/**
 * Hook pour déconnecter une plateforme sociale.
 * Appelle la Server Action, invalide le cache TanStack Query et affiche un toast.
 *
 * @returns {
 *   disconnect: (id: string) => Promise<void> — Déconnecte la plateforme
 *   isDisconnecting: boolean — Déconnexion en cours
 *   disconnectingId: string | null — ID de la plateforme en cours de déconnexion
 * }
 *
 * @example
 *   const { disconnect, isDisconnecting } = useDisconnectPlatform()
 *   <Button onClick={() => disconnect(platform.id)} disabled={isDisconnecting}>
 *     Déconnecter
 *   </Button>
 */
export function useDisconnectPlatform(): UseDisconnectPlatformReturn {
  const queryClient = useQueryClient()
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null)

  const disconnect = async (connectedPlatformId: string, platform: Platform): Promise<void> => {
    setDisconnectingId(connectedPlatformId)

    const result = await disconnectPlatform(connectedPlatformId)

    if (!result.success) {
      toast.error(result.error ?? 'Erreur lors de la déconnexion.')
      setDisconnectingId(null)
      return
    }

    // Invalider le cache pour déclencher un refetch de la liste
    await queryClient.invalidateQueries({ queryKey: platformQueryKeys.list() })

    const label = PLATFORM_CONFIG[platform]?.label ?? platform
    toast.success(`${label} déconnecté avec succès.`)
    setDisconnectingId(null)
  }

  return {
    disconnect,
    isDisconnecting: disconnectingId !== null,
    disconnectingId,
  }
}
