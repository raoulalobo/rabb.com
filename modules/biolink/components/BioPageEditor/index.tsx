/**
 * @file modules/biolink/components/BioPageEditor/index.tsx
 * @module biolink
 * @description Composant principal de l'éditeur Bio Link.
 *   Compound component orchestrateur qui intègre tous les sous-composants :
 *   - ProfileSection (slug, titre, bio)
 *   - LinkList + AddLinkDialog (gestion des liens avec types et planification)
 *   - ThemePicker (sélection du thème visuel)
 *   - FontPicker (sélection de la police)
 *   - ButtonStylePicker (forme et variante des boutons)
 *   - AvatarShapePicker (forme de l'avatar)
 *   - BackgroundEditor (image de fond ou dégradé custom)
 *   - SpacingPicker (espacement entre les liens)
 *   - AnimationPicker (animation au survol)
 *   - BannerUpload (bannière en haut de la page)
 *   - SocialLinksEditor (icônes de réseaux sociaux)
 *   - ContactFormToggle (formulaire de contact intégré)
 *   - BrandingSection (masquer branding, favicon, domaine custom)
 *   - LivePreview (aperçu temps réel avec toutes les personnalisations)
 *
 *   Layout : split view (éditeur à gauche, aperçu à droite sur desktop).
 *
 * @example
 *   const page = await getBioPage()
 *   return <BioPageEditor initialPage={page} userAvatarUrl={user.avatarUrl} />
 */

'use client'

import { useCallback, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { BarChart2, Copy, ExternalLink, Eye, Globe } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  deleteLink,
  reorderLinks,
  togglePublish,
  upsertBioPage,
  upsertLink,
} from '@/modules/biolink/actions/biolink.action'
import type { BioThemeName } from '@/modules/biolink/schemas/biolink.schema'
import { useBioLinkStore } from '@/modules/biolink/store/biolink.store'
import type { BioTemplate } from '@/modules/biolink/templates/types'
import type { BioLink, BioLinkType, BioPage, BioSocialLink } from '@/modules/biolink/types'

import Link from 'next/link'

import { AddLinkDialog } from './AddLinkDialog'
import { AvatarUpload } from './AvatarUpload'
import { ColorCustomizer } from './ColorCustomizer'
import { AnimationPicker } from './AnimationPicker'
import { HeaderStylePicker } from './HeaderStylePicker'
import { AvatarShapePicker } from './AvatarShapePicker'
import { BackgroundEditor } from './BackgroundEditor'
import { BannerUpload } from './BannerUpload'
import { BrandingSection } from './BrandingSection'
import { ButtonStylePicker } from './ButtonStylePicker'
import { ContactFormToggle } from './ContactFormToggle'
import { FontPicker } from './FontPicker'
import { LinkList } from './LinkList'
import { LivePreview } from './LivePreview'
import { ProfileSection } from './ProfileSection'
import { SocialLinksEditor } from './SocialLinksEditor'
import { SpacingPicker } from './SpacingPicker'
import { TemplatePicker } from './TemplatePicker'
import { ThemePicker } from './ThemePicker'

// ─── Props ────────────────────────────────────────────────────────────────────

interface BioPageEditorProps {
  /** BioPage existante ou null (premier accès → mode création) */
  initialPage: BioPage | null
  /** URL de l'avatar de l'utilisateur (fallback si pas d'avatar personnalisé) */
  userAvatarUrl?: string | null
  /** Nom de l'utilisateur (pré-remplissage du titre) */
  userName?: string | null
}

// ─── Composant ────────────────────────────────────────────────────────────────

/**
 * Éditeur complet de la BioPage.
 * Split view : formulaire à gauche (scroll), aperçu live à droite (sticky).
 * Gère l'état local de tous les champs éditables et délègue la persistance
 * aux Server Actions (upsertBioPage, upsertLink, etc.).
 *
 * @param initialPage   - Données initiales de la BioPage (ou null si non créée)
 * @param userAvatarUrl - Avatar de l'user (fallback)
 * @param userName      - Nom de l'user (pré-remplissage)
 * @returns Layout split view avec formulaire + aperçu
 */
export function BioPageEditor({
  initialPage,
  userAvatarUrl,
  userName,
}: BioPageEditorProps): React.JSX.Element {
  // ── État local du formulaire — champs de base ─────────────────────────────
  const [slug, setSlug] = useState(initialPage?.slug ?? '')
  const [title, setTitle] = useState(initialPage?.title ?? userName ?? '')
  const [bio, setBio] = useState(initialPage?.bio ?? '')
  const [theme, setTheme] = useState<BioThemeName>(
    (initialPage?.theme as BioThemeName) ?? 'default'
  )
  const [accentColor, setAccentColor] = useState(initialPage?.accentColor ?? '#6366f1')
  const [titleColor, setTitleColor] = useState<string | null>(initialPage?.titleColor ?? null)
  const [bioColor, setBioColor] = useState<string | null>(initialPage?.bioColor ?? null)
  const [linkColor, setLinkColor] = useState<string | null>(initialPage?.linkColor ?? null)
  const [socialLinks, setSocialLinks] = useState<BioSocialLink[]>(
    initialPage?.socialLinks ?? []
  )
  const [links, setLinks] = useState<BioLink[]>(initialPage?.links ?? [])
  const [isPublished, setIsPublished] = useState(initialPage?.isPublished ?? false)

  // ── État local — personnalisation avancée ──────────────────────────────────
  const [fontFamily, setFontFamily] = useState(initialPage?.fontFamily ?? 'inter')
  const [buttonShape, setButtonShape] = useState(initialPage?.buttonShape ?? 'rounded-lg')
  const [buttonVariant, setButtonVariant] = useState(initialPage?.buttonVariant ?? 'filled')
  const [avatarShape, setAvatarShape] = useState(initialPage?.avatarShape ?? 'circle')
  const [backgroundImageUrl, setBackgroundImageUrl] = useState<string | null>(
    initialPage?.backgroundImageUrl ?? null
  )
  const [gradientFrom, setGradientFrom] = useState<string | null>(
    initialPage?.gradientFrom ?? null
  )
  const [gradientTo, setGradientTo] = useState<string | null>(
    initialPage?.gradientTo ?? null
  )
  const [linkSpacing, setLinkSpacing] = useState(initialPage?.linkSpacing ?? 'normal')
  const [hoverAnimation, setHoverAnimation] = useState(initialPage?.hoverAnimation ?? 'none')
  const [headerStyle, setHeaderStyle] = useState(initialPage?.headerStyle ?? 'classic')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initialPage?.avatarUrl ?? null)
  const [bannerUrl, setBannerUrl] = useState<string | null>(initialPage?.bannerUrl ?? null)
  const [hideBranding, setHideBranding] = useState(initialPage?.hideBranding ?? false)
  const [faviconUrl, setFaviconUrl] = useState<string | null>(initialPage?.faviconUrl ?? null)
  const [showContactForm, setShowContactForm] = useState(initialPage?.showContactForm ?? false)
  const [customDomain, setCustomDomain] = useState<string | null>(
    initialPage?.customDomain ?? null
  )
  // Template actif (null = personnalisation manuelle)
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(
    initialPage?.templateId ?? null
  )
  // Aperçu mobile : ouvre un Sheet bottom avec le LivePreview
  const [showMobilePreview, setShowMobilePreview] = useState(false)

  // Transitions React pour les mutations (ne bloque pas l'UI)
  const [isSaving, startSaveTransition] = useTransition()
  const [isPublishing, startPublishTransition] = useTransition()

  // Store Zustand pour les dialogs
  const { openLinkDialog } = useBioLinkStore()

  // Avatar effectif : personnalisé (état local) → user → null
  const effectiveAvatarUrl = avatarUrl ?? userAvatarUrl ?? null

  // ── Handlers ────────────────────────────────────────────────────────────────

  /**
   * Sauvegarde la BioPage (profil + thème + personnalisations + réseaux sociaux).
   * Appelle la Server Action upsertBioPage avec tous les champs.
   */
  const handleSave = useCallback(() => {
    startSaveTransition(async () => {
      try {
        const result = await upsertBioPage({
          slug,
          title: title || null,
          bio: bio || null,
          avatarUrl,
          theme,
          accentColor,
          titleColor,
          bioColor,
          linkColor,
          // Personnalisation avancée
          fontFamily,
          buttonShape,
          buttonVariant,
          avatarShape,
          backgroundImageUrl,
          gradientFrom,
          gradientTo,
          linkSpacing,
          hoverAnimation,
          headerStyle,
          bannerUrl,
          hideBranding,
          faviconUrl,
          showContactForm,
          templateId: activeTemplateId,
          socialLinks,
        })

        // Mettre à jour les liens depuis le résultat (au cas où)
        setLinks(result.links)
        setIsPublished(result.isPublished)
        toast.success('Page Bio Link enregistrée')
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Erreur lors de la sauvegarde')
      }
    })
  }, [
    slug, title, bio, avatarUrl, theme, accentColor, titleColor, bioColor, linkColor, socialLinks,
    fontFamily, buttonShape, buttonVariant, avatarShape,
    backgroundImageUrl, gradientFrom, gradientTo,
    linkSpacing, hoverAnimation, headerStyle, bannerUrl, hideBranding, faviconUrl, showContactForm, activeTemplateId,
  ])

  /**
   * Bascule la publication de la BioPage (publié ↔ dépublié).
   */
  const handleTogglePublish = useCallback(() => {
    startPublishTransition(async () => {
      try {
        const newState = await togglePublish()
        setIsPublished(newState)
        toast.success(newState ? 'Page publiée !' : 'Page dépubliée')
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Erreur')
      }
    })
  }, [])

  /**
   * Sauvegarde un lien (création ou mise à jour) via la Server Action.
   * Supporte les nouveaux champs : type, url nullable, activeFrom, activeUntil.
   */
  const handleSaveLink = useCallback(
    async (data: {
      id?: string
      type?: BioLinkType
      title: string
      url?: string | null
      icon?: string | null
      isActive: boolean
      activeFrom?: Date | null
      activeUntil?: Date | null
    }) => {
      const result = await upsertLink(data)

      setLinks((prev) => {
        if (data.id) {
          // Mise à jour : remplacer le lien existant
          return prev.map((l) => (l.id === data.id ? result : l))
        }
        // Création : ajouter à la fin
        return [...prev, result]
      })
    },
    []
  )

  /**
   * Supprime un lien et met à jour la liste locale.
   */
  const handleDeleteLink = useCallback(async (linkId: string) => {
    try {
      await deleteLink(linkId)
      setLinks((prev) => prev.filter((l) => l.id !== linkId))
      toast.success('Lien supprimé')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors de la suppression')
    }
  }, [])

  /**
   * Bascule la visibilité d'un lien (actif/inactif) via upsertLink.
   */
  const handleToggleLink = useCallback(
    async (linkId: string) => {
      const link = links.find((l) => l.id === linkId)
      if (!link) return

      try {
        const result = await upsertLink({
          id: link.id,
          type: link.type,
          title: link.title,
          url: link.url,
          icon: link.icon,
          isActive: !link.isActive,
        })
        setLinks((prev) => prev.map((l) => (l.id === linkId ? result : l)))
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Erreur')
      }
    },
    [links]
  )

  /**
   * Réordonne les liens après un drag & drop.
   * Mise à jour optimiste puis persistance via Server Action.
   */
  const handleReorder = useCallback(
    (reorderedLinks: BioLink[]) => {
      // Mise à jour optimiste de l'UI (instantané)
      setLinks(reorderedLinks)

      // Persister les nouvelles positions en arrière-plan (fire & forget)
      const linksWithPositions = reorderedLinks.map((link, index) => ({
        id: link.id,
        position: index,
      }))
      reorderLinks({ links: linksWithPositions }).catch((err) => {
        toast.error(err instanceof Error ? err.message : 'Erreur lors du réordonnement')
      })
    },
    []
  )

  /**
   * Applique un template : pré-remplit tous les champs visuels.
   * Le template reste "actif" tant que l'utilisateur ne change pas manuellement.
   */
  const handleApplyTemplate = useCallback((template: BioTemplate) => {
    setTheme(template.theme)
    setAccentColor(template.accentColor)
    setTitleColor(template.titleColor)
    setBioColor(template.bioColor)
    setLinkColor(template.linkColor)
    setFontFamily(template.fontFamily)
    setButtonShape(template.buttonShape)
    setButtonVariant(template.buttonVariant)
    setAvatarShape(template.avatarShape)
    setGradientFrom(template.gradientFrom)
    setGradientTo(template.gradientTo)
    setLinkSpacing(template.linkSpacing)
    setHoverAnimation(template.hoverAnimation)
    setHeaderStyle(template.headerStyle)
    // Si le template a un dégradé, on supprime l'image de fond
    if (template.gradientFrom) setBackgroundImageUrl(null)
    setActiveTemplateId(template.id)
    toast.success(`Template "${template.name}" appliqué`)
  }, [])

  /**
   * Copie l'URL publique dans le presse-papiers.
   */
  function handleCopyUrl(): void {
    if (!slug) return
    navigator.clipboard.writeText(`https://ogolong.com/u/${slug}`)
    toast.success('URL copiée !')
  }

  // ── Objet draft pour le LivePreview ──────────────────────────────────────
  const draft = {
    slug,
    title,
    bio,
    avatarUrl: effectiveAvatarUrl,
    theme,
    accentColor,
    titleColor,
    bioColor,
    linkColor,
    fontFamily,
    buttonShape,
    buttonVariant,
    avatarShape,
    backgroundImageUrl,
    gradientFrom,
    gradientTo,
    linkSpacing,
    hoverAnimation,
    headerStyle,
    bannerUrl,
    hideBranding,
    showContactForm,
    links,
    socialLinks,
  }

  // ── Rendu ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 overflow-x-clip">
      {/* ── En-tête : titre + actions ────────────────────────────────── */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Bio Link</h1>
          <p className="text-sm text-muted-foreground">
            Créez votre page de liens personnalisée à partager dans vos bios.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Copier l'URL */}
          {slug && isPublished && (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleCopyUrl}
              >
                <Copy className="size-4" />
                <span className="hidden sm:inline ml-1">Copier l'URL</span>
              </Button>
              <a
                href={`/u/${slug}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button type="button" variant="outline" size="sm">
                  <ExternalLink className="size-4" />
                  <span className="hidden sm:inline ml-1">Voir</span>
                </Button>
              </a>
            </>
          )}

          {/* Lien vers les stats */}
          {initialPage && (
            <Link href="/biolink/stats">
              <Button type="button" variant="outline" size="sm">
                <BarChart2 className="size-4" />
                <span className="hidden sm:inline ml-1">Stats</span>
              </Button>
            </Link>
          )}

          {/* Toggle publication (désactivé si pas de slug) */}
          {initialPage && (
            <Button
              type="button"
              variant={isPublished ? 'outline' : 'default'}
              size="sm"
              onClick={handleTogglePublish}
              disabled={isPublishing || !slug}
            >
              <Globe className="size-4" />
              <span className="hidden sm:inline ml-1">
                {isPublished ? 'Dépublier' : 'Publier'}
              </span>
            </Button>
          )}

          {/* Enregistrer — toujours avec label (action principale) */}
          <Button
            type="button"
            onClick={handleSave}
            disabled={isSaving || slug.length < 3}
            size="sm"
          >
            {isSaving ? 'Enregistrement...' : 'Enregistrer'}
          </Button>
        </div>
      </div>

      <Separator />

      {/* ── Split view : éditeur + aperçu ────────────────────────────── */}
      <div className="grid gap-8 lg:grid-cols-[1fr_auto] min-w-0">
        {/* ── Colonne gauche : formulaire ─────────────────────────────── */}
        <div className="space-y-8 w-full min-w-0 sm:max-w-xl">
          {/* Section profil */}
          <ProfileSection
            slug={slug}
            title={title}
            bio={bio}
            onSlugChange={setSlug}
            onTitleChange={setTitle}
            onBioChange={setBio}
          />

          {/* Section avatar personnalisé */}
          <AvatarUpload
            avatarUrl={avatarUrl}
            fallbackUrl={userAvatarUrl ?? null}
            avatarShape={avatarShape}
            onChange={setAvatarUrl}
          />

          <Separator />

          {/* Section liens */}
          <LinkList
            links={links}
            onEdit={(id) => openLinkDialog(id)}
            onDelete={handleDeleteLink}
            onToggle={handleToggleLink}
            onAdd={() => openLinkDialog()}
            onReorder={handleReorder}
          />

          <Separator />

          {/* Section apparence : templates + thème manuel */}
          <TemplatePicker
            selectedTheme={theme}
            accentColor={accentColor}
            activeTemplateId={activeTemplateId}
            onThemeChange={setTheme}
            onAccentColorChange={setAccentColor}
            onApplyTemplate={handleApplyTemplate}
          />

          <Separator />

          {/* Section mise en page (header style) */}
          <HeaderStylePicker
            selected={headerStyle}
            onChange={setHeaderStyle}
          />

          <Separator />

          {/* Section couleurs personnalisées */}
          <ColorCustomizer
            titleColor={titleColor}
            bioColor={bioColor}
            linkColor={linkColor}
            onTitleColorChange={setTitleColor}
            onBioColorChange={setBioColor}
            onLinkColorChange={setLinkColor}
          />

          <Separator />

          {/* Section police */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Police</h3>
            <FontPicker selected={fontFamily} onChange={setFontFamily} />
          </div>

          <Separator />

          {/* Section style des boutons */}
          <ButtonStylePicker
            shape={buttonShape}
            variant={buttonVariant}
            onShapeChange={setButtonShape}
            onVariantChange={setButtonVariant}
          />

          <Separator />

          {/* Section forme de l'avatar */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Forme de l'avatar</h3>
            <AvatarShapePicker selected={avatarShape} onChange={setAvatarShape} />
          </div>

          <Separator />

          {/* Section fond personnalisé */}
          <BackgroundEditor
            backgroundImageUrl={backgroundImageUrl}
            gradientFrom={gradientFrom}
            gradientTo={gradientTo}
            onBackgroundImageChange={setBackgroundImageUrl}
            onGradientFromChange={setGradientFrom}
            onGradientToChange={setGradientTo}
          />

          <Separator />

          {/* Section espacement des liens */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Espacement</h3>
            <SpacingPicker selected={linkSpacing} onChange={setLinkSpacing} />
          </div>

          <Separator />

          {/* Section animation hover */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Animation au survol</h3>
            <AnimationPicker selected={hoverAnimation} onChange={setHoverAnimation} />
          </div>

          <Separator />

          {/* Section bannière */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Bannière</h3>
            <BannerUpload bannerUrl={bannerUrl} onChange={setBannerUrl} />
          </div>

          <Separator />

          {/* Section réseaux sociaux */}
          <SocialLinksEditor
            socialLinks={socialLinks}
            onChange={setSocialLinks}
          />

          <Separator />

          {/* Section formulaire de contact */}
          <ContactFormToggle
            enabled={showContactForm}
            onChange={setShowContactForm}
          />

          <Separator />

          {/* Section branding */}
          <BrandingSection
            hideBranding={hideBranding}
            faviconUrl={faviconUrl}
            customDomain={customDomain}
            onHideBrandingChange={setHideBranding}
            onFaviconUrlChange={setFaviconUrl}
            onCustomDomainChange={setCustomDomain}
          />
        </div>

        {/* ── Colonne droite : aperçu live (sticky) ──────────────────── */}
        <div className="hidden lg:block">
          <div className="sticky top-24">
            <LivePreview draft={draft} />
          </div>
        </div>
      </div>

      {/* ── Bouton flottant "Aperçu" — visible uniquement sur mobile/tablette ── */}
      <Button
        type="button"
        size="lg"
        className="fixed bottom-6 right-6 z-50 rounded-full shadow-lg lg:hidden"
        onClick={() => setShowMobilePreview(true)}
      >
        <Eye className="size-5 mr-2" />
        Aperçu
      </Button>

      {/* ── Sheet bottom avec le LivePreview pour mobile ──────────────── */}
      <Sheet open={showMobilePreview} onOpenChange={setShowMobilePreview}>
        <SheetContent side="bottom" className="h-[85vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Aperçu de votre page</SheetTitle>
            <SheetDescription>Visualisez votre Bio Link tel qu'il apparaîtra aux visiteurs.</SheetDescription>
          </SheetHeader>
          <div className="flex justify-center py-4">
            <LivePreview draft={draft} />
          </div>
        </SheetContent>
      </Sheet>

      {/* ── Dialog d'ajout/édition de lien ────────────────────────────── */}
      <AddLinkDialog
        links={links}
        onSave={handleSaveLink}
      />
    </div>
  )
}
