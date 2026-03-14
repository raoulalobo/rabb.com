/**
 * @file modules/biolink/templates/categories.ts
 * @module biolink
 * @description Métadonnées des 15 catégories de templates Bio Link.
 *   Chaque catégorie a un nom en français, une icône Lucide, et une
 *   description courte pour guider l'utilisateur dans son choix.
 *
 * @example
 *   TEMPLATE_CATEGORIES.find(c => c.id === 'minimal')
 *   // → { id: 'minimal', name: 'Minimaliste', icon: 'Minus', description: '...' }
 */

import type { TemplateCategory } from './types'

// ─── Métadonnées d'une catégorie ────────────────────────────────────────────

/** Métadonnées d'une catégorie de templates */
export interface TemplateCategoryMeta {
  /** Identifiant unique de la catégorie */
  id: TemplateCategory
  /** Nom affiché en français */
  name: string
  /** Nom de l'icône Lucide (importée dynamiquement dans le composant) */
  icon: string
  /** Description courte pour le tooltip */
  description: string
}

// ─── Liste des 15 catégories ────────────────────────────────────────────────

/** Les 15 catégories de templates avec leurs métadonnées */
export const TEMPLATE_CATEGORIES: TemplateCategoryMeta[] = [
  {
    id: 'minimal',
    name: 'Minimaliste',
    icon: 'Minus',
    description: 'Designs épurés et sobres',
  },
  {
    id: 'bold',
    name: 'Audacieux',
    icon: 'Zap',
    description: 'Couleurs vives et contrastes forts',
  },
  {
    id: 'dark',
    name: 'Sombre',
    icon: 'Moon',
    description: 'Thèmes sombres et élégants',
  },
  {
    id: 'nature',
    name: 'Nature',
    icon: 'Leaf',
    description: 'Couleurs naturelles et organiques',
  },
  {
    id: 'pastel',
    name: 'Pastel',
    icon: 'Palette',
    description: 'Tons doux et apaisants',
  },
  {
    id: 'gradient',
    name: 'Dégradé',
    icon: 'Blend',
    description: 'Fonds dégradés colorés',
  },
  {
    id: 'retro',
    name: 'Rétro',
    icon: 'Radio',
    description: 'Inspirations vintage et nostalgiques',
  },
  {
    id: 'luxury',
    name: 'Luxe',
    icon: 'Crown',
    description: 'Élégance et raffinement',
  },
  {
    id: 'creative',
    name: 'Créatif',
    icon: 'Brush',
    description: 'Designs artistiques et expressifs',
  },
  {
    id: 'tech',
    name: 'Tech',
    icon: 'Code',
    description: 'Inspirations développeur et tech',
  },
  {
    id: 'gaming',
    name: 'Gaming',
    icon: 'Gamepad2',
    description: 'Univers gaming et esport',
  },
  {
    id: 'food',
    name: 'Food',
    icon: 'ChefHat',
    description: 'Cuisine et gastronomie',
  },
  {
    id: 'music',
    name: 'Musique',
    icon: 'Music',
    description: 'Univers musical et artistique',
  },
  {
    id: 'fashion',
    name: 'Mode',
    icon: 'Shirt',
    description: 'Haute couture et tendances',
  },
  {
    id: 'sport',
    name: 'Sport',
    icon: 'Dumbbell',
    description: 'Énergie et performance',
  },
]
