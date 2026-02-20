/**
 * @file components/ui/password-input.tsx
 * @description Champ mot de passe avec bouton toggle afficher/masquer.
 *   Étend les props du composant Input standard — utilisable partout où
 *   un <Input type="password"> est utilisé.
 *
 *   Le bouton toggle est positionné à droite à l'intérieur du champ.
 *   React 19 : ref passée directement comme prop (pas de forwardRef).
 *
 * @example
 *   <PasswordInput
 *     placeholder="Minimum 8 caractères"
 *     autoComplete="new-password"
 *     {...field}
 *   />
 */

'use client'

import { Eye, EyeOff } from 'lucide-react'
import * as React from 'react'

import { cn } from '@/lib/utils'

// ─── Composant ────────────────────────────────────────────────────────────────

/**
 * Champ mot de passe avec toggle visibilité.
 * Accepte toutes les props d'un <input> standard (sauf `type`, géré en interne).
 *
 * @param className - Classes CSS additionnelles pour le conteneur
 * @param ref       - Ref React 19 (prop directe, pas forwardRef)
 */
function PasswordInput({
  className,
  ref,
  ...props
}: React.ComponentProps<'input'> & { ref?: React.Ref<HTMLInputElement> }): React.JSX.Element {
  // Bascule entre "password" (masqué) et "text" (visible)
  const [showPassword, setShowPassword] = React.useState(false)

  return (
    <div className="relative">
      <input
        ref={ref}
        type={showPassword ? 'text' : 'password'}
        data-slot="input"
        className={cn(
          // Styles identiques au composant Input de base
          'file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
          'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
          'aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive',
          // Espace à droite pour le bouton toggle (ne pas chevaucher le texte)
          'pr-9',
          className,
        )}
        {...props}
      />

      {/* Bouton toggle afficher/masquer */}
      <button
        type="button"
        aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
        onClick={() => setShowPassword((v) => !v)}
        className="absolute right-0 top-0 flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        // Ne pas déclencher la validation du formulaire au clic
        tabIndex={-1}
      >
        {showPassword ? (
          <EyeOff className="size-4" aria-hidden="true" />
        ) : (
          <Eye className="size-4" aria-hidden="true" />
        )}
      </button>
    </div>
  )
}

export { PasswordInput }
