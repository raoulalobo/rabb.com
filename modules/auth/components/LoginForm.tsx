/**
 * @file modules/auth/components/LoginForm.tsx
 * @module auth
 * @description Formulaire de connexion email/password + bouton Google OAuth.
 *   - Validation côté client avec Zod via react-hook-form
 *   - Appelle better-auth signIn.email() et signIn.social()
 *   - Gère les états de chargement et d'erreur via useAuthStore
 *   - Redirige vers / (dashboard) après connexion réussie
 *
 * @example
 *   // app/(auth)/login/page.tsx
 *   <LoginForm />
 */

'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useForm } from 'react-hook-form'


import { Button } from '@/components/ui/button'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/ui/password-input'
import { signIn } from '@/lib/auth-client'
import { LoginSchema } from '@/modules/auth/schemas/auth.schema'
import type { LoginFormData } from '@/modules/auth/schemas/auth.schema'
import { useAuthStore } from '@/modules/auth/store/auth.store'

// ─── Composant ────────────────────────────────────────────────────────────────

interface LoginFormProps {
  /**
   * Affiche le bouton "Continuer avec Google" uniquement si les credentials
   * Google OAuth sont configurés. Passé depuis le Server Component parent.
   */
  showGoogleOAuth?: boolean
}

/**
 * Formulaire de connexion complet (email/password + Google OAuth).
 * Redirige vers la callbackUrl (si présente) ou vers / après succès.
 *
 * @param showGoogleOAuth - Affiche le bouton Google si true (défaut: false)
 * @returns Formulaire de connexion avec gestion d'erreurs et de chargement
 */
export function LoginForm({ showGoogleOAuth = false }: LoginFormProps): React.JSX.Element {
  const router = useRouter()
  const searchParams = useSearchParams()
  // URL de redirection post-login (paramètre ?callbackUrl=...)
  const callbackUrl = searchParams.get('callbackUrl') ?? '/'

  const { isLoading, error, setLoading, setError, reset } = useAuthStore()

  // Formulaire react-hook-form avec résolution Zod
  const form = useForm<LoginFormData>({
    resolver: zodResolver(LoginSchema),
    defaultValues: { email: '', password: '' },
  })

  /**
   * Soumission du formulaire email/password.
   * Appelle better-auth signIn.email puis redirige si succès.
   */
  const onSubmit = async (data: LoginFormData): Promise<void> => {
    reset()
    setLoading(true)

    const result = await signIn.email({
      email: data.email,
      password: data.password,
      callbackURL: callbackUrl,
    })

    setLoading(false)

    if (result.error) {
      setError(getErrorMessage(result.error.code, result.error.message))
      return
    }

    router.push(callbackUrl)
    router.refresh()
  }

  /**
   * Connexion via Google OAuth.
   * Redirige vers Google, puis better-auth gère le callback.
   */
  const handleGoogleSignIn = async (): Promise<void> => {
    reset()
    setLoading(true)

    await signIn.social({
      provider: 'google',
      callbackURL: callbackUrl,
    })

    // Le chargement reste actif jusqu'à la redirection Google
  }

  return (
    <div className="space-y-6">
      {/* ── Bouton Google OAuth (affiché uniquement si configuré) ────── */}
      {showGoogleOAuth && (
        <>
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={handleGoogleSignIn}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              // Icône Google SVG (pas de dépendance externe)
              <svg className="mr-2 size-4" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
            )}
            Continuer avec Google
          </Button>

          {/* Séparateur affiché uniquement si Google OAuth est disponible */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">ou</span>
            </div>
          </div>
        </>
      )}

      {/* ── Formulaire email/password ────────────────────────────────── */}
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
          {/* Erreur globale (retournée par better-auth) */}
          {error && (
            <div className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {/* Champ email */}
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    placeholder="vous@exemple.fr"
                    autoComplete="email"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Champ mot de passe */}
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <div className="flex items-center justify-between">
                  <FormLabel>Mot de passe</FormLabel>
                  <a
                    href="/reset-password"
                    className="text-xs text-muted-foreground hover:text-primary"
                  >
                    Mot de passe oublié ?
                  </a>
                </div>
                <FormControl>
                  <PasswordInput
                    placeholder="••••••••"
                    autoComplete="current-password"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Bouton de soumission */}
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 size-4 animate-spin" />}
            Se connecter
          </Button>
        </form>
      </Form>
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Traduit les codes/messages d'erreur better-auth en messages lisibles en français.
 * Utilise le `code` machine (prioritaire) puis le `message` texte en fallback.
 *
 * @param code    - Code d'erreur better-auth (ex: "INVALID_EMAIL_OR_PASSWORD")
 * @param message - Message d'erreur texte retourné par better-auth
 * @returns Message d'erreur localisé affiché à l'utilisateur
 */
function getErrorMessage(code?: string, message?: string): string {
  // Correspondance sur le code machine (plus fiable que le message texte)
  switch (code) {
    case 'INVALID_EMAIL_OR_PASSWORD':
      return 'Email ou mot de passe incorrect.'
    case 'EMAIL_NOT_VERIFIED':
      return "Ton email n'a pas encore été vérifié. Consulte ta boîte mail."
    case 'TOO_MANY_REQUESTS':
      return 'Trop de tentatives. Attends quelques minutes avant de réessayer.'
    case 'USER_NOT_FOUND':
      return 'Aucun compte associé à cet email.'
    case 'ACCOUNT_NOT_FOUND':
      return 'Aucun compte associé à cet email.'
    case 'SESSION_EXPIRED':
      return 'Ta session a expiré. Reconnecte-toi.'
  }

  // Fallback : analyse du message texte pour les codes inconnus
  const msg = message?.toLowerCase() ?? ''
  if (msg.includes('invalid email or password')) return 'Email ou mot de passe incorrect.'
  if (msg.includes('email not verified')) return "Ton email n'a pas encore été vérifié. Consulte ta boîte mail."
  if (msg.includes('too many requests')) return 'Trop de tentatives. Attends quelques minutes avant de réessayer.'

  return 'Une erreur est survenue. Réessaie.'
}
