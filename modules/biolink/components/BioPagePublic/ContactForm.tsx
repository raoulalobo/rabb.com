/**
 * @file modules/biolink/components/BioPagePublic/ContactForm.tsx
 * @module biolink
 * @description Formulaire de contact intégré à la page publique Bio Link.
 *   Permet aux visiteurs d'envoyer un message au propriétaire de la page
 *   via 3 champs : nom, email et message. Le formulaire soumet les données
 *   via la Server Action `submitContact` et affiche un message de succès
 *   ou une erreur via toast (sonner).
 *
 *   Le bouton de soumission utilise la couleur d'accent du thème via
 *   la variable CSS `--accent` définie par le thème parent.
 *
 * @example
 *   // Afficher le formulaire de contact pour une BioPage
 *   <ContactForm bioPageId="bp_clxxx123" />
 *
 * @example
 *   // Intégration conditionnelle dans BioPageView
 *   {page.showContactForm && <ContactForm bioPageId={page.id} />}
 */

'use client'

import { useState } from 'react'
import { toast } from 'sonner'

import { submitContact } from '@/modules/biolink/actions/biolink.action'

// ─── Props ────────────────────────────────────────────────────────────────────

interface ContactFormProps {
  /** ID de la BioPage à laquelle le message de contact sera rattaché */
  bioPageId: string
}

// ─── Composant ────────────────────────────────────────────────────────────────

/**
 * Formulaire de contact compact pour la page Bio Link publique.
 * Gère l'état local (nom, email, message, chargement, succès) et
 * soumet les données via Server Action.
 *
 * Comportement :
 * - Validation HTML native (attributs required)
 * - État de chargement pendant la soumission
 * - Message de succès affiché après soumission réussie
 * - Erreur affichée via toast (sonner) en cas d'échec
 * - Réinitialisation automatique du formulaire après succès
 *
 * @param bioPageId - ID de la BioPage parente pour rattacher le message
 * @returns Formulaire de contact ou message de succès
 */
export function ContactForm({ bioPageId }: ContactFormProps): React.JSX.Element {
  // ── État local du formulaire ───────────────────────────────────────────
  /** Nom de l'expéditeur */
  const [name, setName] = useState<string>('')
  /** Adresse email de l'expéditeur */
  const [email, setEmail] = useState<string>('')
  /** Contenu du message */
  const [message, setMessage] = useState<string>('')
  /** Indicateur de soumission en cours (désactive le bouton) */
  const [loading, setLoading] = useState<boolean>(false)
  /** Indicateur de soumission réussie (affiche le message de succès) */
  const [success, setSuccess] = useState<boolean>(false)

  /**
   * Gère la soumission du formulaire de contact.
   * Envoie les données via Server Action, gère les états de chargement
   * et réinitialise le formulaire en cas de succès.
   */
  async function handleSubmit(e: React.FormEvent<HTMLFormElement>): Promise<void> {
    // Empêcher le rechargement de la page
    e.preventDefault()
    setLoading(true)

    try {
      // Appel de la Server Action pour enregistrer le message
      await submitContact(bioPageId, { name, email, message })

      // Réinitialiser les champs du formulaire
      setName('')
      setEmail('')
      setMessage('')

      // Afficher le message de succès à la place du formulaire
      setSuccess(true)
    } catch {
      // Afficher une erreur via toast en cas d'échec réseau ou serveur
      toast.error('Impossible d\'envoyer le message. Veuillez réessayer.')
    } finally {
      // Réactiver le bouton de soumission dans tous les cas
      setLoading(false)
    }
  }

  // ── Affichage post-soumission réussie ──────────────────────────────────
  if (success) {
    return (
      <div className="rounded-lg border border-current/10 px-4 py-6 text-center">
        <p className="text-sm font-medium">Message envoyé avec succes !</p>
        <p className="mt-1 text-xs opacity-60">Merci pour votre message.</p>
      </div>
    )
  }

  // ── Formulaire de contact ──────────────────────────────────────────────
  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {/* Titre de la section contact */}
      <h3 className="text-center text-sm font-semibold">Me contacter</h3>

      {/* Champ : Nom de l'expéditeur */}
      <input
        type="text"
        placeholder="Votre nom"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
        className="w-full rounded-lg border border-current/10 bg-transparent px-3 py-2 text-sm placeholder:opacity-40 focus:outline-none focus:ring-1 focus:ring-current/20"
      />

      {/* Champ : Email de l'expéditeur (validation HTML type=email) */}
      <input
        type="email"
        placeholder="Votre email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        className="w-full rounded-lg border border-current/10 bg-transparent px-3 py-2 text-sm placeholder:opacity-40 focus:outline-none focus:ring-1 focus:ring-current/20"
      />

      {/* Champ : Message (zone de texte multi-lignes) */}
      <textarea
        placeholder="Votre message"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        required
        rows={3}
        className="w-full resize-none rounded-lg border border-current/10 bg-transparent px-3 py-2 text-sm placeholder:opacity-40 focus:outline-none focus:ring-1 focus:ring-current/20"
      />

      {/* Bouton de soumission stylisé avec la couleur d'accent du thème */}
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white transition-opacity disabled:opacity-50"
      >
        {/* Texte dynamique selon l'état de chargement */}
        {loading ? 'Envoi...' : 'Envoyer'}
      </button>
    </form>
  )
}
