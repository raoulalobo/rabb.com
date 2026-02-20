/**
 * @file modules/platforms/components/PlatformCard.tsx
 * @module platforms
 * @description Carte d'une plateforme sociale dans la page Settings.
 *   Affiche le logo, le nom du réseau, le compte connecté (@handle),
 *   et un bouton Connecter / Déconnecter.
 *
 *   États :
 *   - Non connectée : fond neutre, bouton "Connecter" avec couleur de marque
 *   - Connectée : badge vert, nom du compte, bouton "Déconnecter"
 *   - En cours de connexion/déconnexion : spinner + bouton désactivé
 *
 * @example
 *   <PlatformCard
 *     platform="instagram"
 *     connectedAccount={instagramAccount}
 *     onConnect={connect}
 *     onDisconnect={disconnect}
 *   />
 */

'use client'

import { CheckCircle2, Loader2, Plus, Unlink } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { LatePlatform } from '@/lib/late'
import { PLATFORM_CONFIG } from '@/modules/platforms/constants'
import type { PlatformListItem } from '@/modules/platforms/types'

import { PlatformIcon } from './PlatformIcon'

// ─── Props ────────────────────────────────────────────────────────────────────

interface PlatformCardProps {
  /** Nom de la plateforme à afficher */
  platform: LatePlatform
  /** Données du compte connecté (undefined = non connecté) */
  connectedAccount?: PlatformListItem
  /** Connexion en cours pour CETTE plateforme */
  isConnecting: boolean
  /** Déconnexion en cours pour CETTE plateforme */
  isDisconnecting: boolean
  /** Callback déclenché au clic "Connecter" */
  onConnect: (platform: LatePlatform) => void
  /** Callback déclenché au clic "Déconnecter" */
  onDisconnect: (id: string, platform: LatePlatform) => void
}

// ─── Composant ────────────────────────────────────────────────────────────────

/**
 * Carte d'affichage et d'action pour une plateforme sociale.
 * Adapte son apparence selon l'état de connexion.
 */
export function PlatformCard({
  platform,
  connectedAccount,
  isConnecting,
  isDisconnecting,
  onConnect,
  onDisconnect,
}: PlatformCardProps): React.JSX.Element {
  const config = PLATFORM_CONFIG[platform]
  const isConnected = Boolean(connectedAccount)
  const isPending = isConnecting || isDisconnecting

  return (
    <div
      className={[
        'group relative flex items-center gap-4 rounded-xl border p-4 transition-all duration-200',
        isConnected
          ? 'border-border bg-card shadow-sm'
          : 'border-border/60 bg-muted/30 hover:border-border hover:bg-card hover:shadow-sm',
      ].join(' ')}
    >
      {/* ── Icône de la plateforme ── */}
      <div
        className="flex size-12 shrink-0 items-center justify-center rounded-xl"
        style={{ backgroundColor: isConnected ? config.bgColor : undefined }}
      >
        <PlatformIcon platform={platform} className="size-7" />
      </div>

      {/* ── Infos de la plateforme ── */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm">{config.label}</span>
          {isConnected && (
            <Badge
              variant="secondary"
              className="gap-1 bg-green-50 text-green-700 border-green-200 text-[10px] px-1.5 py-0"
            >
              <CheckCircle2 className="size-2.5" />
              Connecté
            </Badge>
          )}
        </div>

        {/* Nom du compte connecté ou description de la plateforme */}
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {connectedAccount ? (
            <span className="font-medium text-foreground/70">
              {connectedAccount.accountName}
            </span>
          ) : (
            config.description
          )}
        </p>
      </div>

      {/* ── Bouton action ── */}
      {isConnected && connectedAccount ? (
        <Button
          variant="ghost"
          size="sm"
          className="shrink-0 gap-1.5 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10"
          onClick={() => onDisconnect(connectedAccount.id, platform)}
          disabled={isPending}
        >
          {isDisconnecting ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Unlink className="size-3.5" />
          )}
          {isDisconnecting ? 'Déconnexion...' : 'Déconnecter'}
        </Button>
      ) : (
        <Button
          variant="outline"
          size="sm"
          className="shrink-0 gap-1.5 text-xs transition-all"
          style={
            isConnecting
              ? undefined
              : {
                  borderColor: config.color + '60',
                  color: config.color,
                }
          }
          onClick={() => onConnect(platform)}
          disabled={isPending}
        >
          {isConnecting ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Plus className="size-3.5" />
          )}
          {isConnecting ? 'Redirection...' : 'Connecter'}
        </Button>
      )}
    </div>
  )
}
