/**
 * @file modules/biolink/components/BioPageEditor/SocialLinksEditor.tsx
 * @module biolink
 * @description Éditeur des liens sociaux (icônes en bas de la BioPage).
 *   Permet d'ajouter, modifier et supprimer des liens vers les profils
 *   sur les réseaux sociaux (Instagram, YouTube, TikTok, etc.).
 *
 * @example
 *   <SocialLinksEditor
 *     socialLinks={[{ platform: 'instagram', url: 'https://instagram.com/monpseudo' }]}
 *     onChange={setSocialLinks}
 *   />
 */

'use client'

import { Plus, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

import type { BioSocialLink } from '@/modules/biolink/types'

// ─── Constantes ───────────────────────────────────────────────────────────────

/** Plateformes proposées par défaut dans le sélecteur */
const SOCIAL_PLATFORMS = [
  { value: 'instagram', label: 'Instagram' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'twitter', label: 'X (Twitter)' },
  { value: 'snapchat', label: 'Snapchat' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'threads', label: 'Threads' },
] as const

// ─── Props ────────────────────────────────────────────────────────────────────

interface SocialLinksEditorProps {
  /** Liste actuelle des liens sociaux */
  socialLinks: BioSocialLink[]
  /** Callback de mise à jour de la liste complète */
  onChange: (links: BioSocialLink[]) => void
}

// ─── Composant ────────────────────────────────────────────────────────────────

/**
 * Éditeur des liens sociaux pour la BioPage.
 * Affiche la liste des liens existants avec possibilité de modifier l'URL
 * ou supprimer, et un bouton pour ajouter un nouveau réseau.
 *
 * @param socialLinks - Tableau actuel de { platform, url }
 * @param onChange    - Setter pour la liste complète
 * @returns Section éditable des liens sociaux
 */
export function SocialLinksEditor({
  socialLinks,
  onChange,
}: SocialLinksEditorProps): React.JSX.Element {
  /**
   * Ajoute un nouveau lien social avec la première plateforme non encore utilisée.
   * Si toutes les plateformes sont prises, ajoute "instagram" par défaut.
   */
  function handleAdd(): void {
    // Trouver la première plateforme non encore ajoutée
    const usedPlatforms = new Set(socialLinks.map((l) => l.platform))
    const nextPlatform = SOCIAL_PLATFORMS.find((p) => !usedPlatforms.has(p.value))

    onChange([
      ...socialLinks,
      { platform: nextPlatform?.value ?? 'instagram', url: '' },
    ])
  }

  /**
   * Met à jour un champ d'un lien social à l'index donné.
   *
   * @param index - Position dans le tableau
   * @param field - Champ à modifier ("platform" ou "url")
   * @param value - Nouvelle valeur
   */
  function handleUpdate(index: number, field: keyof BioSocialLink, value: string): void {
    const updated = socialLinks.map((link, i) =>
      i === index ? { ...link, [field]: value } : link
    )
    onChange(updated)
  }

  /**
   * Supprime le lien social à l'index donné.
   *
   * @param index - Position dans le tableau à supprimer
   */
  function handleRemove(index: number): void {
    onChange(socialLinks.filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-foreground">Réseaux sociaux</h3>
      <p className="text-xs text-muted-foreground">
        Icônes affichées en bas de votre page Bio Link.
      </p>

      {/* ── Liste des liens existants ────────────────────────────────── */}
      <div className="space-y-2">
        {socialLinks.map((link, index) => (
          <div key={index} className="flex items-center gap-2 min-w-0">
            {/* Sélecteur de plateforme */}
            <select
              value={link.platform}
              onChange={(e) => handleUpdate(index, 'platform', e.target.value)}
              className="h-9 w-24 shrink-0 rounded-md border border-input bg-background px-2 text-sm"
            >
              {SOCIAL_PLATFORMS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>

            {/* Couleur personnalisée de l'icône */}
            <input
              type="color"
              value={link.color ?? '#6b7280'}
              onChange={(e) => handleUpdate(index, 'color', e.target.value)}
              className="size-8 cursor-pointer rounded border border-input bg-transparent p-0.5 shrink-0"
              title="Couleur de l'icône"
            />

            {/* URL du profil */}
            <Input
              value={link.url}
              onChange={(e) => handleUpdate(index, 'url', e.target.value)}
              placeholder="https://instagram.com/monpseudo"
              className="flex-1 min-w-0"
            />

            {/* Bouton supprimer */}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => handleRemove(index)}
              className="shrink-0 text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        ))}
      </div>

      {/* ── Bouton ajouter ───────────────────────────────────────────── */}
      {socialLinks.length < 10 && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleAdd}
        >
          <Plus className="size-4 mr-1" />
          Ajouter un réseau
        </Button>
      )}
    </div>
  )
}
