/**
 * @file modules/biolink/components/BioPageEditor/ProfileSection.tsx
 * @module biolink
 * @description Section profil de l'éditeur Bio Link.
 *   Permet de configurer le slug (URL publique), le titre, la bio et l'avatar.
 *   Les champs sont contrôlés par le formulaire parent (react-hook-form).
 *
 * @example
 *   <ProfileSection
 *     slug={slug}
 *     title={title}
 *     bio={bio}
 *     onSlugChange={setSlug}
 *     onTitleChange={setTitle}
 *     onBioChange={setBio}
 *   />
 */

'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

// ─── Props ────────────────────────────────────────────────────────────────────

interface ProfileSectionProps {
  /** Slug actuel de l'URL publique */
  slug: string
  /** Titre affiché en haut de la page */
  title: string
  /** Description courte sous le titre */
  bio: string
  /** Callback de changement du slug */
  onSlugChange: (value: string) => void
  /** Callback de changement du titre */
  onTitleChange: (value: string) => void
  /** Callback de changement de la bio */
  onBioChange: (value: string) => void
}

// ─── Composant ────────────────────────────────────────────────────────────────

/**
 * Section de configuration du profil dans l'éditeur Bio Link.
 * Champs : slug (URL publique), titre, bio courte.
 *
 * @param slug      - Slug actuel
 * @param title     - Titre actuel
 * @param bio       - Bio actuelle
 * @param onSlugChange  - Setter du slug
 * @param onTitleChange - Setter du titre
 * @param onBioChange   - Setter de la bio
 * @returns Section formulaire avec 3 champs
 */
export function ProfileSection({
  slug,
  title,
  bio,
  onSlugChange,
  onTitleChange,
  onBioChange,
}: ProfileSectionProps): React.JSX.Element {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-foreground">Profil</h3>

      {/* ── Slug (URL publique) ───────────────────────────────────────── */}
      <div className="space-y-2">
        <Label htmlFor="bio-slug">URL publique</Label>
        <div className="flex items-center gap-1 min-w-0">
          <span className="text-sm text-muted-foreground whitespace-nowrap">
            ogolong.com/u/
          </span>
          <Input
            id="bio-slug"
            value={slug}
            onChange={(e) => onSlugChange(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
            placeholder="mon-pseudo"
            className="flex-1 min-w-0"
            maxLength={30}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Lettres minuscules, chiffres et tirets uniquement (3–30 caractères)
        </p>
      </div>

      {/* ── Titre ─────────────────────────────────────────────────────── */}
      <div className="space-y-2">
        <Label htmlFor="bio-title">Titre</Label>
        <Input
          id="bio-title"
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder="Mon Pseudo"
          maxLength={100}
        />
      </div>

      {/* ── Bio ───────────────────────────────────────────────────────── */}
      <div className="space-y-2">
        <Label htmlFor="bio-desc">Bio</Label>
        <Textarea
          id="bio-desc"
          value={bio}
          onChange={(e) => onBioChange(e.target.value)}
          placeholder="Créateur de contenu, photographe..."
          maxLength={300}
          rows={3}
        />
        <p className="text-xs text-muted-foreground text-right">
          {bio.length}/300
        </p>
      </div>
    </div>
  )
}
