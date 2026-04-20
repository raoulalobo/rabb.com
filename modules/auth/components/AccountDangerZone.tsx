/**
 * @file modules/auth/components/AccountDangerZone.tsx
 * @module auth
 * @description Section "Données & compte" de la page Paramètres.
 *   Expose deux actions RGPD critiques pour l'utilisateur :
 *
 *   1. **Export des données** (droit à la portabilité — art. 20 RGPD)
 *      Déclenche le téléchargement de SocialTDL-data-YYYY-MM-DD.json via /api/user/export.
 *
 *   2. **Suppression du compte** (droit à l'effacement — art. 17 RGPD)
 *      Ouvre un Dialog de confirmation. L'utilisateur doit taper "supprimer" pour activer
 *      le bouton de confirmation. Appelle la Server Action deleteAccount() puis déconnecte
 *      et redirige vers '/'.
 *
 *   Design :
 *   - Section "Données & compte" : bouton d'export neutre
 *   - Séparateur rouge
 *   - Zone dangereuse : texte d'avertissement + bouton rouge destructif
 *   - Dialog shadcn avec input de confirmation
 *
 * @example
 *   // Dans app/(dashboard)/settings/page.tsx :
 *   <AccountDangerZone />
 */

'use client'

import { useState } from 'react'

import { useRouter } from 'next/navigation'

import { toast } from 'sonner'

import { deleteAccount } from '@/modules/auth/actions/delete-account.action'
import { signOut } from '@/lib/auth-client'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

// ─── Constante de confirmation ──────────────────────────────────────────────
// L'utilisateur doit taper exactement ce mot pour activer le bouton de suppression.
const CONFIRM_WORD = 'supprimer'

// ─── Composant ───────────────────────────────────────────────────────────────

/**
 * Section "Données & compte" — export et suppression.
 * Client Component : gère l'état du dialog et les appels asynchrones.
 *
 * @returns Section complète avec bouton export + zone dangereuse + dialog
 */
export function AccountDangerZone(): React.JSX.Element {
  const router = useRouter()

  // État du dialog de confirmation de suppression
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  // Saisie de l'utilisateur dans l'input de confirmation ("supprimer")
  const [confirmInput, setConfirmInput] = useState('')

  // Indicateur de chargement pendant la suppression
  const [isDeleting, setIsDeleting] = useState(false)

  // Le bouton de confirmation n'est actif que si l'utilisateur a tapé exactement le mot attendu
  const isConfirmEnabled = confirmInput === CONFIRM_WORD && !isDeleting

  /**
   * Ouvre le dialog de confirmation et réinitialise l'input.
   * Appelé au clic sur "Supprimer mon compte".
   */
  function openDeleteDialog(): void {
    setConfirmInput('') // Réinitialiser l'input à chaque ouverture
    setIsDialogOpen(true)
  }

  /**
   * Ferme le dialog et réinitialise l'état.
   * Appelé sur le bouton "Annuler" ou sur la croix du dialog.
   */
  function closeDialog(): void {
    if (isDeleting) return // Empêche la fermeture pendant la suppression
    setIsDialogOpen(false)
    setConfirmInput('')
  }

  /**
   * Lance la suppression définitive du compte.
   *
   * Flux :
   *   1. Appelle la Server Action deleteAccount() → suppression cascade Prisma
   *   2. En cas d'erreur → toast d'erreur, dialog reste ouvert
   *   3. En cas de succès → signOut() better-auth + redirect('/')
   */
  async function handleDeleteAccount(): Promise<void> {
    if (!isConfirmEnabled) return

    setIsDeleting(true)

    try {
      // Suppression côté serveur (transaction Prisma atomique)
      const result = await deleteAccount()

      if (!result.success) {
        toast.error(result.error ?? 'Erreur lors de la suppression du compte.')
        setIsDeleting(false)
        return
      }

      // Déconnexion côté client (invalide le cookie de session)
      await signOut()

      // Redirection vers la page d'accueil
      router.push('/')
    } catch {
      toast.error('Une erreur inattendue est survenue. Veuillez réessayer.')
      setIsDeleting(false)
    }
  }

  return (
    <section className="space-y-6">
      {/* ── En-tête de section ── */}
      <div>
        <h2 className="text-base font-semibold">Données &amp; compte</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Téléchargez une copie de vos données ou supprimez définitivement votre compte.
        </p>
      </div>

      {/* ── Export des données ── */}
      <div className="flex items-center justify-between rounded-lg border p-4">
        <div>
          <p className="text-sm font-medium">Exporter mes données</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Télécharge un fichier JSON avec tous vos posts, plateformes et médias.
          </p>
        </div>
        {/*
          Utilisation d'un lien <a> natif avec `download` pour déclencher le téléchargement.
          La route /api/user/export retourne Content-Disposition: attachment → téléchargement direct.
          Pas de JavaScript nécessaire — fonctionne même si JS est désactivé.
        */}
        <Button variant="outline" size="sm" asChild>
          <a href="/api/user/export" download>
            Exporter
          </a>
        </Button>
      </div>

      {/* ── Zone dangereuse ── */}
      <div className="rounded-lg border border-destructive/40 p-4 space-y-4">
        {/* Label "Zone dangereuse" */}
        <div>
          <p className="text-sm font-semibold text-destructive">Zone dangereuse</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Les actions ci-dessous sont irréversibles. Procédez avec précaution.
          </p>
        </div>

        {/* Bouton de suppression */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Supprimer mon compte</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Supprime définitivement votre compte et toutes vos données.
            </p>
          </div>
          <Button
            variant="destructive"
            size="sm"
            onClick={openDeleteDialog}
          >
            Supprimer
          </Button>
        </div>
      </div>

      {/* ── Dialog de confirmation de suppression ── */}
      <Dialog open={isDialogOpen} onOpenChange={closeDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-destructive">
              Supprimer mon compte
            </DialogTitle>
            <DialogDescription className="space-y-2">
              <span className="block">
                Cette action est <strong>définitive et irréversible</strong>. Elle supprimera :
              </span>
              <ul className="ml-4 list-disc text-sm space-y-1">
                <li>Votre profil et vos informations personnelles</li>
                <li>Tous vos posts (brouillons, planifiés, publiés)</li>
                <li>Vos plateformes connectées</li>
                <li>Vos médias</li>
                <li>Toutes vos données sans possibilité de récupération</li>
              </ul>
            </DialogDescription>
          </DialogHeader>

          {/* Input de confirmation — l'utilisateur doit taper "supprimer" */}
          <div className="space-y-2 py-2">
            <Label htmlFor="confirm-delete" className="text-sm">
              Pour confirmer, tapez{' '}
              <strong className="font-mono text-destructive">{CONFIRM_WORD}</strong>{' '}
              ci-dessous :
            </Label>
            <Input
              id="confirm-delete"
              type="text"
              value={confirmInput}
              onChange={(e) => setConfirmInput(e.target.value)}
              placeholder={CONFIRM_WORD}
              disabled={isDeleting}
              // Empêche la soumission par Entrée si le mot n'est pas tapé
              onKeyDown={(e) => {
                if (e.key === 'Enter' && isConfirmEnabled) {
                  void handleDeleteAccount()
                }
              }}
              autoComplete="off"
              autoFocus
            />
          </div>

          <DialogFooter className="gap-2">
            {/* Bouton Annuler */}
            <Button
              variant="outline"
              onClick={closeDialog}
              disabled={isDeleting}
            >
              Annuler
            </Button>

            {/* Bouton de confirmation — actif uniquement si input === "supprimer" */}
            <Button
              variant="destructive"
              onClick={() => void handleDeleteAccount()}
              disabled={!isConfirmEnabled}
            >
              {isDeleting ? 'Suppression en cours…' : 'Supprimer définitivement'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}
