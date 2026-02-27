/**
 * @file modules/media/components/ImageEditorDialog.tsx
 * @module media
 * @description Dialog d'édition d'image avec Filerobot Image Editor.
 *
 *   Fonctionnement interne :
 *   1. L'utilisateur clique ✏️ sur une image → `open` passe à true
 *   2. FilerobotImageEditor s'ouvre avec l'image source (URL Supabase)
 *   3. L'utilisateur édite (recadrage, filtres, annotations…)
 *   4. L'utilisateur clique "Sauvegarder" → `onModify` de Filerobot est déclenché
 *   5. On récupère `imageBase64` → convertit en Blob → POST /api/gallery/upload-url
 *   6. PUT du Blob vers le presigned URL Supabase
 *   7. On appelle `onSave(publicUrl)` → le parent remplace l'ancienne URL
 *
 *   IMPORTANT : Filerobot utilise Canvas API → chargement dynamique `ssr: false`
 *   pour éviter les erreurs Node.js (Canvas n'est pas disponible côté serveur).
 *
 * @example
 *   <ImageEditorDialog
 *     sourceUrl="https://…/photo.jpg"
 *     open={editorOpen}
 *     onOpenChange={setEditorOpen}
 *     onSave={(newUrl) => { updateMediaUrl(newUrl) }}
 *   />
 */

'use client'

import dynamic from 'next/dynamic'
import { useCallback, useState } from 'react'

// Chargement dynamique SANS SSR — Filerobot utilise Canvas API (non disponible côté serveur)
const FilerobotImageEditor = dynamic(
  () => import('react-filerobot-image-editor'),
  {
    ssr: false,
    // Skeleton pendant le chargement du bundle Filerobot
    loading: () => (
      <div className="flex h-[60vh] items-center justify-center rounded-lg bg-muted">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    ),
  },
)

// ─── Props ────────────────────────────────────────────────────────────────────

interface ImageEditorDialogProps {
  /** URL Supabase publique de l'image à éditer */
  sourceUrl: string
  /** Contrôle l'ouverture du dialog */
  open: boolean
  /** Callback pour ouvrir/fermer le dialog */
  onOpenChange: (open: boolean) => void
  /**
   * Callback appelé avec la nouvelle URL Supabase après re-upload de l'image éditée.
   * Peut être async (ex: mise à jour DB + état parent).
   */
  onSave: (newUrl: string) => Promise<void>
}

// ─── Composant ────────────────────────────────────────────────────────────────

/**
 * Dialog d'édition d'image plein écran (Filerobot Image Editor).
 * Charge le bundle Filerobot côté client uniquement (ssr: false).
 */
export function ImageEditorDialog({
  sourceUrl,
  open,
  onOpenChange,
  onSave,
}: ImageEditorDialogProps): React.JSX.Element | null {
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  /**
   * Callback déclenché par Filerobot lorsque l'utilisateur clique "Sauvegarder".
   * Convertit le base64 en Blob, uploade vers Supabase, appelle onSave().
   *
   * @param savedImageData - Objet Filerobot avec imageBase64, fullName (premier paramètre)
   */
  const handleSave = useCallback(
    async (savedImageData: { imageBase64?: string; fullName?: string }): Promise<void> => {
      if (!savedImageData.imageBase64) {
        setSaveError("Impossible de récupérer l'image éditée")
        return
      }

      setIsSaving(true)
      setSaveError(null)

      try {
        // ── 1. Convertir base64 en Blob ───────────────────────────────────
        const blob = await fetch(savedImageData.imageBase64).then((r) => r.blob())
        const filename = savedImageData.fullName ?? 'edited-image.jpg'
        const mimeType = blob.type || 'image/jpeg'

        // ── 2. Obtenir le presigned URL pour la galerie ────────────────────
        const urlRes = await fetch('/api/gallery/upload-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename, mimeType, size: blob.size }),
        })

        if (!urlRes.ok) throw new Error("Impossible d'obtenir l'URL d'upload")

        const { signedUrl, publicUrl } = (await urlRes.json()) as {
          signedUrl: string
          publicUrl: string
        }

        // ── 3. Upload du Blob vers Supabase via XHR (pas de progression ici) ──
        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest()

          xhr.addEventListener('load', () => {
            xhr.status >= 200 && xhr.status < 300
              ? resolve()
              : reject(new Error(`Upload échoué : ${xhr.status}`))
          })
          xhr.addEventListener('error', () =>
            reject(new Error("Erreur réseau lors de l'upload")),
          )

          xhr.open('PUT', signedUrl)
          xhr.setRequestHeader('Content-Type', mimeType)
          xhr.send(blob)
        })

        // ── 4. Appeler le callback parent avec la nouvelle URL ─────────────
        await onSave(publicUrl)
      } catch (err) {
        console.error('[ImageEditorDialog] Erreur lors de la sauvegarde :', err)
        setSaveError(
          err instanceof Error
            ? err.message
            : "Erreur lors de la sauvegarde de l'image",
        )
      } finally {
        setIsSaving(false)
      }
    },
    [onSave],
  )

  // Ne rien rendre si le dialog est fermé
  if (!open) return null

  return (
    // Overlay plein écran avec z-index élevé (au-dessus des autres dialogs)
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      {/* ── Barre d'en-tête ────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between border-b px-4 py-2">
        <h2 className="text-sm font-semibold">Modifier l&apos;image</h2>
        <div className="flex items-center gap-2">
          {/* Indicateur de sauvegarde en cours */}
          {isSaving && (
            <span className="text-xs text-muted-foreground">Sauvegarde…</span>
          )}
          {/* Bouton fermer */}
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
            className="rounded-md px-3 py-1 text-sm text-muted-foreground hover:bg-muted disabled:opacity-50"
          >
            Annuler
          </button>
        </div>
      </div>

      {/* ── Message d'erreur ───────────────────────────────────────────────── */}
      {saveError && (
        <div className="border-b bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {saveError}
        </div>
      )}

      {/* ── Éditeur Filerobot ──────────────────────────────────────────────── */}
      <div className="flex-1 overflow-hidden">
        <FilerobotImageEditor
          source={sourceUrl}
          // Désactiver la fermeture automatique (on gère nous-mêmes via onOpenChange)
          onClose={() => onOpenChange(false)}
          // Callback déclenché au clic "Sauvegarder" dans l'UI Filerobot.
          // Premier argument : savedImageData (avec imageBase64, fullName, etc.)
          onSave={(savedImageData) => {
            void handleSave(savedImageData)
          }}
          // Fermer après sauvegarde — géré par notre onSave qui appelle onOpenChange(false)
          closeAfterSave={false}
          // Langue de l'interface Filerobot
          language="fr"
          // Tabs actifs : recadrage, filtres, ajustements, annotations, redimensionnement
          // Utilisation de `tabsIds` (prop correcte) et non `tabs`
          tabsIds={['Adjust', 'Annotate', 'Finetune', 'Filters', 'Resize', 'Rotate']}
          // Outil actif par défaut au chargement
          defaultTabId="Adjust"
          defaultToolId="Crop"
          savingPixelRatio={3}
          previewPixelRatio={window.devicePixelRatio}
        />
      </div>
    </div>
  )
}
