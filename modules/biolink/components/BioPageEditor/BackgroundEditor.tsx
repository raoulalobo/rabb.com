/**
 * @file modules/biolink/components/BioPageEditor/BackgroundEditor.tsx
 * @module biolink
 * @description Éditeur de fond d'écran pour l'éditeur Bio Link.
 *   Permet de configurer le fond de la page publique avec 3 modes :
 *   - "Aucun" : pas de fond personnalisé (utilise le fond du thème)
 *   - "Image" : URL d'une image de fond
 *   - "Dégradé" : 2 couleurs + aperçu du dégradé en temps réel
 *
 *   Le changement de mode nettoie automatiquement les valeurs
 *   des autres modes pour éviter les conflits en base de données.
 *
 * @example
 *   <BackgroundEditor
 *     backgroundImageUrl={null}
 *     gradientFrom="#6366f1"
 *     gradientTo="#ec4899"
 *     onBackgroundImageChange={setImageUrl}
 *     onGradientFromChange={setGradientFrom}
 *     onGradientToChange={setGradientTo}
 *   />
 */

'use client'

import { useState, useEffect } from 'react'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

import { ImageDropZone } from './ImageDropZone'

// ─── Props ────────────────────────────────────────────────────────────────────

interface BackgroundEditorProps {
  /** URL de l'image de fond (null si aucune) */
  backgroundImageUrl: string | null
  /** Couleur de départ du dégradé (null si pas de dégradé) */
  gradientFrom: string | null
  /** Couleur d'arrivée du dégradé (null si pas de dégradé) */
  gradientTo: string | null
  /** Callback de changement de l'URL image */
  onBackgroundImageChange: (url: string | null) => void
  /** Callback de changement de la couleur de départ du dégradé */
  onGradientFromChange: (c: string | null) => void
  /** Callback de changement de la couleur d'arrivée du dégradé */
  onGradientToChange: (c: string | null) => void
}

// ─── Types internes ──────────────────────────────────────────────────────────

/** Les 3 modes de fond possibles */
type BackgroundMode = 'none' | 'image' | 'gradient'

// ─── Composant ────────────────────────────────────────────────────────────────

/**
 * Éditeur de fond d'écran avec 3 modes radio (Aucun / Image / Dégradé).
 * Le mode actif est déduit automatiquement des props initiales.
 * Changer de mode nettoie les valeurs des autres modes.
 *
 * @param backgroundImageUrl     - URL image actuelle
 * @param gradientFrom           - Couleur 1 du dégradé
 * @param gradientTo             - Couleur 2 du dégradé
 * @param onBackgroundImageChange - Setter URL image
 * @param onGradientFromChange    - Setter couleur 1
 * @param onGradientToChange      - Setter couleur 2
 * @returns Section avec radio + champs conditionnels selon le mode
 */
export function BackgroundEditor({
  backgroundImageUrl,
  gradientFrom,
  gradientTo,
  onBackgroundImageChange,
  onGradientFromChange,
  onGradientToChange,
}: BackgroundEditorProps): React.JSX.Element {
  // Déduction du mode initial à partir des props
  const initialMode: BackgroundMode = backgroundImageUrl
    ? 'image'
    : gradientFrom && gradientTo
      ? 'gradient'
      : 'none'

  /** Mode de fond actuellement sélectionné */
  const [mode, setMode] = useState<BackgroundMode>(initialMode)

  // Synchronisation du mode si les props changent de l'extérieur
  useEffect(() => {
    if (backgroundImageUrl) setMode('image')
    else if (gradientFrom && gradientTo) setMode('gradient')
    else setMode('none')
  }, [backgroundImageUrl, gradientFrom, gradientTo])

  /**
   * Change le mode de fond et nettoie les valeurs des autres modes.
   * Empêche les conflits (ex: image ET dégradé définis simultanément).
   */
  const handleModeChange = (newMode: BackgroundMode): void => {
    setMode(newMode)

    // Nettoyage des valeurs selon le nouveau mode
    if (newMode === 'none') {
      onBackgroundImageChange(null)
      onGradientFromChange(null)
      onGradientToChange(null)
    } else if (newMode === 'image') {
      // Supprime le dégradé quand on passe en mode image
      onGradientFromChange(null)
      onGradientToChange(null)
    } else if (newMode === 'gradient') {
      // Supprime l'image quand on passe en mode dégradé
      onBackgroundImageChange(null)
      // Valeurs par défaut si aucun dégradé n'est défini
      if (!gradientFrom) onGradientFromChange('#6366f1')
      if (!gradientTo) onGradientToChange('#ec4899')
    }
  }

  /** Les 3 options radio avec leur label */
  const modes: { value: BackgroundMode; label: string }[] = [
    { value: 'none', label: 'Aucun' },
    { value: 'image', label: 'Image' },
    { value: 'gradient', label: 'Dégradé' },
  ]

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-foreground">Arrière-plan</h3>

      {/* ── Radio buttons pour le choix du mode ───────────────────────── */}
      <div className="flex gap-2">
        {modes.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            onClick={() => handleModeChange(value)}
            className={cn(
              // Bouton radio stylisé : bordure + fond selon la sélection
              'flex-1 rounded-lg border-2 px-3 py-2 text-sm font-medium transition-all',
              mode === value
                ? 'border-primary bg-primary/5 text-primary'
                : 'border-border text-muted-foreground hover:border-primary/50'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Zone drag & drop (mode Image) ─────────────────────────────── */}
      {mode === 'image' && (
        <ImageDropZone
          value={backgroundImageUrl}
          onChange={onBackgroundImageChange}
          placeholder="Glissez une image de fond ici"
          recommended="1920x1080 px minimum"
        />
      )}

      {/* ── 2 color pickers + aperçu (mode Dégradé) ───────────────────── */}
      {mode === 'gradient' && (
        <div className="space-y-3">
          <div className="flex gap-2 sm:gap-4">
            {/* Color picker : couleur de départ */}
            <div className="flex-1 space-y-1">
              <Label htmlFor="gradient-from">Début</Label>
              <div className="flex items-center gap-2">
                <input
                  id="gradient-from"
                  type="color"
                  value={gradientFrom ?? '#6366f1'}
                  onChange={(e) => onGradientFromChange(e.target.value)}
                  className="h-9 w-9 cursor-pointer rounded-md border border-border p-0.5"
                />
                <Input
                  value={gradientFrom ?? '#6366f1'}
                  onChange={(e) => {
                    // Accepter uniquement les valeurs hex valides
                    const val = e.target.value
                    if (/^#[0-9a-fA-F]{0,6}$/.test(val)) {
                      onGradientFromChange(val)
                    }
                  }}
                  className="flex-1"
                  maxLength={7}
                />
              </div>
            </div>

            {/* Color picker : couleur d'arrivée */}
            <div className="flex-1 space-y-1">
              <Label htmlFor="gradient-to">Fin</Label>
              <div className="flex items-center gap-2">
                <input
                  id="gradient-to"
                  type="color"
                  value={gradientTo ?? '#ec4899'}
                  onChange={(e) => onGradientToChange(e.target.value)}
                  className="h-9 w-9 cursor-pointer rounded-md border border-border p-0.5"
                />
                <Input
                  value={gradientTo ?? '#ec4899'}
                  onChange={(e) => {
                    const val = e.target.value
                    if (/^#[0-9a-fA-F]{0,6}$/.test(val)) {
                      onGradientToChange(val)
                    }
                  }}
                  className="flex-1"
                  maxLength={7}
                />
              </div>
            </div>
          </div>

          {/* Aperçu du dégradé résultant */}
          <div
            className="h-16 w-full rounded-lg border border-border"
            style={{
              background: `linear-gradient(to right, ${gradientFrom ?? '#6366f1'}, ${gradientTo ?? '#ec4899'})`,
            }}
          />
        </div>
      )}
    </div>
  )
}
