/**
 * @file modules/biolink/components/BioPageEditor/TemplatePicker/index.tsx
 * @module biolink
 * @description Sélecteur de templates et de thème pour l'éditeur Bio Link.
 *   Deux onglets : "Templates" (galerie de ~105 templates) et "Manuel"
 *   (l'ancien ThemePicker avec les 5 pastilles + color picker).
 *
 *   L'onglet Templates affiche :
 *   1. Une barre de recherche
 *   2. Une barre de catégories scrollable (15 catégories + "Tous")
 *   3. Une grille 3 colonnes de TemplateCard (mini-aperçu cliquable)
 *
 * @example
 *   <TemplatePicker
 *     selectedTheme={theme}
 *     accentColor={accentColor}
 *     activeTemplateId={activeTemplateId}
 *     onThemeChange={setTheme}
 *     onAccentColorChange={setAccentColor}
 *     onApplyTemplate={handleApplyTemplate}
 *   />
 */

'use client'

import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'

import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import type { BioThemeName } from '@/modules/biolink/schemas/biolink.schema'
import type { BioTemplate } from '@/modules/biolink/templates/types'
import type { TemplateCategory } from '@/modules/biolink/templates/types'
import {
  TEMPLATES,
  getTemplatesByCategory,
  searchTemplates,
} from '@/modules/biolink/templates'

import { ThemePicker } from '../ThemePicker'
import { CategoryTabs } from './CategoryTabs'
import { TemplateCard } from './TemplateCard'

// ─── Props ────────────────────────────────────────────────────────────────────

interface TemplatePickerProps {
  /** Thème actuellement sélectionné (pour l'onglet Manuel) */
  selectedTheme: BioThemeName
  /** Couleur d'accent actuelle (pour l'onglet Manuel) */
  accentColor: string
  /** ID du template actif (null = aucun template sélectionné) */
  activeTemplateId: string | null
  /** Callback de changement de thème (onglet Manuel) */
  onThemeChange: (theme: BioThemeName) => void
  /** Callback de changement de couleur d'accent (onglet Manuel) */
  onAccentColorChange: (color: string) => void
  /** Callback d'application d'un template (onglet Templates) */
  onApplyTemplate: (template: BioTemplate) => void
}

// ─── Onglets ────────────────────────────────────────────────────────────────

type PickerTab = 'templates' | 'manual'

// ─── Composant ────────────────────────────────────────────────────────────────

/**
 * Sélecteur d'apparence avec deux modes : galerie de templates et mode manuel.
 * Le mode templates affiche ~105 templates filtrables par catégorie et recherche.
 * Le mode manuel est l'ancien ThemePicker (5 pastilles + color picker).
 *
 * @param selectedTheme    - Thème actuel (onglet Manuel)
 * @param accentColor      - Couleur accent actuelle (onglet Manuel)
 * @param activeTemplateId - ID du template actif (ring primary sur la carte)
 * @param onThemeChange    - Setter du thème
 * @param onAccentColorChange - Setter de la couleur accent
 * @param onApplyTemplate  - Handler d'application d'un template
 * @returns Composant avec tabs Templates/Manuel
 */
export function TemplatePicker({
  selectedTheme,
  accentColor,
  activeTemplateId,
  onThemeChange,
  onAccentColorChange,
  onApplyTemplate,
}: TemplatePickerProps): React.JSX.Element {
  // ── État local ──────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<PickerTab>('templates')
  const [searchQuery, setSearchQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState<TemplateCategory | null>(null)

  // ── Templates filtrés ───────────────────────────────────────────────────
  const filteredTemplates = useMemo((): BioTemplate[] => {
    // Si recherche active, ignorer la catégorie
    if (searchQuery.trim()) {
      return searchTemplates(searchQuery)
    }
    // Si catégorie active, filtrer par catégorie
    if (activeCategory) {
      return getTemplatesByCategory(activeCategory)
    }
    // Sinon, tous les templates
    return TEMPLATES
  }, [searchQuery, activeCategory])

  // ── Rendu ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* ── En-tête avec tabs ───────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Apparence</h3>
        <div className="flex rounded-lg bg-muted p-0.5">
          <button
            type="button"
            onClick={() => setActiveTab('templates')}
            className={cn(
              'rounded-md px-3 py-1 text-xs font-medium transition-colors',
              activeTab === 'templates'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            Templates
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('manual')}
            className={cn(
              'rounded-md px-3 py-1 text-xs font-medium transition-colors',
              activeTab === 'manual'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            Manuel
          </button>
        </div>
      </div>

      {/* ── Contenu selon l'onglet actif ──────────────────────────────── */}
      {activeTab === 'templates' ? (
        <div className="space-y-3">
          {/* Barre de recherche */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Rechercher un template..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                // Réinitialiser la catégorie si l'utilisateur cherche
                if (e.target.value.trim()) {
                  setActiveCategory(null)
                }
              }}
              className="pl-8 text-sm"
            />
          </div>

          {/* Barre de catégories */}
          <CategoryTabs
            activeCategory={activeCategory}
            onCategoryChange={(cat) => {
              setActiveCategory(cat)
              // Réinitialiser la recherche si l'utilisateur filtre par catégorie
              setSearchQuery('')
            }}
          />

          {/* Grille de templates (3 colonnes) */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 max-h-[400px] overflow-y-auto pr-1">
            {filteredTemplates.map((template) => (
              <TemplateCard
                key={template.id}
                template={template}
                isActive={activeTemplateId === template.id}
                onClick={() => onApplyTemplate(template)}
              />
            ))}
          </div>

          {/* Message si aucun résultat */}
          {filteredTemplates.length === 0 && (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Aucun template trouvé
            </p>
          )}
        </div>
      ) : (
        /* Onglet Manuel : ancien ThemePicker */
        <ThemePicker
          selectedTheme={selectedTheme}
          accentColor={accentColor}
          onThemeChange={onThemeChange}
          onAccentColorChange={onAccentColorChange}
        />
      )}
    </div>
  )
}
