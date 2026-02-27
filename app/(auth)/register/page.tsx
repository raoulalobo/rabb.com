/**
 * @file app/(auth)/register/page.tsx
 * @description Page d'inscription (/register).
 *   Carte centrée avec le RegisterForm (nom + email + password + confirmation).
 */

import Link from 'next/link'

import { RegisterForm } from '@/modules/auth/components/RegisterForm'

import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Créer un compte',
}

/**
 * Page d'inscription.
 * Server Component — le formulaire est un Client Component (RegisterForm).
 */
export default function RegisterPage(): React.JSX.Element {
  return (
    <div className="w-full max-w-md">
      {/* ── En-tête ─────────────────────────────────────────────────── */}
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold tracking-tight">Créer ton compte ogolong</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Commence à planifier ton contenu gratuitement
        </p>
      </div>

      {/* ── Carte de formulaire ─────────────────────────────────────── */}
      <div className="rounded-xl border bg-card p-8 shadow-sm">
        <RegisterForm />
      </div>

      {/* ── Lien vers la connexion ─────────────────────────────────── */}
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Déjà un compte ?{' '}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Se connecter
        </Link>
      </p>
    </div>
  )
}
