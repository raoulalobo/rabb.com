/**
 * @file app/(auth)/login/page.tsx
 * @description Page de connexion (/login).
 *   Carte centrée avec le LoginForm (email/password + Google OAuth).
 */

import Link from 'next/link'

import { LoginForm } from '@/modules/auth/components/LoginForm'

import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Connexion',
}

/**
 * Page de connexion.
 * Server Component — le formulaire lui-même est un Client Component (LoginForm).
 */
export default function LoginPage(): React.JSX.Element {
  return (
    <div className="w-full max-w-md">
      {/* ── En-tête ─────────────────────────────────────────────────── */}
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold tracking-tight">Connexion à rabb</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Planifie et publie ton contenu sur tous tes réseaux
        </p>
      </div>

      {/* ── Carte de formulaire ─────────────────────────────────────── */}
      <div className="rounded-xl border bg-card p-8 shadow-sm">
        {/* showGoogleOAuth lu côté serveur — évite d'exposer les clés au client */}
        <LoginForm
          showGoogleOAuth={
            !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET
          }
        />
      </div>

      {/* ── Lien vers l'inscription ─────────────────────────────────── */}
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Pas encore de compte ?{' '}
        <Link href="/register" className="font-medium text-primary hover:underline">
          Créer un compte
        </Link>
      </p>
    </div>
  )
}
