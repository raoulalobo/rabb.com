/**
 * @file modules/biolink/templates/index.ts
 * @module biolink
 * @description Point d'entrée du système de templates Bio Link.
 *   Agrège les ~105 templates de toutes les catégories et expose des fonctions
 *   utilitaires pour la recherche, le filtrage et la récupération par ID.
 *
 * @example
 *   import { TEMPLATES, getTemplate, getTemplatesByCategory, searchTemplates } from '@/modules/biolink/templates'
 *
 *   // Récupérer un template par ID
 *   const tpl = getTemplate('arctic-frost')
 *
 *   // Filtrer par catégorie
 *   const darkTemplates = getTemplatesByCategory('dark')
 *
 *   // Rechercher par nom ou tag
 *   const results = searchTemplates('neon')
 */

import type { BioTemplate, TemplateCategory } from './types'

// ── Import des presets par catégorie ────────────────────────────────────────

import { BOLD_TEMPLATES } from './presets/bold'
import { CREATIVE_TEMPLATES } from './presets/creative'
import { DARK_TEMPLATES } from './presets/dark'
import { FASHION_TEMPLATES } from './presets/fashion'
import { FOOD_TEMPLATES } from './presets/food'
import { GAMING_TEMPLATES } from './presets/gaming'
import { GRADIENT_TEMPLATES } from './presets/gradient'
import { LUXURY_TEMPLATES } from './presets/luxury'
import { MINIMAL_TEMPLATES } from './presets/minimal'
import { MUSIC_TEMPLATES } from './presets/music'
import { NATURE_TEMPLATES } from './presets/nature'
import { PASTEL_TEMPLATES } from './presets/pastel'
import { RETRO_TEMPLATES } from './presets/retro'
import { SPORT_TEMPLATES } from './presets/sport'
import { TECH_TEMPLATES } from './presets/tech'

// ── Agrégation de tous les templates ────────────────────────────────────────

/** Liste complète de tous les templates (~105), triés par catégorie */
export const TEMPLATES: BioTemplate[] = [
  ...MINIMAL_TEMPLATES,
  ...BOLD_TEMPLATES,
  ...DARK_TEMPLATES,
  ...NATURE_TEMPLATES,
  ...PASTEL_TEMPLATES,
  ...GRADIENT_TEMPLATES,
  ...RETRO_TEMPLATES,
  ...LUXURY_TEMPLATES,
  ...CREATIVE_TEMPLATES,
  ...TECH_TEMPLATES,
  ...GAMING_TEMPLATES,
  ...FOOD_TEMPLATES,
  ...MUSIC_TEMPLATES,
  ...FASHION_TEMPLATES,
  ...SPORT_TEMPLATES,
]

// ── Index par ID pour accès O(1) ────────────────────────────────────────────

/** Map id → BioTemplate pour un accès rapide par identifiant */
const TEMPLATES_BY_ID = new Map<string, BioTemplate>(
  TEMPLATES.map((t) => [t.id, t])
)

// ── Fonctions utilitaires ───────────────────────────────────────────────────

/**
 * Récupère un template par son identifiant unique.
 *
 * @param id - Identifiant kebab-case du template (ex: "arctic-frost")
 * @returns Le template correspondant, ou undefined si non trouvé
 *
 * @example
 *   const tpl = getTemplate('midnight-black')
 *   // → { id: 'midnight-black', name: 'Noir de minuit', category: 'dark', ... }
 */
export function getTemplate(id: string): BioTemplate | undefined {
  return TEMPLATES_BY_ID.get(id)
}

/**
 * Récupère tous les templates d'une catégorie donnée.
 *
 * @param category - Identifiant de la catégorie (ex: "dark", "minimal")
 * @returns Tableau de templates de cette catégorie (~7 éléments)
 *
 * @example
 *   const darkTemplates = getTemplatesByCategory('dark')
 *   // → [{ id: 'midnight-black', ... }, { id: 'cyber-punk', ... }, ...]
 */
export function getTemplatesByCategory(category: TemplateCategory): BioTemplate[] {
  return TEMPLATES.filter((t) => t.category === category)
}

/**
 * Recherche des templates par nom ou tag (insensible à la casse).
 * Le terme de recherche est comparé au nom, à l'ID et aux tags de chaque template.
 *
 * @param query - Terme de recherche (ex: "neon", "rose", "minimal")
 * @returns Tableau de templates correspondants
 *
 * @example
 *   searchTemplates('neon')
 *   // → [{ id: 'neon-canvas', ... }, { id: 'neon-80s', ... }, ...]
 *
 *   searchTemplates('rose')
 *   // → [{ id: 'dark-rose', ... }, { id: 'rose-gold', ... }, ...]
 */
export function searchTemplates(query: string): BioTemplate[] {
  const normalizedQuery = query.toLowerCase().trim()
  if (!normalizedQuery) return TEMPLATES

  return TEMPLATES.filter((t) => {
    // Chercher dans le nom, l'ID et les tags
    const searchableText = [t.name, t.id, ...t.tags].join(' ').toLowerCase()
    return searchableText.includes(normalizedQuery)
  })
}

// ── Re-exports ──────────────────────────────────────────────────────────────

export type { BioTemplate, TemplateCategory } from './types'
export { TEMPLATE_CATEGORIES } from './categories'
export type { TemplateCategoryMeta } from './categories'
export { TEMPLATE_CATEGORY_IDS } from './types'
