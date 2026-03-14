/**
 * @file modules/biolink/components/BioPageEditor/ContactFormToggle.tsx
 * @module biolink
 * @description Toggle d'activation du formulaire de contact pour l'éditeur Bio Link.
 *   Affiche un interrupteur (Switch shadcn/ui) qui active ou désactive
 *   le formulaire de contact intégré en bas de la page publique /u/[slug].
 *   Quand activé, les visiteurs peuvent envoyer un message via BioContactSchema.
 *
 * @example
 *   <ContactFormToggle
 *     enabled={showContactForm}
 *     onChange={(v) => setShowContactForm(v)}
 *   />
 */

'use client'

import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'

// ─── Props ────────────────────────────────────────────────────────────────────

interface ContactFormToggleProps {
  /** État actuel du formulaire de contact (activé/désactivé) */
  enabled: boolean
  /** Callback déclenché au changement de l'interrupteur */
  onChange: (v: boolean) => void
}

// ─── Composant ────────────────────────────────────────────────────────────────

/**
 * Interrupteur pour activer le formulaire de contact sur la BioPage.
 * Composé d'un Switch, d'un label et d'une description explicative.
 *
 * @param enabled  - true si le formulaire est actuellement activé
 * @param onChange - Setter de l'état activé/désactivé
 * @returns Section avec Switch + label + description
 */
export function ContactFormToggle({ enabled, onChange }: ContactFormToggleProps): React.JSX.Element {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-foreground">Contact</h3>

      {/* ── Switch + label + description ──────────────────────────────── */}
      <div className="flex items-start gap-3">
        <Switch
          id="contact-form-toggle"
          checked={enabled}
          onCheckedChange={onChange}
          aria-describedby="contact-form-description"
        />
        <div className="space-y-0.5">
          <Label htmlFor="contact-form-toggle" className="cursor-pointer">
            Formulaire de contact
          </Label>
          <p id="contact-form-description" className="text-xs text-muted-foreground">
            Permettre aux visiteurs de vous envoyer un message
          </p>
        </div>
      </div>
    </div>
  )
}
