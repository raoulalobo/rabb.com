/**
 * @file modules/signatures/components/SignaturePicker.tsx
 * @module signatures
 * @description Bouton + popover d'insertion de signature dans le PostComposer.
 *   Visible dès qu'au moins une plateforme est sélectionnée, sans dépendre
 *   des onglets PlatformTabs.
 *
 *   Comportement :
 *   - 1 plateforme sélectionnée → liste directe des signatures de cette plateforme
 *   - N plateformes sélectionnées → signatures groupées par plateforme (sections)
 *   - Aucune signature → lien vers /signatures pour en créer
 *
 * @example
 *   // Dans PostComposer/Editor.tsx
 *   <SignaturePicker
 *     platforms={platforms}       // plateformes sélectionnées dans le brouillon
 *     onInsert={appendSignature}  // appende le texte à l'éditeur actif
 *   />
 */

'use client'

import { FileSignature, Star, ExternalLink } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { PLATFORM_CONFIG } from '@/modules/platforms/constants'
import type { Platform } from '@/modules/platforms/types'
import { listSignatures } from '@/modules/signatures/actions/signature.action'
import type { Signature } from '@/modules/signatures/types'

// ─── Props ────────────────────────────────────────────────────────────────────

interface SignaturePickerProps {
  /** Plateformes sélectionnées dans le brouillon (au moins 1 pour afficher le bouton) */
  platforms: Platform[]
  /** Callback appelé quand une signature est sélectionnée */
  onInsert: (text: string) => void
}

// ─── Composant ────────────────────────────────────────────────────────────────

/**
 * Bouton d'insertion de signature dans le PostComposer.
 * Charge toutes les signatures des plateformes sélectionnées au montage,
 * puis les affiche groupées par plateforme dans un popover.
 *
 * @param platforms - Plateformes sélectionnées (vide = bouton caché)
 * @param onInsert  - Appelé avec le texte de la signature à insérer
 */
export function SignaturePicker({ platforms, onInsert }: SignaturePickerProps): React.JSX.Element | null {
  // Signatures indexées par plateforme : { instagram: [...], tiktok: [...] }
  const [sigsByPlatform, setSigsByPlatform] = useState<Record<string, Signature[]>>({})
  const [isLoading, setIsLoading] = useState(false)
  const [open, setOpen] = useState(false)

  // Identifiant stable pour détecter le changement de sélection de plateformes
  const platformsKey = [...platforms].sort().join(',')

  // ─── Chargement quand les plateformes sélectionnées changent ──────────────
  useEffect(() => {
    if (platforms.length === 0) {
      setSigsByPlatform({})
      return
    }

    setIsLoading(true)

    // Charger les signatures de toutes les plateformes sélectionnées en parallèle
    Promise.all(
      platforms.map((p) =>
        listSignatures(p)
          .then((sigs) => ({ platform: p, sigs }))
          .catch(() => ({ platform: p, sigs: [] as Signature[] })),
      ),
    )
      .then((results) => {
        const indexed: Record<string, Signature[]> = {}
        for (const { platform, sigs } of results) {
          // N'inclure que les plateformes qui ont au moins une signature
          if (sigs.length > 0) indexed[platform] = sigs
        }
        setSigsByPlatform(indexed)
      })
      .finally(() => setIsLoading(false))

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [platformsKey])

  // Bouton invisible si aucune plateforme sélectionnée
  if (platforms.length === 0) return null

  // Toutes les plateformes sélectionnées qui ont des signatures
  const platformsWithSigs = platforms.filter((p) => (sigsByPlatform[p]?.length ?? 0) > 0)
  const totalSigs = platformsWithSigs.reduce((n, p) => n + (sigsByPlatform[p]?.length ?? 0), 0)

  /**
   * Insère une signature dans l'éditeur actif.
   * Ferme le popover après insertion.
   */
  function handleInsert(sigText: string): void {
    onInsert('\n\n' + sigText)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      {/* ── Bouton déclencheur ───────────────────────────────────────── */}
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          title="Insérer une signature"
        >
          <FileSignature className="size-3.5" />
          Signature
        </Button>
      </PopoverTrigger>

      {/* ── Popover de sélection ─────────────────────────────────────── */}
      <PopoverContent
        align="start"
        className="w-72 p-0"
        aria-label="Choisir une signature à insérer"
      >
        {isLoading ? (
          // Skeleton pendant le chargement
          <div className="p-3 space-y-2">
            {[1, 2].map((i) => (
              <div key={i} className="h-12 rounded-md bg-muted animate-pulse" />
            ))}
          </div>

        ) : totalSigs === 0 ? (
          // Aucune signature créée pour ces plateformes
          <div className="p-4 text-center space-y-2">
            <p className="text-sm text-muted-foreground">
              Aucune signature pour {platforms.length === 1
                ? (PLATFORM_CONFIG[platforms[0] as keyof typeof PLATFORM_CONFIG]?.label ?? platforms[0])
                : 'ces plateformes'
              }.
            </p>
            <Button variant="outline" size="sm" asChild className="gap-1.5 text-xs">
              <Link href="/signatures" target="_blank">
                <ExternalLink className="size-3" />
                Créer des signatures
              </Link>
            </Button>
          </div>

        ) : (
          // Liste des signatures, groupées par plateforme si plusieurs
          <div className="divide-y max-h-72 overflow-y-auto">
            {platformsWithSigs.map((platform) => {
              const sigs = sigsByPlatform[platform] ?? []
              const config = PLATFORM_CONFIG[platform as keyof typeof PLATFORM_CONFIG]
              const showHeader = platformsWithSigs.length > 1

              return (
                <div key={platform}>
                  {/* En-tête de section (affiché uniquement si plusieurs plateformes) */}
                  {showHeader && (
                    <div className="px-3 py-1.5 bg-muted/50 border-b">
                      <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                        {config?.label ?? platform}
                      </span>
                    </div>
                  )}

                  {/* Signatures de cette plateforme */}
                  {sigs.map((sig) => (
                    <button
                      key={sig.id}
                      type="button"
                      onClick={() => handleInsert(sig.text)}
                      className={[
                        'w-full px-3 py-2.5 text-left transition-colors',
                        'hover:bg-muted/50 focus:outline-none focus:bg-muted/50',
                        sig.isDefault ? 'bg-amber-50/50 dark:bg-amber-950/20' : '',
                      ].join(' ')}
                    >
                      {/* Nom + badge défaut */}
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm font-medium">{sig.name}</span>
                        {sig.isDefault && (
                          <Badge
                            variant="secondary"
                            className="gap-1 text-[10px] px-1.5 py-0 h-4 bg-amber-50 text-amber-700 border-amber-200 shrink-0"
                          >
                            <Star className="size-2.5 fill-amber-500 text-amber-500" />
                            défaut
                          </Badge>
                        )}
                      </div>
                      {/* Aperçu du contenu tronqué */}
                      <p className="text-xs text-muted-foreground line-clamp-1">{sig.text}</p>
                    </button>
                  ))}
                </div>
              )
            })}
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
