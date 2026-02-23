/**
 * @file modules/auth/components/ProfileForm.tsx
 * @module auth
 * @description Formulaire d'édition du profil utilisateur.
 *
 *   Sections :
 *   1. Photo de profil — avatar cliquable avec upload direct Supabase Storage
 *      via /api/user/avatar (presigned URL) + Server Action updateAvatarUrl
 *   2. Informations — nom complet + email (lecture seule) + description
 *
 *   Architecture :
 *   - Client Component : gestion des états (upload, sauvegarde, erreurs)
 *   - Server Action `updateProfile` : validation Zod + Prisma (nom + description)
 *   - Server Action `updateAvatarUrl` : persistance URL avatar après upload
 *
 *   Upload avatar :
 *   1. Clic sur l'avatar → input[type=file] masqué
 *   2. Sélection → validation client (type MIME + taille max 5 Mo)
 *   3. POST /api/user/avatar → { signedUrl, publicUrl }
 *   4. PUT signedUrl (upload direct navigateur → Supabase Storage)
 *   5. updateAvatarUrl(publicUrl) → persistance en DB
 *   6. Mise à jour optimiste de l'avatar dans l'UI
 *
 * @example
 *   // Dans app/(dashboard)/profile/page.tsx (Server Component)
 *   <ProfileForm profile={profile} />
 */

'use client'

import { useQueryClient } from '@tanstack/react-query'
import { Camera, Loader2, Save } from 'lucide-react'
import { useRef, useState } from 'react'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { updateAvatarUrl, updateProfile } from '@/modules/auth/actions/update-profile.action'

// ─── Types ────────────────────────────────────────────────────────────────────

/** Profil complet tel que récupéré depuis la DB (Server Component parent) */
export interface UserProfile {
  id: string
  name: string | null
  email: string
  avatarUrl: string | null
  image: string | null       // Photo OAuth Google
  description: string | null
}

interface ProfileFormProps {
  /** Profil initial passé par le Server Component parent */
  profile: UserProfile
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Taille max autorisée pour l'avatar : 5 Mo */
const MAX_AVATAR_SIZE = 5 * 1024 * 1024

/** Types MIME autorisés pour les avatars */
const AVATAR_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

/**
 * Calcule les initiales de l'utilisateur pour le fallback de l'avatar.
 *
 * @param name  - Nom complet (peut être null)
 * @param email - Email (toujours présent)
 * @returns Initiale en majuscule
 */
function getInitials(name: string | null, email: string): string {
  if (name?.trim()) return name.trim()[0].toUpperCase()
  return email[0].toUpperCase()
}

// ─── Composant ────────────────────────────────────────────────────────────────

/**
 * Formulaire d'édition du profil utilisateur.
 * Gère l'upload d'avatar et la mise à jour des informations personnelles.
 *
 * @param profile - Données initiales du profil (depuis la DB côté serveur)
 */
export function ProfileForm({ profile }: ProfileFormProps): React.JSX.Element {
  // ── QueryClient — pour invalider le cache UserMenu après upload avatar ─────
  const queryClient = useQueryClient()

  // ── États du formulaire ───────────────────────────────────────────────────
  const [name, setName] = useState(profile.name ?? '')
  const [description, setDescription] = useState(profile.description ?? '')

  // ── État de l'avatar ──────────────────────────────────────────────────────
  // Source d'affichage : avatarUrl uploadé > image OAuth > null (fallback initiales)
  const [avatarSrc, setAvatarSrc] = useState<string | null>(
    profile.avatarUrl ?? profile.image ?? null,
  )

  // ── États de chargement ───────────────────────────────────────────────────
  const [isSaving, setIsSaving] = useState(false)
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)

  // ── Messages de feedback ──────────────────────────────────────────────────
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [avatarError, setAvatarError] = useState<string | null>(null)

  // ── Référence vers l'input file masqué ───────────────────────────────────
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── Compteur de caractères (description) ─────────────────────────────────
  const descCharCount = description.length
  const DESC_MAX = 500
  const isDescOver = descCharCount > DESC_MAX

  // ── Upload d'avatar ───────────────────────────────────────────────────────

  /**
   * Déclenche l'ouverture du sélecteur de fichier.
   * Réinitialise la valeur de l'input pour permettre de re-sélectionner le même fichier.
   */
  const handleAvatarClick = (): void => {
    setAvatarError(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
      fileInputRef.current.click()
    }
  }

  /**
   * Gère la sélection d'un fichier image pour l'avatar.
   * Valide le type MIME et la taille, puis lance l'upload vers Supabase Storage.
   */
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = e.target.files?.[0]
    if (!file) return

    // ── Validation client ──────────────────────────────────────────────────
    if (!AVATAR_MIME_TYPES.includes(file.type)) {
      setAvatarError('Format non supporté. Utilisez JPEG, PNG, WebP ou GIF.')
      return
    }
    if (file.size > MAX_AVATAR_SIZE) {
      setAvatarError('Image trop lourde (max 5 Mo).')
      return
    }

    setIsUploadingAvatar(true)
    setAvatarError(null)

    try {
      // ── Étape 1 : obtenir le presigned URL ──────────────────────────────
      const res = await fetch('/api/user/avatar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: file.name, contentType: file.type }),
      })

      if (!res.ok) {
        const err = (await res.json()) as { error?: string }
        throw new Error(err.error ?? 'Erreur lors de la génération de l\'URL')
      }

      const { signedUrl, publicUrl } = (await res.json()) as {
        signedUrl: string
        publicUrl: string
      }

      // ── Étape 2 : upload direct vers Supabase Storage ──────────────────
      const uploadRes = await fetch(signedUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      })

      if (!uploadRes.ok) {
        throw new Error('Échec de l\'upload vers Supabase Storage')
      }

      // ── Étape 3 : mise à jour optimiste de l'UI ───────────────────────
      setAvatarSrc(publicUrl)

      // ── Étape 4 : persistance en DB via Server Action ──────────────────
      const result = await updateAvatarUrl(publicUrl)
      if (!result.success) {
        throw new Error(result.error ?? 'Erreur lors de la sauvegarde')
      }

      // ── Étape 5 : invalider le cache ['user', 'me'] du UserMenu ────────
      // Force le UserMenu à refetcher immédiatement pour afficher le nouvel avatar
      await queryClient.invalidateQueries({ queryKey: ['user', 'me'] })
    } catch (err) {
      console.error('[ProfileForm] Erreur upload avatar :', err)
      setAvatarError(err instanceof Error ? err.message : 'Erreur lors de l\'upload')
    } finally {
      setIsUploadingAvatar(false)
    }
  }

  // ── Sauvegarde du profil ──────────────────────────────────────────────────

  /**
   * Soumet le formulaire via la Server Action updateProfile.
   * Affiche un message de succès ou d'erreur selon le résultat.
   */
  const handleSave = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (isSaving) return

    setIsSaving(true)
    setSaveMessage(null)

    const result = await updateProfile({ name, description: description || undefined })

    if (result.success) {
      setSaveMessage({ type: 'success', text: 'Profil mis à jour avec succès !' })
    } else {
      setSaveMessage({ type: 'error', text: result.error ?? 'Erreur lors de la sauvegarde' })
    }

    setIsSaving(false)

    // Effacer le message de succès après 4 secondes
    if (result.success) {
      setTimeout(() => setSaveMessage(null), 4000)
    }
  }

  return (
    <form onSubmit={(e) => void handleSave(e)} className="space-y-8">

      {/* ── Section : Photo de profil ─────────────────────────────────────── */}
      <div className="rounded-xl border border-border bg-card p-6">
        <h2 className="text-sm font-semibold text-foreground">Photo de profil</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          JPEG, PNG, WebP ou GIF — 5 Mo maximum.
        </p>

        <div className="mt-5 flex items-center gap-5">
          {/* Avatar cliquable — déclenche le sélecteur de fichier */}
          <button
            type="button"
            onClick={handleAvatarClick}
            disabled={isUploadingAvatar}
            className="group relative shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            aria-label="Changer la photo de profil"
          >
            <Avatar className="size-20 border-2 border-border">
              {avatarSrc && <AvatarImage src={avatarSrc} alt="Photo de profil" />}
              <AvatarFallback className="text-xl font-semibold">
                {getInitials(name || profile.name, profile.email)}
              </AvatarFallback>
            </Avatar>

            {/* Overlay "changer" au hover ou pendant l'upload */}
            <div className={[
              'absolute inset-0 flex flex-col items-center justify-center rounded-full',
              'bg-black/50 text-white transition-opacity',
              isUploadingAvatar ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
            ].join(' ')}>
              {isUploadingAvatar ? (
                <Loader2 className="size-6 animate-spin" />
              ) : (
                <>
                  <Camera className="size-5" />
                  <span className="mt-0.5 text-[10px] font-medium">Changer</span>
                </>
              )}
            </div>
          </button>

          {/* Input file masqué — déclenché par le bouton avatar */}
          <input
            ref={fileInputRef}
            type="file"
            accept={AVATAR_MIME_TYPES.join(',')}
            className="sr-only"
            onChange={(e) => void handleFileChange(e)}
            aria-label="Sélectionner une photo de profil"
          />

          <div className="space-y-1.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAvatarClick}
              disabled={isUploadingAvatar}
              className="gap-2"
            >
              {isUploadingAvatar ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Camera className="size-3.5" />
              )}
              {isUploadingAvatar ? 'Upload en cours…' : 'Changer la photo'}
            </Button>

            {/* Message d'erreur upload */}
            {avatarError && (
              <p className="text-xs text-destructive">{avatarError}</p>
            )}
          </div>
        </div>
      </div>

      {/* ── Section : Informations personnelles ──────────────────────────── */}
      <div className="rounded-xl border border-border bg-card p-6">
        <h2 className="text-sm font-semibold text-foreground">Informations personnelles</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Ces informations sont utilisées dans tes communications.
        </p>

        <div className="mt-6 space-y-5">

          {/* Nom complet */}
          <div className="space-y-1.5">
            <Label htmlFor="name">Nom complet</Label>
            <Input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ton prénom et nom"
              maxLength={100}
              required
              autoComplete="name"
            />
          </div>

          {/* Email — lecture seule */}
          <div className="space-y-1.5">
            <Label htmlFor="email">Adresse e-mail</Label>
            <Input
              id="email"
              type="email"
              value={profile.email}
              readOnly
              disabled
              className="cursor-not-allowed opacity-60"
              autoComplete="email"
            />
            <p className="text-xs text-muted-foreground">
              L&apos;adresse e-mail ne peut pas être modifiée pour l&apos;instant.
            </p>
          </div>

          {/* Description / Bio */}
          <div className="space-y-1.5">
            <div className="flex items-baseline justify-between">
              <Label htmlFor="description">Description</Label>
              {/* Compteur de caractères */}
              <span className={[
                'text-xs tabular-nums',
                isDescOver ? 'text-destructive font-medium' : 'text-muted-foreground',
              ].join(' ')}>
                {descCharCount} / {DESC_MAX}
              </span>
            </div>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Quelques mots sur toi — créateur de contenu, niche, plateformes…"
              rows={4}
              maxLength={DESC_MAX + 50} // +50 pour laisser la validation Zod gérer
              className="resize-none"
            />
          </div>

        </div>
      </div>

      {/* ── Footer : message de feedback + bouton sauvegarder ─────────────── */}
      <div className="flex items-center justify-between gap-4">
        {/* Message succès / erreur */}
        {saveMessage ? (
          <p className={[
            'text-sm',
            saveMessage.type === 'success' ? 'text-green-600 dark:text-green-400' : 'text-destructive',
          ].join(' ')}>
            {saveMessage.text}
          </p>
        ) : (
          <div />
        )}

        <Button
          type="submit"
          disabled={isSaving || isDescOver}
          className="gap-2"
        >
          {isSaving ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Save className="size-4" />
          )}
          {isSaving ? 'Sauvegarde…' : 'Enregistrer'}
        </Button>
      </div>

    </form>
  )
}
