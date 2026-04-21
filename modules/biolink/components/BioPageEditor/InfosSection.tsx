/**
 * @file modules/biolink/components/BioPageEditor/InfosSection.tsx
 * @module biolink/components/BioPageEditor
 * @description Section "Infos" de l'éditeur de BioPage.
 *
 *   Champs éditables :
 *   - title     : textarea 2 lignes (séparateur `\n` → ligne 2 italique en rendu)
 *   - bio       : textarea ≤ 300 chars (baseline uppercase dans le template)
 *   - handle    : input ≤ 30 chars (optionnel, fallback à `@{slug}`)
 *   - tagline   : textarea ≤ 200 chars (optionnelle, desktop uniquement)
 *   - slug      : input avec vérification de disponibilité debounced 500ms
 *                 (badge vert ✓ si dispo, rouge ✗ sinon)
 *   - avatarUrl : upload via presigned URL Supabase (hook useBioAvatarUpload)
 *
 *   Stratégie de save : bouton "Enregistrer" global qui persiste les champs
 *   texte (title/bio/handle/tagline) d'un coup. Le slug et l'avatar ont des
 *   actions dédiées pour gérer leurs cas particuliers (unicité, upload binaire).
 *
 * @example
 *   <InfosSection
 *     bioPageId={bioPage.id}
 *     initialData={{ title, bio, handle, tagline, slug, avatarUrl }}
 *     onMutation={() => router.refresh()}
 *   />
 */

'use client'

import { Check, Loader2, Upload, X } from 'lucide-react'
import Image from 'next/image'
import { useEffect, useRef, useState, useTransition } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { checkSlugAvailability } from '@/modules/biolink/actions/check-slug-availability.action'
import { updateBioPage } from '@/modules/biolink/actions/update-biopage.action'
import { updateBioPageSlug } from '@/modules/biolink/actions/update-biopage-slug.action'
import { useBioAvatarUpload } from '@/modules/biolink/hooks/useBioAvatarUpload'

// ─── Types ───────────────────────────────────────────────────────────────────

/** Données initiales passées à la section — fournies par le parent Server Component. */
export interface InfosSectionInitialData {
  title: string | null
  bio: string | null
  handle: string | null
  tagline: string | null
  slug: string
  avatarUrl: string | null
}

interface InfosSectionProps {
  /** Données initiales (charge le form depuis la DB au premier render) */
  initialData: InfosSectionInitialData
  /** Callback déclenché après une mutation réussie — typiquement router.refresh() */
  onMutation: () => void
}

// ─── Constantes ──────────────────────────────────────────────────────────────

/** Délai (ms) entre la dernière frappe et l'appel de check-slug-availability */
const SLUG_DEBOUNCE_MS = 500

/** Caractères max par champ (miroir côté serveur — voir biopage.schema.ts) */
const MAX_TITLE = 100
const MAX_BIO = 300
const MAX_HANDLE = 30
const MAX_TAGLINE = 200

// ─── Composant ───────────────────────────────────────────────────────────────

/**
 * Section Infos de l'éditeur. Gère les champs textuels, le slug et l'avatar.
 * Toutes les mutations passent par les Server Actions du module biolink —
 * ce composant n'accède jamais directement à la DB.
 *
 * @returns Card contenant le formulaire Infos
 */
export function InfosSection({
  initialData,
  onMutation,
}: InfosSectionProps): React.JSX.Element {
  // ── État local du formulaire ─────────────────────────────────────────────
  const [title, setTitle] = useState<string>(initialData.title ?? '')
  const [bio, setBio] = useState<string>(initialData.bio ?? '')
  const [handle, setHandle] = useState<string>(initialData.handle ?? '')
  const [tagline, setTagline] = useState<string>(initialData.tagline ?? '')
  const [slug, setSlug] = useState<string>(initialData.slug)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initialData.avatarUrl)

  // Slug actuellement persisté — sert de référence pour activer le bouton save
  const persistedSlug = useRef<string>(initialData.slug)

  // État de check slug : idle | checking | available | taken | invalid
  type SlugStatus = 'idle' | 'checking' | 'available' | 'taken' | 'invalid'
  const [slugStatus, setSlugStatus] = useState<SlugStatus>('idle')
  const [slugError, setSlugError] = useState<string | null>(null)

  const [isSavingInfos, startSavingInfos] = useTransition()
  const [isSavingSlug, startSavingSlug] = useTransition()

  // Hook d'upload — gère presigned URL + PUT
  const { upload, uploading: isUploading } = useBioAvatarUpload()
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  // ── Debounce pour checkSlugAvailability ─────────────────────────────────
  // On stocke un ID de timeout pour pouvoir l'annuler à chaque nouvelle frappe.
  useEffect(() => {
    // Si le slug n'a pas changé par rapport à ce qui est en DB → pas de check
    if (slug === persistedSlug.current) {
      setSlugStatus('idle')
      setSlugError(null)
      return
    }

    // Champ vide → rien à checker (on laisse la UI neutre, le save sera refusé)
    if (slug.trim() === '') {
      setSlugStatus('idle')
      setSlugError(null)
      return
    }

    setSlugStatus('checking')
    setSlugError(null)

    const timeoutId = setTimeout(async () => {
      const res = await checkSlugAvailability(slug)
      if (res.available) {
        setSlugStatus('available')
        setSlugError(null)
      } else if (res.error) {
        // error = format invalide (regex / longueur) → pas de message "pris"
        setSlugStatus('invalid')
        setSlugError(res.error)
      } else {
        setSlugStatus('taken')
        setSlugError('Ce slug est déjà pris')
      }
    }, SLUG_DEBOUNCE_MS)

    // Cleanup — si l'user retape avant la fin du timeout, on l'annule.
    return () => clearTimeout(timeoutId)
  }, [slug])

  // ── Handlers ────────────────────────────────────────────────────────────

  /**
   * Enregistre les champs textuels (title, bio, handle, tagline) en un seul
   * appel Server Action. Le slug et l'avatar ont leurs propres actions.
   *
   * Convention de reset (null vs undefined) :
   * - `title` est NOT NULL en DB → toujours string (refus si vide côté Zod).
   * - Les autres champs optionnels vidés en UI → envoyés en `null` pour
   *   que Prisma écrive explicitement `NULL` dans la colonne (reset volontaire).
   *   Sans ça (avec `undefined`), Prisma ignorerait simplement la clé et la
   *   valeur précédente resterait en DB — l'user ne pourrait plus vider un
   *   champ une fois rempli.
   */
  const handleSaveInfos = (): void => {
    startSavingInfos(async () => {
      const res = await updateBioPage({
        title: title.trim(),
        bio: bio.trim() === '' ? null : bio.trim(),
        handle: handle.trim() === '' ? null : handle.trim(),
        tagline: tagline.trim() === '' ? null : tagline.trim(),
      })
      if (!res.success) {
        toast.error(res.error)
        return
      }
      toast.success('Infos enregistrées')
      onMutation()
    })
  }

  /**
   * Enregistre le slug (action dédiée pour gérer P2002 en français).
   * Appelée via un bouton séparé car le slug est "sensible" — on évite
   * de le modifier en même temps que les autres champs.
   */
  const handleSaveSlug = (): void => {
    startSavingSlug(async () => {
      const res = await updateBioPageSlug(slug)
      if (!res.success) {
        toast.error(res.error)
        return
      }
      persistedSlug.current = res.data.slug
      setSlug(res.data.slug)
      setSlugStatus('idle')
      setSlugError(null)
      toast.success('Slug mis à jour')
      onMutation()
    })
  }

  /**
   * Gère la sélection d'un fichier image pour l'avatar. Upload via hook,
   * puis persiste l'URL via updateBioPage({ avatarUrl }).
   */
  const handleAvatarChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ): Promise<void> => {
    const file = event.target.files?.[0]
    if (!file) return

    // Étape 1 : upload Supabase → publicUrl
    const uploadRes = await upload(file)
    if ('error' in uploadRes) {
      toast.error(uploadRes.error)
      // Reset input pour permettre de re-sélectionner le même fichier après correction
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    // Étape 2 : persister l'URL publique dans la BioPage
    const persistRes = await updateBioPage({ avatarUrl: uploadRes.publicUrl })
    if (!persistRes.success) {
      toast.error(persistRes.error)
      return
    }

    setAvatarUrl(uploadRes.publicUrl)
    toast.success('Avatar mis à jour')
    onMutation()

    // Reset input pour pouvoir réuploader le même fichier plus tard
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // ── Rendu ───────────────────────────────────────────────────────────────

  // Active ou non le bouton Enregistrer pour le slug
  const canSaveSlug =
    slug !== persistedSlug.current && slugStatus === 'available' && !isSavingSlug

  return (
    <Card>
      <CardHeader>
        <CardTitle>Infos</CardTitle>
        <CardDescription>
          Ces informations apparaissent en haut de votre page publique.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* ── Avatar ─────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-4">
          {avatarUrl ? (
            // `next/image` optimise automatiquement via `images.remotePatterns`
            // dans next.config.ts (domaine Supabase Storage autorisé).
            <Image
              src={avatarUrl}
              alt="Avatar"
              width={64}
              height={64}
              className="size-16 rounded-full object-cover border"
            />
          ) : (
            <div className="flex size-16 items-center justify-center rounded-full border bg-muted text-muted-foreground">
              <Upload className="size-5" />
            </div>
          )}

          <div className="flex-1">
            <Label className="mb-1 block">Avatar</Label>
            <p className="text-xs text-muted-foreground mb-2">
              Format JPG/PNG/WebP · max 5 Mo
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isUploading}
              onClick={() => fileInputRef.current?.click()}
            >
              {isUploading ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Upload en cours...
                </>
              ) : (
                <>
                  <Upload className="size-4" />
                  Changer l&apos;avatar
                </>
              )}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarChange}
            />
          </div>
        </div>

        {/* ── Titre (avec retour ligne pour l'italique) ─────────────────── */}
        <div className="space-y-2">
          <Label htmlFor="bio-title">
            Titre <span className="text-muted-foreground">(retour ligne pour l&apos;italique)</span>
          </Label>
          <Textarea
            id="bio-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            rows={2}
            maxLength={MAX_TITLE}
            placeholder="Mimi&#10;Sara"
          />
          <p className="text-xs text-muted-foreground">
            {title.length} / {MAX_TITLE}
          </p>
        </div>

        {/* ── Bio courte ────────────────────────────────────────────────── */}
        <div className="space-y-2">
          <Label htmlFor="bio-desc">Bio courte</Label>
          <Textarea
            id="bio-desc"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={2}
            maxLength={MAX_BIO}
            placeholder="Auteure · Entrepreneure · Camerounaise"
          />
          <p className="text-xs text-muted-foreground">
            {bio.length} / {MAX_BIO}
          </p>
        </div>

        {/* ── Handle (sans @) ────────────────────────────────────────────── */}
        <div className="space-y-2">
          <Label htmlFor="bio-handle">Handle (sans le @)</Label>
          <Input
            id="bio-handle"
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
            maxLength={MAX_HANDLE}
            placeholder="mimimaze"
          />
          <p className="text-xs text-muted-foreground">
            Si vide, on utilise <code>@{slug}</code> par défaut.
          </p>
        </div>

        {/* ── Tagline (desktop only) ─────────────────────────────────────── */}
        <div className="space-y-2">
          <Label htmlFor="bio-tagline">
            Tagline <span className="text-muted-foreground">(desktop uniquement)</span>
          </Label>
          <Textarea
            id="bio-tagline"
            value={tagline}
            onChange={(e) => setTagline(e.target.value)}
            rows={2}
            maxLength={MAX_TAGLINE}
            placeholder="Retrouvez ici mes projets, livres et inspirations."
          />
          <p className="text-xs text-muted-foreground">
            {tagline.length} / {MAX_TAGLINE}
          </p>
        </div>

        {/* Bouton save global pour les champs texte */}
        <div className="flex justify-end">
          <Button type="button" onClick={handleSaveInfos} disabled={isSavingInfos}>
            {isSavingInfos ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Enregistrement...
              </>
            ) : (
              'Enregistrer les infos'
            )}
          </Button>
        </div>

        {/* ── Slug — section dédiée ──────────────────────────────────────── */}
        <div className="space-y-2 border-t pt-6">
          <Label htmlFor="bio-slug">
            URL personnalisée <span className="text-muted-foreground">(3-30 lettres/chiffres/tirets)</span>
          </Label>

          <div className="flex items-center gap-2">
            {/* Préfixe visuel — pas un input, juste du texte */}
            <span className="text-sm text-muted-foreground font-mono whitespace-nowrap">
              socialtdl.net/u/
            </span>
            <div className="relative flex-1">
              <Input
                id="bio-slug"
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase())}
                placeholder="mon-slug"
                className="pr-9 font-mono"
              />
              {/* Badge de statut à droite du champ */}
              <div className="absolute right-2 top-1/2 -translate-y-1/2">
                {slugStatus === 'checking' && (
                  <Loader2 className="size-4 animate-spin text-muted-foreground" />
                )}
                {slugStatus === 'available' && (
                  <Check className="size-4 text-emerald-600" />
                )}
                {(slugStatus === 'taken' || slugStatus === 'invalid') && (
                  <X className="size-4 text-red-600" />
                )}
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={handleSaveSlug}
              disabled={!canSaveSlug}
            >
              {isSavingSlug ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                </>
              ) : (
                'Mettre à jour'
              )}
            </Button>
          </div>
          {slugError && (
            <p className="text-xs text-red-600">{slugError}</p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
