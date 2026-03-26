/**
 * @file app/(dashboard)/feedback/page.tsx
 * @description Page Feedback (/feedback).
 *   Permet aux utilisateurs connectés de laisser des remarques, signaler des bugs
 *   ou suggérer des fonctionnalités via un formulaire simple.
 *
 *   Server Component protégé — redirige vers /login si non authentifié.
 *
 * @example
 *   // Route : GET /feedback
 */

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

import { auth } from '@/lib/auth'
import { FeedbackForm } from '@/modules/feedback/components/FeedbackForm'

import type { Metadata } from 'next'

// ─── Métadonnées ──────────────────────────────────────────────────────────────

export const metadata: Metadata = {
  title: 'Feedback — ogolong',
}

// ─── Page ─────────────────────────────────────────────────────────────────────

/**
 * Page Feedback — Server Component.
 * Vérifie la session puis rend le formulaire client.
 */
export default async function FeedbackPage(): Promise<React.JSX.Element> {
  // ── Vérification de la session ─────────────────────────────────────────────
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect('/login')

  return (
    <div className="mx-auto max-w-2xl space-y-6 py-8">
      {/* ── En-tête de page ─────────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Feedback</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Partagez vos remarques, signalez un bug ou suggérez une amélioration.
          Chaque retour nous aide à améliorer ogolong.
        </p>
      </div>

      {/* ── Formulaire ─────────────────────────────────────────────────────── */}
      <FeedbackForm />
    </div>
  )
}
