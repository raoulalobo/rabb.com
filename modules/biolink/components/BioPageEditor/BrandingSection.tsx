/**
 * @file modules/biolink/components/BioPageEditor/BrandingSection.tsx
 * @module biolink
 * @description Section de personnalisation du branding pour l'éditeur Bio Link.
 *   Regroupe 3 controles :
 *   - Interrupteur pour masquer le badge "Propulsé par ogolong" en bas de page
 *   - Champ URL pour un favicon personnalisé (remplace le favicon par défaut)
 *   - Champ domaine personnalisé (fonctionnalité future, badge "Bientot disponible")
 *
 * @example
 *   <BrandingSection
 *     hideBranding={false}
 *     faviconUrl={null}
 *     customDomain={null}
 *     onHideBrandingChange={setHideBranding}
 *     onFaviconUrlChange={setFaviconUrl}
 *     onCustomDomainChange={setCustomDomain}
 *   />
 */

'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'

import { ImageDropZone } from './ImageDropZone'

// ─── Props ────────────────────────────────────────────────────────────────────

interface BrandingSectionProps {
  /** true si le branding ogolong est masqué */
  hideBranding: boolean
  /** URL du favicon personnalisé (null = favicon par défaut) */
  faviconUrl: string | null
  /** Domaine personnalisé (null = sous-domaine ogolong par défaut) */
  customDomain: string | null
  /** Callback de changement du masquage du branding */
  onHideBrandingChange: (v: boolean) => void
  /** Callback de changement de l'URL du favicon */
  onFaviconUrlChange: (url: string | null) => void
  /** Callback de changement du domaine personnalisé */
  onCustomDomainChange: (d: string | null) => void
}

// ─── Composant ────────────────────────────────────────────────────────────────

/**
 * Section branding de l'éditeur Bio Link.
 * Contient le switch masquer branding, le champ favicon et le champ domaine custom.
 *
 * @param hideBranding        - true si branding masqué
 * @param faviconUrl          - URL favicon actuelle
 * @param customDomain        - Domaine custom actuel
 * @param onHideBrandingChange - Setter masquage branding
 * @param onFaviconUrlChange   - Setter URL favicon
 * @param onCustomDomainChange - Setter domaine custom
 * @returns Section avec 3 controles (switch + 2 inputs)
 */
export function BrandingSection({
  hideBranding,
  faviconUrl,
  customDomain,
  onHideBrandingChange,
  onFaviconUrlChange,
  onCustomDomainChange,
}: BrandingSectionProps): React.JSX.Element {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-foreground">Branding</h3>

      {/* ── Switch : masquer le branding ogolong ─────────────────────── */}
      <div className="flex items-start gap-3">
        <Switch
          id="hide-branding-toggle"
          checked={hideBranding}
          onCheckedChange={onHideBrandingChange}
          aria-describedby="hide-branding-description"
        />
        <div className="space-y-0.5">
          <Label htmlFor="hide-branding-toggle" className="cursor-pointer">
            Masquer le branding
          </Label>
          <p id="hide-branding-description" className="text-xs text-muted-foreground">
            Retirer le badge &quot;Propulse par ogolong&quot; en bas de page
          </p>
        </div>
      </div>

      {/* ── Upload favicon personnalise ────────────────────────────── */}
      <div className="space-y-2">
        <Label>Favicon personnalise</Label>
        <ImageDropZone
          value={faviconUrl}
          onChange={onFaviconUrlChange}
          aspectRatio="1/1"
          accept="image/png,image/x-icon,image/svg+xml"
          placeholder="Glissez votre favicon ici"
          recommended=".ico ou .png 32x32"
          maxSizeMB={1}
        />
      </div>

      {/* ── Champ : domaine personnalise (fonctionnalite future) ─────── */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Label htmlFor="custom-domain">Domaine personnalise</Label>
          {/* Badge indiquant que la fonctionnalite n'est pas encore disponible */}
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
            Bientot disponible
          </span>
        </div>
        <Input
          id="custom-domain"
          type="text"
          value={customDomain ?? ''}
          onChange={(e) => onCustomDomainChange(e.target.value || null)}
          placeholder="bio.monsite.com"
          // Desactive visuellement car fonctionnalite non implementee
          disabled
        />
        <p className="text-xs text-muted-foreground">
          Connectez votre propre domaine pour remplacer ogolong.com/u/votre-slug
        </p>
      </div>
    </div>
  )
}
