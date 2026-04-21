/**
 * @file modules/biolink/components/BioPageEditor/SocialsSection.tsx
 * @module biolink/components/BioPageEditor
 * @description Section "Réseaux" de l'éditeur — gère la rangée d'icônes sociales
 *              affichée en bas (mobile) ou dans le header du panneau (desktop).
 *
 *   Plateformes supportées (figées — cohérentes avec `BioSocialKind` côté rendu) :
 *   - Instagram (ig)
 *   - TikTok (tt)
 *   - YouTube (yt)
 *   - Facebook (fb)
 *   - Email (mail)  — préfixé `mailto:` côté action avant persist
 *
 *   UX :
 *   - Une ligne par plateforme : icône + input URL (ou email pour `mail`)
 *   - Pour effacer une plateforme, vider son champ puis cliquer "Enregistrer"
 *   - Les champs vides sont filtrés avant envoi → non persistés
 *   - Les valeurs DB commençant par `mailto:` sont dé-préfixées à l'affichage
 *     (l'utilisateur voit l'email brut, pas le protocole)
 *
 * @example
 *   <SocialsSection
 *     initialSocials={[{ platform: 'ig', url: 'https://instagram.com/mimimaze' }]}
 *     onMutation={() => router.refresh()}
 *   />
 */

'use client'

import { Facebook, Instagram, Loader2, Mail, Music, Youtube } from 'lucide-react'
import { useMemo, useState, useTransition } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { updateBioPageSocials } from '@/modules/biolink/actions/update-biopage-socials.action'

import type { BioSocialItem } from '@/modules/biolink/schemas/biopage.schema'

// ─── Types ───────────────────────────────────────────────────────────────────

/** Plateforme canonique — identique à l'enum côté schema Zod. */
type SocialPlatform = 'ig' | 'tt' | 'yt' | 'fb' | 'mail'

/** Données initiales : l'array brut stocké dans `BioPage.socialLinks`. */
export interface SocialsSectionInitialData {
  /** Entrées socials persistées — forme `{ platform, url, label? }` */
  initialSocials: BioSocialItem[]
}

interface SocialsSectionProps extends SocialsSectionInitialData {
  /** Callback post-mutation — typiquement router.refresh() */
  onMutation: () => void
}

// ─── Config UI — ordre d'affichage, icône, label, placeholder ────────────────

/**
 * Métadonnées d'affichage pour chaque plateforme. L'ordre du tableau fixe
 * l'ordre dans l'éditeur (et — incidemment — l'ordre d'envoi, mais comme le
 * rendu public utilise `parseSocialLinks` qui préserve l'ordre, ça détermine
 * aussi l'ordre visuel de la rangée d'icônes).
 */
const PLATFORM_CONFIG: {
  platform: SocialPlatform
  label: string
  Icon: typeof Instagram
  placeholder: string
  inputType: 'url' | 'email'
}[] = [
  {
    platform: 'ig',
    label: 'Instagram',
    Icon: Instagram,
    placeholder: 'https://instagram.com/votre-profil',
    inputType: 'url',
  },
  {
    platform: 'tt',
    label: 'TikTok',
    Icon: Music, // Lucide n'a pas d'icône TikTok native — Music est l'alias utilisé côté rendu
    placeholder: 'https://tiktok.com/@votre-profil',
    inputType: 'url',
  },
  {
    platform: 'yt',
    label: 'YouTube',
    Icon: Youtube,
    placeholder: 'https://youtube.com/@votre-chaine',
    inputType: 'url',
  },
  {
    platform: 'fb',
    label: 'Facebook',
    Icon: Facebook,
    placeholder: 'https://facebook.com/votre-page',
    inputType: 'url',
  },
  {
    platform: 'mail',
    label: 'Email',
    Icon: Mail,
    placeholder: 'contact@votre-domaine.com',
    inputType: 'email',
  },
]

// ─── Composant ───────────────────────────────────────────────────────────────

/**
 * Section Réseaux de l'éditeur. Save global en une seule action.
 *
 * @returns Card contenant 5 lignes (une par plateforme) + bouton enregistrer
 */
export function SocialsSection({
  initialSocials,
  onMutation,
}: SocialsSectionProps): React.JSX.Element {
  // ── État local — une Map plateforme → URL brute (pas de mailto: à l'affichage)
  // On initialise depuis `initialSocials` en dé-préfixant `mailto:` côté mail
  // pour que l'user voie l'email brut dans le champ.
  const initialMap = useMemo<Record<SocialPlatform, string>>(() => {
    const map: Record<SocialPlatform, string> = {
      ig: '',
      tt: '',
      yt: '',
      fb: '',
      mail: '',
    }
    for (const item of initialSocials) {
      if (item.platform === 'mail' && item.url.startsWith('mailto:')) {
        map[item.platform] = item.url.slice('mailto:'.length)
      } else {
        map[item.platform] = item.url
      }
    }
    return map
  }, [initialSocials])

  const [urls, setUrls] = useState<Record<SocialPlatform, string>>(initialMap)
  const [isSaving, startSaving] = useTransition()

  /**
   * Met à jour l'URL d'UNE plateforme dans le state local.
   */
  const handleChange = (platform: SocialPlatform, value: string): void => {
    setUrls((prev) => ({ ...prev, [platform]: value }))
  }

  /**
   * Commit global : construit l'array des entrées non vides puis appelle l'action.
   * Les champs laissés vides sont filtrés → la plateforme est retirée du tableau
   * persisté (et donc de la rangée d'icônes côté public).
   */
  const handleSave = (): void => {
    startSaving(async () => {
      // Filtre les entrées vides + trim — envoi cohérent avec le schema Zod
      const payload: BioSocialItem[] = PLATFORM_CONFIG.map(({ platform }) => ({
        platform,
        url: urls[platform].trim(),
      })).filter((item) => item.url.length > 0)

      const res = await updateBioPageSocials(payload)
      if (!res.success) {
        toast.error(res.error)
        return
      }
      toast.success('Réseaux sociaux enregistrés')
      onMutation()
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Réseaux sociaux</CardTitle>
        <CardDescription>
          Ces liens apparaissent en icônes sous votre bio. Laissez un champ vide
          pour masquer l&apos;icône correspondante.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* ── 5 lignes plateforme ──────────────────────────────────────── */}
        {PLATFORM_CONFIG.map(({ platform, label, Icon, placeholder, inputType }) => (
          <div key={platform} className="space-y-2">
            <Label htmlFor={`social-${platform}`} className="flex items-center gap-2">
              <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
              {label}
            </Label>
            <Input
              id={`social-${platform}`}
              type={inputType}
              value={urls[platform]}
              onChange={(e) => handleChange(platform, e.target.value)}
              placeholder={placeholder}
              autoComplete="off"
              spellCheck={false}
            />
          </div>
        ))}

        {/* ── Bouton enregistrer global ────────────────────────────────── */}
        <div className="flex justify-end pt-2">
          <Button type="button" onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Enregistrement...
              </>
            ) : (
              'Enregistrer les réseaux'
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
