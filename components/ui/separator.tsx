/**
 * @file components/ui/separator.tsx
 * @module ui
 * @description Composant Separator — ligne de séparation visuelle horizontale ou verticale.
 *   Basé sur @radix-ui/react-separator pour l'accessibilité (rôle "separator" ARIA).
 *
 * @example
 *   <Separator />                          // séparateur horizontal
 *   <Separator orientation="vertical" />   // séparateur vertical
 *   <Separator className="my-4" />         // avec marges
 */

'use client'

import * as SeparatorPrimitive from '@radix-ui/react-separator'
import * as React from 'react'

import { cn } from '@/lib/utils'

/**
 * Ligne de séparation visuelle accessible.
 * Orientation horizontale par défaut ; peut être verticale.
 *
 * @param orientation  - "horizontal" (défaut) ou "vertical"
 * @param decorative   - Si true, rôle ARIA "none" (purement décoratif, défaut: true)
 * @param className    - Classes CSS additionnelles
 */
const Separator = React.forwardRef<
  React.ComponentRef<typeof SeparatorPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SeparatorPrimitive.Root>
>(({ className, orientation = 'horizontal', decorative = true, ...props }, ref) => (
  <SeparatorPrimitive.Root
    ref={ref}
    decorative={decorative}
    orientation={orientation}
    className={cn(
      'shrink-0 bg-border',
      // Dimensions selon l'orientation
      orientation === 'horizontal' ? 'h-px w-full' : 'h-full w-px',
      className,
    )}
    {...props}
  />
))
Separator.displayName = SeparatorPrimitive.Root.displayName

export { Separator }
