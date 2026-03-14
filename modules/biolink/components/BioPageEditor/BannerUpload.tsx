/**
 * @file modules/biolink/components/BioPageEditor/BannerUpload.tsx
 * @module biolink
 * @description Zone d'upload de banniere pour l'editeur Bio Link.
 *   Permet de configurer l'image banniere affichee en haut de la page publique
 *   via un drag & drop ou un bouton d'import. Utilise le composant `ImageDropZone`
 *   qui gere l'upload presigned URL vers Supabase Storage, l'apercu (ratio 16/5)
 *   et la suppression.
 *
 * @example
 *   <BannerUpload
 *     bannerUrl="https://example.com/banner.jpg"
 *     onChange={(url) => setBannerUrl(url)}
 *   />
 */

'use client'

import { ImageDropZone } from './ImageDropZone'

// --- Props --------------------------------------------------------------------

interface BannerUploadProps {
  /** URL de la banniere actuelle (null si aucune) */
  bannerUrl: string | null
  /** Callback de changement de l'URL (null pour supprimer la banniere) */
  onChange: (url: string | null) => void
}

// --- Composant ----------------------------------------------------------------

/**
 * Section d'upload de banniere avec drag & drop, apercu et suppression.
 * Delegue entierement le workflow d'upload a `ImageDropZone`.
 *
 * @param bannerUrl - URL actuelle de la banniere
 * @param onChange  - Setter de l'URL (null = suppression)
 * @returns Section avec titre + zone drag & drop (ratio 16/5)
 */
export function BannerUpload({ bannerUrl, onChange }: BannerUploadProps): React.JSX.Element {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-foreground">Banniere</h3>

      {/* Zone drag & drop avec apercu en ratio 16/5 */}
      <ImageDropZone
        value={bannerUrl}
        onChange={onChange}
        aspectRatio="16/5"
        placeholder="Glissez votre banniere ici"
        recommended="1600x500 px (ratio 16:5)"
      />
    </div>
  )
}
