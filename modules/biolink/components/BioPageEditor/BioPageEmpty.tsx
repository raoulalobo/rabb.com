/**
 * @file modules/biolink/components/BioPageEditor/BioPageEmpty.tsx
 * @module biolink/components/BioPageEditor
 * @description Écran affiché dans `/biolink` quand l'utilisateur n'a pas encore
 *   de BioPage. Propose un seul bouton qui invoque la Server Action
 *   `createBioPage()` puis rafraîchit la page pour basculer sur l'éditeur.
 *
 *   Design : carte centrée avec une icône Lucide Link2, un titre H2, un petit
 *   texte d'introduction et un CTA primary.
 *
 * @example
 *   {bioPage === null && <BioPageEmpty />}
 */

'use client'

import { Link2, Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { createBioPage } from '@/modules/biolink/actions/create-biopage.action'

// ─── Composant ────────────────────────────────────────────────────────────────

/**
 * Écran vide — carte CTA pour créer sa première BioPage.
 *
 * @returns Card centrée avec bouton "Créer ma Link-in-Bio"
 *
 * @example
 *   export default async function BioLinkPage() {
 *     const bioPage = await prisma.bioPage.findUnique({ ... })
 *     if (!bioPage) return <BioPageEmpty />
 *     return <BioPageEditor initialData={bioPage} />
 *   }
 */
export function BioPageEmpty(): React.JSX.Element {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  /**
   * Gère le clic sur "Créer ma Link-in-Bio". Appelle la Server Action,
   * affiche un toast selon le résultat, puis refresh pour que le Server
   * Component parent bascule sur `<BioPageEditor />`.
   */
  const handleCreate = (): void => {
    startTransition(async () => {
      const res = await createBioPage()
      if (!res.success) {
        toast.error(res.error)
        return
      }
      toast.success('Votre Link-in-Bio a été créé')
      // refresh() re-rend le Server Component parent — la page détecte la
      // nouvelle BioPage et monte l'éditeur à la place de cet écran.
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col items-center justify-center py-12">
      <Card className="w-full max-w-md">
        <CardContent className="flex flex-col items-center gap-5 py-10 text-center">
          {/* Icône d'illustration — cohérente avec l'item de sidebar */}
          <div className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Link2 className="size-7" />
          </div>

          {/* Titre + description */}
          <div className="space-y-2">
            <h2 className="text-xl font-semibold text-foreground">
              Créer ma Link-in-Bio
            </h2>
            <p className="text-sm text-muted-foreground">
              Regroupez tous vos liens importants sur une page unique à partager dans vos
              bios Instagram, TikTok ou YouTube.
            </p>
          </div>

          {/* CTA — désactivé pendant la transition pour éviter les doubles clics */}
          <Button
            size="lg"
            onClick={handleCreate}
            disabled={isPending}
            className="w-full"
          >
            {isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Création...
              </>
            ) : (
              'Créer ma Link-in-Bio'
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
