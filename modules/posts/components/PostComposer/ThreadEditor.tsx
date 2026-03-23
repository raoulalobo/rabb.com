/**
 * @file modules/posts/components/PostComposer/ThreadEditor.tsx
 * @module posts
 * @description Éditeur de thread (chaîne de posts liés) pour Twitter/X, Bluesky, Threads.
 *   Affiche une liste numérotée de champs texte, chaque champ = un post dans le fil.
 *   Minimum 2 éléments, maximum 25.
 *
 *   Visible uniquement quand contentType = "thread" dans le PostComposer.
 *
 *   Interactions :
 *   - Lit/écrit threadItems et les actions associées depuis le contexte
 *   - Chaque champ affiche un compteur de caractères selon la plateforme
 *   - Bouton "Ajouter" en bas pour ajouter un nouvel élément
 *   - Bouton "Supprimer" sur chaque élément (si > 2 éléments)
 *
 * @example
 *   <PostComposer>
 *     <PostComposer.ContentTypePicker />
 *     {contentType === 'thread' && <PostComposer.ThreadEditor />}
 *   </PostComposer>
 */

'use client'

import { Plus, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { getCharLimit } from '@/modules/posts/schemas/post.schema'

import { usePostComposerContext } from './context'

// ─── Composant ────────────────────────────────────────────────────────────────

/**
 * Éditeur de thread : liste numérotée de champs texte.
 * Chaque champ correspond à un post dans la chaîne.
 *
 * @returns Liste d'éditeurs de thread ou null si le type n'est pas "thread"
 */
export function ThreadEditor(): React.JSX.Element | null {
  const {
    contentType,
    threadItems,
    updateThreadItem,
    addThreadItem,
    removeThreadItem,
    platforms,
    readOnly,
  } = usePostComposerContext()

  // Ne s'affiche que pour les threads
  if (contentType !== 'thread') return null

  // Limite de caractères : utiliser la première plateforme sélectionnée, ou Twitter par défaut
  const mainPlatform = platforms[0] ?? 'twitter'
  const charLimit = getCharLimit(mainPlatform)

  return (
    <div className="space-y-3">
      {/* ── En-tête ────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-1">
        <p className="text-xs text-muted-foreground">
          {threadItems.length} élément{threadItems.length > 1 ? 's' : ''} dans le thread
        </p>
        <p className="text-xs text-muted-foreground">
          Max {charLimit.toLocaleString('fr-FR')} car. par élément
        </p>
      </div>

      {/* ── Liste des éléments ─────────────────────────────────────────── */}
      <div className="space-y-2">
        {threadItems.map((item, index) => {
          const charCount = item.length
          const remaining = charLimit - charCount
          const isOverLimit = remaining < 0

          return (
            <div key={index} className="group relative">
              {/* Numéro de l'élément */}
              <div className="absolute left-2 top-2 flex size-5 items-center justify-center rounded-full bg-muted text-[10px] font-medium text-muted-foreground">
                {index + 1}
              </div>

              {/* Zone de texte */}
              <Textarea
                value={item}
                onChange={(e) => updateThreadItem(index, e.target.value)}
                placeholder={index === 0 ? 'Premier post du thread...' : `Post ${index + 1}...`}
                className="min-h-[80px] resize-none pl-9 pr-8 text-sm"
                disabled={readOnly}
              />

              {/* Compteur de caractères */}
              <span
                className={[
                  'absolute bottom-2 right-2 text-[10px] tabular-nums',
                  isOverLimit ? 'text-destructive font-medium' : 'text-muted-foreground',
                ].join(' ')}
              >
                {charCount}/{charLimit}
              </span>

              {/* Bouton supprimer (visible au survol, min 2 éléments) */}
              {!readOnly && threadItems.length > 2 && (
                <button
                  type="button"
                  onClick={() => removeThreadItem(index)}
                  className="absolute right-2 top-2 rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  title="Supprimer cet élément"
                >
                  <Trash2 className="size-3.5" />
                </button>
              )}
            </div>
          )
        })}
      </div>

      {/* ── Bouton ajouter ────────────────────────────────────────────── */}
      {!readOnly && threadItems.length < 25 && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addThreadItem}
          className="w-full gap-1.5 text-xs"
        >
          <Plus className="size-3.5" />
          Ajouter un élément ({threadItems.length}/25)
        </Button>
      )}
    </div>
  )
}
