/**
 * @file modules/posts/components/PostComposer/ContentTypePicker.tsx
 * @module posts
 * @description Sélecteur horizontal du type de contenu (feed, story, reel, thread, carousel).
 *   Affiche uniquement les types supportés par les plateformes sélectionnées.
 *   S'intègre dans le PostComposer entre PlatformTabs et Editor.
 *
 *   Comportement :
 *   - Aucune plateforme sélectionnée → affiche tous les types (désactivés)
 *   - 1+ plateformes → affiche les types communs à toutes les plateformes
 *   - Clic sur un type → met à jour contentType dans le draftStore
 *   - Le type "feed" est toujours disponible (supporté par toutes les plateformes)
 *
 * @example
 *   <PostComposer>
 *     <PostComposer.Platforms />
 *     <PostComposer.ContentTypePicker />
 *     <PostComposer.Editor />
 *   </PostComposer>
 */

'use client'

import { useEffect } from 'react'

import {
  CircleDot,
  Film,
  Images,
  MessagesSquare,
  Newspaper,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import {
  CONTENT_TYPE_CONFIG,
  getCommonContentTypes,
} from '@/modules/posts/schemas/content-type.schema'
import type { ContentType } from '@/modules/posts/schemas/content-type.schema'

import { usePostComposerContext } from './context'

// ─── Icônes par type de contenu ──────────────────────────────────────────────

/** Mapping type de contenu → icône Lucide */
const CONTENT_TYPE_ICONS: Record<ContentType, React.ComponentType<{ className?: string }>> = {
  feed: Newspaper,
  story: CircleDot,
  reel: Film,
  thread: MessagesSquare,
  carousel: Images,
}

// ─── Composant ────────────────────────────────────────────────────────────────

/**
 * Sélecteur horizontal du type de contenu.
 * Affiche des boutons pour chaque type supporté par les plateformes sélectionnées.
 * Le type actif est mis en surbrillance (variant "default" du Badge).
 *
 * @returns Barre de sélection du type de contenu, ou null si readOnly
 */
export function ContentTypePicker(): React.JSX.Element | null {
  const { platforms, readOnly, contentType, setContentType } = usePostComposerContext()

  // Pas de sélection en lecture seule (post PUBLISHED)
  if (readOnly) return null

  // Types disponibles = intersection des plateformes sélectionnées
  const availableTypes = getCommonContentTypes(platforms)

  // Si le type actuel n'est plus disponible (changement de plateforme), revenir à "feed"
  // useEffect pour éviter de setState pendant le rendu d'un autre composant
  useEffect(() => {
    if (!availableTypes.includes(contentType) && contentType !== 'feed') {
      setContentType('feed')
    }
  }, [availableTypes, contentType, setContentType])

  // Ne pas afficher si un seul type disponible (feed) — pas de choix à faire
  if (availableTypes.length <= 1) return null

  return (
    <div className="flex flex-wrap items-center gap-1.5 px-1">
      {availableTypes.map((type) => {
        const config = CONTENT_TYPE_CONFIG[type]
        const Icon = CONTENT_TYPE_ICONS[type]
        const isActive = type === contentType

        return (
          <button
            key={type}
            type="button"
            onClick={() => setContentType(type)}
            className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 rounded-md"
            title={config.description}
          >
            <Badge
              variant={isActive ? 'default' : 'outline'}
              className={[
                'cursor-pointer gap-1 px-2.5 py-1 text-xs transition-colors',
                isActive
                  ? ''
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
              ].join(' ')}
            >
              <Icon className="size-3.5" aria-hidden="true" />
              {config.label}
            </Badge>
          </button>
        )
      })}
    </div>
  )
}
