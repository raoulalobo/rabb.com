/**
 * @file app/(dashboard)/biolink/page.tsx
 * @description Page dashboard `/biolink` — éditeur de Link-in-Bio de l'utilisateur.
 *
 *   Server Component :
 *   1. Vérifie la session better-auth — redirect `/login` si absente
 *   2. Charge la BioPage de l'utilisateur (findUnique sur userId, avec links)
 *   3. Si aucune BioPage → rend `<BioPageEmpty />` (CTA "Créer ma Link-in-Bio")
 *   4. Sinon → rend `<BioPageEditor initialData={bioPage} />`
 *
 *   Le layout dashboard gère déjà la sidebar et le header — cette page
 *   se concentre sur le contenu de l'éditeur.
 *
 * @example
 *   URL : https://socialtdl.net/biolink
 */

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  BioPageEditor,
  BioPageEmpty,
} from '@/modules/biolink/components/BioPageEditor'

// ─── Métadonnées ──────────────────────────────────────────────────────────────

export const metadata = {
  title: 'Ma Link-in-Bio — SocialTDL',
  description:
    'Personnalisez votre page Link-in-Bio : titre, bio, liens, couleurs et publication.',
}

// ─── Page ─────────────────────────────────────────────────────────────────────

/**
 * Rend l'éditeur BioPage ou l'écran vide selon l'état de l'utilisateur.
 *
 * @returns `<BioPageEmpty />` si l'user n'a pas encore créé sa page,
 *          `<BioPageEditor />` sinon.
 */
export default async function BioLinkDashboardPage(): Promise<React.JSX.Element> {
  // ── 1. Authentification ────────────────────────────────────────────────
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) {
    redirect('/login')
  }

  // ── 2. Charge la BioPage du user (+ liens ordonnés) ────────────────────
  // La relation User → BioPage est 1-1 (unique userId), donc findUnique sur
  // userId est suffisant. Les liens sont triés par position ASC pour le DnD.
  const bioPage = await prisma.bioPage.findUnique({
    where: { userId: session.user.id },
    include: {
      links: {
        orderBy: { position: 'asc' },
      },
    },
  })

  // ── 3. Pas de BioPage → écran vide avec CTA ────────────────────────────
  if (!bioPage) {
    return <BioPageEmpty />
  }

  // ── 4. BioPage existante → éditeur complet ─────────────────────────────
  return <BioPageEditor initialData={bioPage} />
}
