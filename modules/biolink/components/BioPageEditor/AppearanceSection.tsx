/**
 * @file modules/biolink/components/BioPageEditor/AppearanceSection.tsx
 * @module biolink/components/BioPageEditor
 * @description Section "Apparence" de l'éditeur de BioPage.
 *
 *   Permet à l'utilisateur de personnaliser :
 *   - accentColor : CTA amber (défaut #E8B87A)
 *   - titleColor  : couleur du titre (nullable, fallback design)
 *   - bioColor    : couleur de la bio (nullable, fallback design)
 *   - linkColor   : couleur des liens glass (nullable, fallback design)
 *
 *   UX :
 *   - 6 presets cliquables pour `accentColor` (swatches ronds)
 *   - 4 inputs `type="color"` natifs (un par champ) avec preview live
 *   - Bouton "Réinitialiser" par champ → envoie `null` pour revenir au défaut
 *     (accentColor réinit → "#E8B87A" côté serveur car champ non-nullable)
 *   - Bouton "Enregistrer l'apparence" commit tous les changements en une fois
 *
 * @example
 *   <AppearanceSection
 *     initialData={{ accentColor, titleColor, bioColor, linkColor }}
 *     onMutation={() => router.refresh()}
 *   />
 */

'use client'

import { Loader2, RotateCcw } from 'lucide-react'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { updateBioPageAppearance } from '@/modules/biolink/actions/update-biopage-appearance.action'

// ─── Types ───────────────────────────────────────────────────────────────────

/** Données initiales — couleurs actuellement persistées en DB. */
export interface AppearanceSectionInitialData {
  accentColor: string
  titleColor: string | null
  bioColor: string | null
  linkColor: string | null
}

interface AppearanceSectionProps {
  /** Couleurs actuelles (depuis la DB) — sert de point de départ au form */
  initialData: AppearanceSectionInitialData
  /** Callback post-mutation — typiquement router.refresh() */
  onMutation: () => void
}

// ─── Constantes ──────────────────────────────────────────────────────────────

/**
 * Presets `accentColor` proposés dans l'UI — cohérents avec le design Mimi Sara.
 * L'ordre visuel est respecté : le premier (Amber) est le défaut du template.
 */
const ACCENT_PRESETS: { value: string; label: string }[] = [
  { value: '#E8B87A', label: 'Amber' },
  { value: '#6366f1', label: 'Indigo' },
  { value: '#10b981', label: 'Emerald' },
  { value: '#ec4899', label: 'Pink' },
  { value: '#f59e0b', label: 'Orange' },
  { value: '#8b5cf6', label: 'Violet' },
]

/** Valeur par défaut renvoyée côté serveur quand on reset accentColor */
const ACCENT_DEFAULT = '#E8B87A'

// ─── Composant ───────────────────────────────────────────────────────────────

/**
 * Section Apparence de l'éditeur. Commit en une seule Server Action.
 *
 * @returns Card contenant les 4 color pickers + presets + reset
 */
export function AppearanceSection({
  initialData,
  onMutation,
}: AppearanceSectionProps): React.JSX.Element {
  // État local du form — on copie l'initialData pour éviter tout effet de bord
  const [accentColor, setAccentColor] = useState<string>(initialData.accentColor)
  const [titleColor, setTitleColor] = useState<string | null>(initialData.titleColor)
  const [bioColor, setBioColor] = useState<string | null>(initialData.bioColor)
  const [linkColor, setLinkColor] = useState<string | null>(initialData.linkColor)

  const [isSaving, startSaving] = useTransition()

  // ── Handler save ────────────────────────────────────────────────────────
  /**
   * Commit les 4 couleurs en une seule action. Les valeurs null sont envoyées
   * explicitement pour retirer une personnalisation (retour au défaut design).
   */
  const handleSave = (): void => {
    startSaving(async () => {
      const res = await updateBioPageAppearance({
        accentColor,
        titleColor,
        bioColor,
        linkColor,
      })
      if (!res.success) {
        toast.error(res.error)
        return
      }
      toast.success('Apparence enregistrée')
      onMutation()
    })
  }

  // Helper pour le reset — les colorPickers natifs HTML ne supportent pas null,
  // donc on simule en retirant la valeur custom et en affichant le défaut visuel.
  /**
   * Retourne l'affichage "effectif" d'une couleur potentiellement null.
   * Pour l'input type=color, il faut toujours une string hex — on fournit
   * un fallback neutre quand le champ est null.
   */
  const effective = (c: string | null, fallback: string): string => c ?? fallback

  return (
    <Card>
      <CardHeader>
        <CardTitle>Apparence</CardTitle>
        <CardDescription>
          Personnalisez les couleurs de votre page. Laissez un champ par défaut pour
          conserver le rendu du template.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* ── Accent color : presets + color picker ─────────────────────── */}
        <div className="space-y-3">
          <Label>Couleur d&apos;accent (CTA principal)</Label>

          {/* Presets — swatches ronds cliquables */}
          <div className="flex flex-wrap gap-2">
            {ACCENT_PRESETS.map((preset) => (
              <button
                key={preset.value}
                type="button"
                onClick={() => setAccentColor(preset.value)}
                className={`size-8 rounded-full border-2 transition ${
                  accentColor.toLowerCase() === preset.value.toLowerCase()
                    ? 'border-foreground scale-110'
                    : 'border-transparent hover:scale-105'
                }`}
                style={{ backgroundColor: preset.value }}
                aria-label={preset.label}
                title={preset.label}
              />
            ))}
          </div>

          {/* Color picker natif + affichage hex + reset */}
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={accentColor}
              onChange={(e) => setAccentColor(e.target.value)}
              className="size-10 rounded border cursor-pointer"
            />
            <code className="text-sm font-mono text-muted-foreground">
              {accentColor.toUpperCase()}
            </code>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setAccentColor(ACCENT_DEFAULT)}
              title="Remettre la valeur par défaut"
            >
              <RotateCcw className="size-4" />
              Par défaut
            </Button>
          </div>
        </div>

        {/* ── 3 champs nullables : title / bio / link ───────────────────── */}
        {[
          {
            label: 'Couleur du titre',
            value: titleColor,
            setValue: setTitleColor,
            fallback: '#F6F2EC',
          },
          {
            label: 'Couleur de la bio',
            value: bioColor,
            setValue: setBioColor,
            fallback: '#F6F2EC',
          },
          {
            label: 'Couleur des liens',
            value: linkColor,
            setValue: setLinkColor,
            fallback: '#F6F2EC',
          },
        ].map((field) => (
          <div className="space-y-2" key={field.label}>
            <Label>{field.label}</Label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={effective(field.value, field.fallback)}
                onChange={(e) => field.setValue(e.target.value)}
                className="size-10 rounded border cursor-pointer"
              />
              <code className="text-sm font-mono text-muted-foreground">
                {field.value ? field.value.toUpperCase() : 'Défaut du template'}
              </code>
              {field.value !== null && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => field.setValue(null)}
                  title="Retirer la personnalisation"
                >
                  <RotateCcw className="size-4" />
                  Réinitialiser
                </Button>
              )}
            </div>
          </div>
        ))}

        {/* ── Save global ───────────────────────────────────────────────── */}
        <div className="flex justify-end">
          <Button type="button" onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Enregistrement...
              </>
            ) : (
              'Enregistrer l\'apparence'
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
