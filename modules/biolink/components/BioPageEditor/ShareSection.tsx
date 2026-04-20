/**
 * @file modules/biolink/components/BioPageEditor/ShareSection.tsx
 * @module biolink/components/BioPageEditor
 * @description Section "Partage" de l'éditeur de BioPage.
 *
 *   Contenu :
 *   - URL publique affichée en mono avec bouton "Copier"
 *   - Toggle `isPublished` → bascule via `toggleBioPagePublish()`
 *     (l'action refuse la publication si titre manquant ou aucun lien actif)
 *   - Bouton "Générer QR code" → utilise `qrcode` pour produire un dataURL PNG
 *     affiché dans un `<img>` + bouton "Télécharger"
 *   - Iframe de preview avec onglets Mobile (402px) / Desktop (100%)
 *   - Bouton "Rafraîchir la preview" (remonte l'iframe) — plus simple qu'un
 *     key dynamique global et donne le contrôle à l'user.
 *
 * @example
 *   <ShareSection
 *     slug="mimisara"
 *     isPublished={true}
 *     onMutation={() => router.refresh()}
 *   />
 */

'use client'

import { Copy, Download, Loader2, QrCode, RefreshCw } from 'lucide-react'
import QRCode from 'qrcode'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toggleBioPagePublish } from '@/modules/biolink/actions/publish-biopage.action'

// ─── Types ───────────────────────────────────────────────────────────────────

interface ShareSectionProps {
  /** Slug actuel (pour construire l'URL publique et la preview) */
  slug: string
  /** État actuel de publication — contrôle le switch */
  isPublished: boolean
  /** Callback post-mutation — typiquement router.refresh() */
  onMutation: () => void
}

// ─── Constantes ──────────────────────────────────────────────────────────────

/** Domaine utilisé dans les URLs publiques affichées à l'user */
const PUBLIC_DOMAIN = 'socialtdl.net'

/** Largeur de l'iframe en mode Mobile — reproduit un iPhone 14 Pro (402px logique) */
const MOBILE_WIDTH_PX = 402

// ─── Composant ───────────────────────────────────────────────────────────────

/**
 * Section Partage — URL, QR code, toggle publish et preview.
 *
 * @returns Card avec URL + QR + switch publish + iframe preview
 */
export function ShareSection({
  slug,
  isPublished,
  onMutation,
}: ShareSectionProps): React.JSX.Element {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [isGeneratingQr, setIsGeneratingQr] = useState<boolean>(false)
  const [isPublishing, startPublishing] = useTransition()

  // Version de l'iframe — incrémentée par le bouton "Rafraîchir"
  const [iframeKey, setIframeKey] = useState<number>(0)

  // URL publique complète (avec protocole) — utilisée par clipboard + QR
  const publicUrl = `https://${PUBLIC_DOMAIN}/u/${slug}`
  // URL affichée à l'user — sans protocole pour rester compact
  const displayUrl = `${PUBLIC_DOMAIN}/u/${slug}`
  // URL interne de la preview (inclut ?preview=1 pour bypasser isPublished)
  const previewPath = `/u/${slug}?preview=1`

  // ── Handlers ────────────────────────────────────────────────────────────

  /** Copie l'URL publique dans le presse-papier + toast */
  const handleCopy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(publicUrl)
      toast.success('Lien copié')
    } catch {
      toast.error('Impossible de copier le lien')
    }
  }

  /**
   * Génère un QR code 512×512 en PNG (dataURL) pointant vers l'URL publique.
   * Utilise la lib `qrcode` côté client — aucune requête serveur.
   */
  const handleGenerateQr = async (): Promise<void> => {
    setIsGeneratingQr(true)
    try {
      const dataUrl = await QRCode.toDataURL(publicUrl, {
        width: 512,
        margin: 2,
        errorCorrectionLevel: 'M',
      })
      setQrDataUrl(dataUrl)
    } catch (err) {
      console.error('[ShareSection] Erreur QR :', err)
      toast.error('Impossible de générer le QR code')
    } finally {
      setIsGeneratingQr(false)
    }
  }

  /** Déclenche le téléchargement du QR code en tant que PNG */
  const handleDownloadQr = (): void => {
    if (!qrDataUrl) return
    const link = document.createElement('a')
    link.href = qrDataUrl
    link.download = `${slug}-qr.png`
    link.click()
  }

  /** Bascule isPublished via Server Action (vérif titre + lien actif côté serveur) */
  const handleTogglePublish = (): void => {
    startPublishing(async () => {
      const res = await toggleBioPagePublish()
      if (!res.success) {
        toast.error(res.error)
        return
      }
      toast.success(
        res.data.isPublished ? 'Votre page est publiée' : 'Votre page est dépubliée',
      )
      onMutation()
    })
  }

  /** Force le remontage de l'iframe pour recharger la preview */
  const handleRefreshPreview = (): void => {
    setIframeKey((k) => k + 1)
  }

  // ── Rendu ───────────────────────────────────────────────────────────────
  return (
    <Card>
      <CardHeader>
        <CardTitle>Partage</CardTitle>
        <CardDescription>
          Votre URL publique, la publication et un aperçu de votre page.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* ── URL publique + copie ──────────────────────────────────────── */}
        <div className="space-y-2">
          <Label>Lien à partager</Label>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded border bg-muted px-3 py-2 font-mono text-sm">
              {displayUrl}
            </code>
            <Button type="button" variant="outline" onClick={handleCopy}>
              <Copy className="size-4" />
              Copier
            </Button>
          </div>
        </div>

        {/* ── Toggle publish ──────────────────────────────────────────────── */}
        <div className="flex items-start justify-between rounded-lg border p-4">
          <div className="space-y-1">
            <Label className="text-base">Publier la page</Label>
            <p className="text-xs text-muted-foreground">
              Une fois publiée, votre page est visible à l&apos;adresse ci-dessus.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isPublishing && (
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
            )}
            <Switch
              checked={isPublished}
              disabled={isPublishing}
              onCheckedChange={handleTogglePublish}
            />
          </div>
        </div>

        {/* ── QR code ─────────────────────────────────────────────────────── */}
        <div className="space-y-3">
          <Label>QR code</Label>
          <div className="flex items-start gap-4">
            {qrDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- dataURL locale
              <img
                src={qrDataUrl}
                alt="QR code de la page"
                className="size-32 rounded border"
              />
            ) : (
              <div className="flex size-32 items-center justify-center rounded border border-dashed bg-muted text-muted-foreground">
                <QrCode className="size-8" />
              </div>
            )}
            <div className="space-y-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleGenerateQr}
                disabled={isGeneratingQr}
              >
                {isGeneratingQr ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Génération...
                  </>
                ) : (
                  <>
                    <QrCode className="size-4" />
                    Générer
                  </>
                )}
              </Button>
              {qrDataUrl && (
                <Button type="button" variant="ghost" onClick={handleDownloadQr}>
                  <Download className="size-4" />
                  Télécharger
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* ── Preview iframe ──────────────────────────────────────────────── */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Aperçu</Label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleRefreshPreview}
            >
              <RefreshCw className="size-4" />
              Rafraîchir
            </Button>
          </div>

          <Tabs defaultValue="mobile">
            <TabsList>
              <TabsTrigger value="mobile">Mobile</TabsTrigger>
              <TabsTrigger value="desktop">Desktop</TabsTrigger>
            </TabsList>

            {/* Mobile — iframe 402px centré sur fond neutre */}
            <TabsContent value="mobile">
              <div className="flex justify-center rounded-lg border bg-muted p-4">
                <iframe
                  key={`mobile-${iframeKey}`}
                  src={previewPath}
                  title="Aperçu mobile"
                  className="rounded-xl border bg-background"
                  style={{ width: MOBILE_WIDTH_PX, height: 720 }}
                />
              </div>
            </TabsContent>

            {/* Desktop — iframe plein largeur */}
            <TabsContent value="desktop">
              <iframe
                key={`desktop-${iframeKey}`}
                src={previewPath}
                title="Aperçu desktop"
                className="h-[720px] w-full rounded-lg border bg-background"
              />
            </TabsContent>
          </Tabs>
        </div>
      </CardContent>
    </Card>
  )
}
