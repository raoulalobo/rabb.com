/**
 * @file app/(dashboard)/biolink/page.tsx
 * @module biolink
 * @description Page de l'éditeur Bio Link dans le dashboard.
 *   Server Component protégé par auth : charge la BioPage de l'utilisateur connecté
 *   et les informations de profil (avatar, nom) pour le pré-remplissage.
 *
 *   Si l'utilisateur n'a pas encore de BioPage, l'éditeur s'affiche en mode création.
 *
 * @example
 *   // Accessible via la sidebar : /biolink
 *   // Server Component → chargement des données initiales
 */

import { headers } from 'next/headers'

import { auth } from '@/lib/auth'
import { getBioPage } from '@/modules/biolink/actions/biolink.action'
import { BioPageEditor } from '@/modules/biolink/components/BioPageEditor'

// ─── Page ─────────────────────────────────────────────────────────────────────

/**
 * Page /biolink — éditeur de la page "Link in Bio".
 * Charge la BioPage existante et les infos du profil utilisateur,
 * puis rend le composant BioPageEditor (Client Component).
 *
 * @returns Éditeur Bio Link avec données initiales
 */
export default async function BioLinkPage(): Promise<React.JSX.Element> {
  // Récupérer la session utilisateur (auth protège déjà via le layout dashboard)
  const session = await auth.api.getSession({
    headers: await headers(),
  })

  // Charger la BioPage existante (ou null si première visite)
  const bioPage = await getBioPage()

  return (
    <BioPageEditor
      initialPage={bioPage}
      userAvatarUrl={session?.user?.image ?? null}
      userName={session?.user?.name ?? null}
    />
  )
}
