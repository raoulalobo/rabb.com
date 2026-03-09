/**
 * @file app/(dashboard)/settings/SettingsTabs.tsx
 * @description Navigation par onglets de la page Paramètres.
 *   Organise les 3 grandes sections en onglets distincts pour éviter le scroll vertical :
 *   - "Réseaux sociaux" : connexion/déconnexion des comptes sociaux (PlatformList)
 *   - "Préférences"     : réglages de dictée vocale (SpeechSettings)
 *   - "Compte"          : export RGPD + suppression du compte (AccountDangerZone)
 *
 *   Client Component : nécessite JS pour la navigation entre onglets (Radix Tabs).
 *
 * @example
 *   // Dans settings/page.tsx (Server Component) :
 *   <SettingsTabs />
 */

'use client'

import { Suspense } from 'react'

import { Globe, Settings2, UserCircle } from 'lucide-react'

import { AccountDangerZone } from '@/modules/auth/components/AccountDangerZone'
import { PlatformCardSkeleton } from '@/modules/platforms/components/PlatformCardSkeleton'
import { PlatformList } from '@/modules/platforms/components/PlatformList'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

import { SpeechSettings } from './SpeechSettings'

// ─── Composant ────────────────────────────────────────────────────────────────

/**
 * Onglets de navigation des paramètres.
 * Chaque onglet affiche une section indépendante — les sections non affichées
 * ne sont pas montées dans le DOM (comportement Radix Tabs par défaut).
 *
 * @returns Onglets avec 3 sections : Réseaux, Préférences, Compte
 */
export function SettingsTabs(): React.JSX.Element {
  return (
    <Tabs defaultValue="platforms" className="max-w-2xl">
      {/* ── Barre d'onglets ─────────────────────────────────────────────────── */}
      <TabsList className="h-10">
        <TabsTrigger value="platforms" className="gap-1.5">
          <Globe className="size-3.5" />
          Réseaux sociaux
        </TabsTrigger>
        <TabsTrigger value="preferences" className="gap-1.5">
          <Settings2 className="size-3.5" />
          Préférences
        </TabsTrigger>
        <TabsTrigger value="account" className="gap-1.5">
          <UserCircle className="size-3.5" />
          Compte
        </TabsTrigger>
      </TabsList>

      {/* ── Onglet : Réseaux sociaux ─────────────────────────────────────────── */}
      <TabsContent value="platforms" className="mt-6 space-y-4 flex-none">
        {/* En-tête de section */}
        <div>
          <h2 className="text-base font-semibold text-foreground">
            Réseaux sociaux connectés
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Connecte tes comptes pour commencer à planifier et publier du contenu.
          </p>
        </div>

        {/*
         * Suspense : affiche le skeleton pendant l'hydratation côté client.
         * PlatformList gère également son propre état isLoading en interne.
         */}
        <Suspense fallback={<PlatformCardSkeleton count={5} />}>
          <PlatformList />
        </Suspense>
      </TabsContent>

      {/* ── Onglet : Préférences ─────────────────────────────────────────────── */}
      <TabsContent value="preferences" className="mt-6 space-y-4 flex-none">
        {/* En-tête de section */}
        <div>
          <h2 className="text-base font-semibold text-foreground">
            Dictée vocale
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Règle le comportement du micro lors de la saisie vocale.
          </p>
        </div>

        {/* Carte de réglage — lit/écrit speechSilenceTimeoutMs dans le store Zustand persisté */}
        <SpeechSettings />
      </TabsContent>

      {/* ── Onglet : Compte ──────────────────────────────────────────────────── */}
      <TabsContent value="account" className="mt-6 flex-none">
        {/*
         * AccountDangerZone inclut son propre en-tête de section,
         * la zone d'export RGPD et la zone de suppression.
         */}
        <AccountDangerZone />
      </TabsContent>
    </Tabs>
  )
}
