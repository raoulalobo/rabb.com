/**
 * @file modules/posts/components/PostComposer/AIAssistPanel.tsx
 * @module posts
 * @description Panneau latéral de rédaction assistée par IA, avec onglets par plateforme.
 *   Compound Component de PostComposer (accessible via PostComposer.AIAssist).
 *
 *   Flux :
 *   1. L'utilisateur saisit un brief optionnel (sujet du post)
 *   2. Clic "Générer" → POST /api/posts/generate avec brief + platforms + scheduledFor
 *   3. Claude renvoie { texts: Record<string, string> } — un texte par plateforme
 *   4. Si 1 seule plateforme → textarea simple (comportement identique à avant)
 *      Si 2+ plateformes → onglets horizontaux avec compteur de caractères coloré
 *   5. Clic "Utiliser" → injecte le texte de l'onglet actif dans l'override de plateforme
 *   6. Clic "Tout appliquer" (visible si 2+ plateformes) → applique tous les textes en une fois
 *   7. Clic "×" → onClose() ferme le panneau
 *
 *   Dépendances contexte :
 *   - platforms      → envoyées à l'API pour adapter le ton et les limites
 *   - scheduledFor   → envoyée à l'API pour le contexte temporel
 *   - customizePlatform → crée l'override avant d'injecter le texte
 *   - mediaUrls      → récupérés pour ne pas écraser les médias existants
 *
 * @example
 *   // Attaché comme sous-composant de PostComposer :
 *   {isAIPanelOpen && (
 *     <PostComposer.AIAssist onClose={() => setIsAIPanelOpen(false)} />
 *   )}
 */

'use client'

import { useState } from 'react'

import { CheckCheck, Loader2, RefreshCw, Sparkles, X } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { PLATFORM_CONFIG } from '@/modules/platforms/constants'
import { PLATFORM_RULES } from '@/modules/platforms/config/platform-rules'
import type { Platform } from '@/modules/platforms/types'
import { useDraftStore } from '@/modules/posts/store/draft.store'

import { usePostComposerContext } from './context'

// ─── Props ────────────────────────────────────────────────────────────────────

interface AIAssistPanelProps {
  /**
   * Callback appelé quand l'utilisateur ferme le panneau (icône ×).
   * Le parent (CalendarContent) est responsable de cacher le panneau.
   */
  onClose: () => void
}

// ─── Composant ────────────────────────────────────────────────────────────────

/**
 * Panneau latéral de rédaction IA avec onglets par plateforme.
 * S'affiche à droite du PostComposer dans le Dialog du calendrier.
 *
 * @param onClose - Callback de fermeture du panneau
 */
export function AIAssistPanel({ onClose }: AIAssistPanelProps): React.JSX.Element {
  // ── Lecture du contexte PostComposer ────────────────────────────────────────
  // platforms et scheduledFor contextualisent la génération
  // customizePlatform crée l'override avant d'injecter le texte généré
  const { platforms, scheduledFor, customizePlatform, mediaUrls } = usePostComposerContext()

  // Accès direct au store pour appeler setPlatformOverride et lire platformOverrides
  const { setPlatformOverride, platformOverrides } = useDraftStore()

  // ── État local du panneau ────────────────────────────────────────────────────

  /** Texte du brief saisi par l'utilisateur (optionnel) */
  const [brief, setBrief] = useState('')

  /**
   * Textes générés par plateforme.
   * Remplace l'ancien `suggestion: string` — un texte par clé de plateforme.
   * Ex: { twitter: "Court !", linkedin: "Contenu professionnel..." }
   */
  const [suggestions, setSuggestions] = useState<Record<string, string>>({})

  /**
   * Onglet actif dans la zone de suggestion.
   * Initialisé sur la première plateforme retournée par l'API.
   * '' = aucun onglet (avant génération)
   */
  const [activeTab, setActiveTab] = useState<string>('')

  /** true pendant l'appel API (désactive les boutons, affiche le spinner) */
  const [isGenerating, setIsGenerating] = useState(false)

  /** Message d'erreur affiché sous le bouton Générer si l'API échoue */
  const [error, setError] = useState<string | null>(null)

  // ── Génération du texte ──────────────────────────────────────────────────────

  /**
   * Appelle POST /api/posts/generate avec le brief, les plateformes et la date planifiée.
   * Met à jour `suggestions` avec un texte par plateforme.
   * Initialise `activeTab` sur la première plateforme retournée.
   * Peut être appelée plusieurs fois (bouton "Régénérer").
   */
  async function handleGenerate(): Promise<void> {
    setIsGenerating(true)
    setError(null)

    try {
      const response = await fetch('/api/posts/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brief: brief.trim(),
          // Convertit le tableau Platform en tableau de strings pour l'API
          platforms: platforms.map((p) => String(p)),
          // Sérialise la date en ISO string (null si non définie)
          scheduledFor: scheduledFor ? scheduledFor.toISOString() : null,
        }),
      })

      if (!response.ok) {
        const data = (await response.json()) as { error?: string }
        setError(data.error ?? 'Erreur lors de la génération')
        return
      }

      // L'API renvoie maintenant { texts: Record<string, string> }
      const data = (await response.json()) as { texts: Record<string, string> }
      setSuggestions(data.texts)

      // Initialiser l'onglet actif sur la première plateforme retournée
      const firstPlatform = Object.keys(data.texts)[0] ?? ''
      setActiveTab(firstPlatform)
    } catch {
      // Erreur réseau ou JSON invalide
      setError('Impossible de contacter le serveur. Réessayez.')
    } finally {
      setIsGenerating(false)
    }
  }

  // ── Actions d'injection ──────────────────────────────────────────────────────

  /**
   * Injecte le texte de l'onglet actif dans l'override de la plateforme correspondante.
   * Appelle d'abord customizePlatform pour créer l'override si inexistant,
   * puis setPlatformOverride avec le texte généré + les médias déjà présents.
   *
   * @param platform - Plateforme dont injecter le texte (onglet actif)
   */
  function handleUseText(platform: string): void {
    const text = suggestions[platform]
    if (!text?.trim()) return

    const p = platform as Platform

    // Créer l'override si pas encore existant (copie le contenu de base)
    customizePlatform(p)

    // Injecter le texte en préservant les médias : d'abord ceux de l'override existant,
    // sinon ceux de base (mediaUrls du contexte)
    const existingMediaUrls = platformOverrides[p]?.mediaUrls ?? mediaUrls
    setPlatformOverride(p, { text, mediaUrls: existingMediaUrls })
  }

  /**
   * Injecte les textes générés dans TOUS les overrides de plateformes en une fois.
   * Affiche un toast de confirmation avec le nombre de plateformes appliquées.
   * Visible uniquement si 2+ plateformes ont été générées.
   */
  function handleApplyAll(): void {
    const platformKeys = Object.keys(suggestions)
    if (platformKeys.length === 0) return

    // Appliquer chaque plateforme séquentiellement
    for (const platform of platformKeys) {
      const text = suggestions[platform]
      if (!text?.trim()) continue

      const p = platform as Platform
      // Créer l'override si inexistant (copie le contenu de base)
      customizePlatform(p)
      // Préserver les médias existants ou utiliser les médias de base
      const existingMediaUrls = platformOverrides[p]?.mediaUrls ?? mediaUrls
      setPlatformOverride(p, { text, mediaUrls: existingMediaUrls })
    }

    toast.success(`Textes appliqués à ${platformKeys.length} plateformes`)
  }

  // ── Helpers de compteur de caractères ────────────────────────────────────────

  /**
   * Retourne la limite de caractères pour une plateforme depuis PLATFORM_RULES.
   * Retourne Infinity si la plateforme n'est pas dans la table (pas de limite connue).
   *
   * @param platform - Identifiant de la plateforme
   * @returns Limite en caractères (ex: 280 pour twitter)
   */
  function getCharLimit(platform: string): number {
    return PLATFORM_RULES[platform as Platform]?.maxText ?? Infinity
  }

  // ── Calculs dérivés ──────────────────────────────────────────────────────────

  // Liste des plateformes avec un texte généré
  const suggestionKeys = Object.keys(suggestions)
  // Afficher les onglets uniquement si 2+ plateformes ont été générées
  const showTabs = suggestionKeys.length > 1
  // Texte de l'onglet actif
  const activeText = suggestions[activeTab] ?? ''
  // Limite de l'onglet actif
  const activeLimit = getCharLimit(activeTab)
  // Dépassement pour l'onglet actif (pour couleur du compteur)
  const activeIsOverLimit = activeText.length > activeLimit

  // ── Rendu ────────────────────────────────────────────────────────────────────

  return (
    /*
     * Conteneur racine : flex-col sur toute la hauteur disponible.
     * h-full colle la hauteur du panneau à celle du PostComposer parent.
     * gap-3 entre chaque section, seule la zone de suggestion est scrollable.
     * w-full sur mobile (overlay plein écran), w-80 fixe sur desktop (≥ sm).
     * bg-background (opaque) : nécessaire en overlay mobile pour couvrir le compositeur.
     */
    <div className="flex h-full w-full shrink-0 flex-col gap-3 rounded-lg border border-border bg-background p-4 sm:w-80">

      {/* ── SECTION HAUTE FIXE ────────────────────────────────────────────── */}

      {/* En-tête du panneau */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* Icône ✨ identique au bouton d'ouverture dans l'éditeur */}
          <Sparkles className="size-4 text-primary" aria-hidden="true" />
          <span className="text-sm font-medium">Rédaction IA</span>
        </div>

        {/* Bouton de fermeture */}
        <button
          onClick={onClose}
          title="Fermer le panneau IA"
          className="rounded p-0.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          aria-label="Fermer le panneau IA"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* Zone de brief (hauteur fixe : 3 lignes) */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="ai-brief" className="text-xs text-muted-foreground">
          De quoi parle ce post ?
        </label>
        <Textarea
          id="ai-brief"
          value={brief}
          onChange={(e) => setBrief(e.target.value)}
          placeholder="Ex: lancement de ma nouvelle collection, astuce jardinage..."
          rows={3}
          disabled={isGenerating}
          className="resize-none text-sm"
          // Appui sur Entrée (sans Shift) → génère directement
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              void handleGenerate()
            }
          }}
        />
      </div>

      {/* Bouton principal : Générer */}
      <Button
        onClick={() => void handleGenerate()}
        disabled={isGenerating}
        size="sm"
        className="w-full gap-2"
      >
        {isGenerating ? (
          // Spinner pendant la génération
          <>
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            Génération…
          </>
        ) : (
          <>
            <Sparkles className="size-4" aria-hidden="true" />
            Générer
          </>
        )}
      </Button>

      {/* Message d'erreur de génération (hauteur dynamique mais rare) */}
      {error && (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      )}

      {/* ── ZONE DE SUGGESTION (visible après génération) ─────────────────── */}
      {suggestionKeys.length > 0 && (
        <>
          {/* Séparateur visuel entre la zone de saisie et la suggestion */}
          <div className="flex items-center gap-2">
            <div className="h-px flex-1 bg-border" aria-hidden="true" />
            <span className="text-[11px] text-muted-foreground">
              {showTabs ? 'Suggestions par plateforme' : 'Suggestion'}
            </span>
            <div className="h-px flex-1 bg-border" aria-hidden="true" />
          </div>

          {/* ── ONGLETS DE PLATEFORMES (visible si 2+ plateformes) ──────────── */}
          {showTabs && (
            <div
              className="flex gap-1 overflow-x-auto pb-0.5"
              role="tablist"
              aria-label="Onglets de plateformes"
            >
              {suggestionKeys.map((platform) => {
                const config = PLATFORM_CONFIG[platform as Platform]
                const label = config?.label ?? platform
                const limit = getCharLimit(platform)
                const count = suggestions[platform]?.length ?? 0
                // Onglet rouge si le texte dépasse la limite de la plateforme
                const isOver = count > limit
                const isActive = activeTab === platform

                return (
                  <button
                    key={platform}
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => setActiveTab(platform)}
                    title={`${label} — ${count}/${limit === Infinity ? '∞' : limit} cars.`}
                    className={[
                      'shrink-0 rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                      isActive
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground hover:bg-accent hover:text-foreground',
                      // Bordure rouge si dépassement (onglet inactif) ou fond différent si actif + dépassement
                      isOver && !isActive ? 'ring-1 ring-destructive' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  >
                    {label}
                    {/* Indicateur rouge si la limite est dépassée */}
                    {isOver && (
                      <span className="ml-1 inline-block size-1.5 rounded-full bg-destructive" aria-hidden="true" />
                    )}
                  </button>
                )
              })}
            </div>
          )}

          {/*
           * Zone SCROLLABLE : prend tout l'espace vertical restant.
           * flex-1     → absorbe l'espace libre dans le flex-col parent
           * min-h-0    → permet à flex-1 de rétrécir en dessous de son contenu
           *              (sans min-h-0, un flex child ne peut pas scroller)
           * overflow-y-auto → scroll vertical dès que le contenu dépasse
           */}
          <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto">
            {/*
             * Textarea éditable : occupe tout l'espace du wrapper scrollable.
             * h-full     → colle à la hauteur du div parent
             * min-h-[120px] → hauteur minimum même si le texte est court
             * resize-none   → désactive le handle de redimensionnement natif
             */}
            <Textarea
              value={activeText}
              onChange={(e) =>
                setSuggestions((prev) => ({ ...prev, [activeTab]: e.target.value }))
              }
              className="h-full min-h-[120px] resize-none text-sm"
              aria-label={`Texte généré pour ${activeTab} — modifiable avant utilisation`}
            />

            {/* Compteur de caractères : vert si ok, rouge si dépassé */}
            {activeTab && (
              <p
                className={[
                  'text-right text-[11px] tabular-nums',
                  activeIsOverLimit ? 'text-destructive' : 'text-muted-foreground',
                ].join(' ')}
                aria-live="polite"
              >
                {activeText.length}
                {activeLimit !== Infinity && (
                  <> / {activeLimit} {activeIsOverLimit ? '⚠' : '✓'}</>
                )}
              </p>
            )}
          </div>

          {/* ── SECTION BASSE FIXE : boutons d'action ─────────────────────── */}
          {/*
           * Placés APRÈS le div scrollable (pas à l'intérieur) → toujours visibles
           * en bas du panneau, quel que soit la longueur de la suggestion.
           */}
          <div className="flex flex-col gap-2">
            {/* Ligne principale : Régénérer + Utiliser (onglet actif) */}
            <div className="flex gap-2">
              {/* Régénérer : relance handleGenerate(), écrase toutes les suggestions */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => void handleGenerate()}
                disabled={isGenerating}
                className="flex-1 gap-1.5"
                title="Générer de nouvelles versions"
              >
                <RefreshCw className="size-3.5" aria-hidden="true" />
                Régénérer
              </Button>

              {/* Utiliser : injecte le texte de l'onglet actif dans l'override de plateforme */}
              <Button
                size="sm"
                onClick={() => handleUseText(activeTab)}
                disabled={!activeText.trim() || isGenerating}
                className="flex-1 gap-1.5"
                title={`Insérer ce texte dans l'onglet ${activeTab}`}
              >
                Utiliser
              </Button>
            </div>

            {/* "Tout appliquer" : visible uniquement si 2+ plateformes générées */}
            {showTabs && (
              <Button
                variant="secondary"
                size="sm"
                onClick={handleApplyAll}
                disabled={isGenerating}
                className="w-full gap-1.5"
                title="Appliquer tous les textes générés aux onglets correspondants"
              >
                <CheckCheck className="size-3.5" aria-hidden="true" />
                Tout appliquer ({suggestionKeys.length} plateformes)
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  )
}
