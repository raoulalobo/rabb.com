/**
 * @file modules/biolink/components/BioPageEditor/BioPageEditor.tsx
 * @module biolink/components/BioPageEditor
 * @description Composant orchestrateur de l'éditeur de BioPage (compound).
 *
 *   Agence les 5 sections en **onglets** :
 *   - Infos      — titre, bio, handle, tagline, slug, avatar
 *   - Apparence  — couleurs accent/title/bio/link
 *   - Réseaux    — IG / TT / YT / FB / Mail (icônes sous la bio)
 *   - Liens      — liste triable de BioLinks
 *   - Partage    — URL publique, publication, QR, preview iframe
 *
 *   Utilise le pattern "onMutation" : chaque section invoque `router.refresh()`
 *   après une Server Action réussie, ce qui re-render le Server Component
 *   parent (page.tsx) et refait passer les nouvelles données en `initialData`.
 *   C'est le pattern le plus simple pour un MVP — pas de store local.
 *
 * @example
 *   <BioPageEditor initialData={bioPage} />
 *   // bioPage = BioPage & { links: BioLink[] } depuis Prisma
 */

'use client'

import { useRouter } from 'next/navigation'
import { useCallback } from 'react'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

import { AppearanceSection } from './AppearanceSection'
import { InfosSection } from './InfosSection'
import { LinksSection } from './LinksSection'
import { ShareSection } from './ShareSection'
import { SocialsSection } from './SocialsSection'

import type { BioSocialItem } from '@/modules/biolink/schemas/biopage.schema'
import type { BioLink, BioPage } from '@prisma/client'

// ─── Types ───────────────────────────────────────────────────────────────────

/**
 * Données initiales : BioPage + ses liens inclus (forme retournée par le
 * `prisma.bioPage.findUnique({ include: { links: true } })` du parent).
 */
export interface BioPageEditorInitialData extends BioPage {
  links: BioLink[]
}

interface BioPageEditorProps {
  /** Données de la BioPage + liens, telles que chargées par le Server Component parent */
  initialData: BioPageEditorInitialData
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Parse défensif du champ `BioPage.socialLinks` (JSON Prisma) en array typé
 * `BioSocialItem[]`. Côté DB le champ est `Json @default("[]")` mais Prisma
 * le remonte en `JsonValue` (union très large) — on filtre ici les entrées
 * malformées pour ne passer à `SocialsSection` que ce qu'il accepte.
 *
 * @param raw - Valeur `socialLinks` telle que renvoyée par Prisma
 * @returns Array filtré ne contenant que des entrées `{ platform, url, label? }` valides
 */
function parseInitialSocials(raw: unknown): BioSocialItem[] {
  if (!Array.isArray(raw)) return []
  const result: BioSocialItem[] = []
  for (const entry of raw) {
    if (
      !entry ||
      typeof entry !== 'object' ||
      typeof (entry as { platform?: unknown }).platform !== 'string' ||
      typeof (entry as { url?: unknown }).url !== 'string'
    ) {
      continue
    }
    const platform = (entry as { platform: string }).platform
    // Ne garder que les plateformes canoniques reconnues par l'éditeur
    if (platform !== 'ig' && platform !== 'tt' && platform !== 'yt' && platform !== 'fb' && platform !== 'mail') {
      continue
    }
    const typed = entry as { platform: typeof platform; url: string; label?: unknown }
    result.push({
      platform,
      url: typed.url,
      label: typeof typed.label === 'string' ? typed.label : undefined,
    })
  }
  return result
}

// ─── Composant ───────────────────────────────────────────────────────────────

/**
 * Orchestrateur de l'éditeur — affiche les 4 sections dans des onglets.
 * Chaque section reçoit les props nécessaires et `onMutation` pour remonter.
 *
 * @param props.initialData - BioPage + links actuels, depuis Prisma
 * @returns Layout tabs avec les 4 sections
 */
export function BioPageEditor({
  initialData,
}: BioPageEditorProps): React.JSX.Element {
  const router = useRouter()

  // Callback invoqué par chaque section après une mutation réussie.
  // `useCallback` pour garder l'identité stable entre les renders (micro-opti).
  const handleMutation = useCallback(() => {
    router.refresh()
  }, [router])

  return (
    <div className="space-y-6">
      {/* ── En-tête avec URL publique visible en permanence ─────────────── */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Ma Link-in-Bio</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Personnalisez votre page publique accessible à l&apos;adresse{' '}
            <code className="font-mono text-xs">socialtdl.net/u/{initialData.slug}</code>
          </p>
        </div>
        {/* Badge statut à droite — publié vs brouillon */}
        <div className="flex items-center gap-2 text-sm">
          <span
            className={
              initialData.isPublished
                ? 'rounded-full bg-emerald-100 px-2.5 py-0.5 font-medium text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400'
                : 'rounded-full bg-muted px-2.5 py-0.5 font-medium text-muted-foreground'
            }
          >
            {initialData.isPublished ? 'Publiée' : 'Brouillon'}
          </span>
        </div>
      </div>

      {/* ── Tabs — Infos par défaut (premier écran à remplir) ─────────── */}
      <Tabs defaultValue="infos" className="space-y-4">
        <TabsList>
          <TabsTrigger value="infos">Infos</TabsTrigger>
          <TabsTrigger value="appearance">Apparence</TabsTrigger>
          <TabsTrigger value="socials">Réseaux</TabsTrigger>
          <TabsTrigger value="links">Liens</TabsTrigger>
          <TabsTrigger value="share">Partage</TabsTrigger>
        </TabsList>

        <TabsContent value="infos">
          <InfosSection
            initialData={{
              title: initialData.title,
              bio: initialData.bio,
              handle: initialData.handle,
              tagline: initialData.tagline,
              slug: initialData.slug,
              avatarUrl: initialData.avatarUrl,
            }}
            onMutation={handleMutation}
          />
        </TabsContent>

        <TabsContent value="appearance">
          <AppearanceSection
            initialData={{
              accentColor: initialData.accentColor,
              titleColor: initialData.titleColor,
              bioColor: initialData.bioColor,
              linkColor: initialData.linkColor,
            }}
            onMutation={handleMutation}
          />
        </TabsContent>

        <TabsContent value="socials">
          <SocialsSection
            initialSocials={parseInitialSocials(initialData.socialLinks)}
            onMutation={handleMutation}
          />
        </TabsContent>

        <TabsContent value="links">
          <LinksSection
            bioPageId={initialData.id}
            initialLinks={initialData.links}
            onMutation={handleMutation}
          />
        </TabsContent>

        <TabsContent value="share">
          <ShareSection
            slug={initialData.slug}
            isPublished={initialData.isPublished}
            onMutation={handleMutation}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
