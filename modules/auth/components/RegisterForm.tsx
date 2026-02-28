/**
 * @file modules/auth/components/RegisterForm.tsx
 * @module auth
 * @description Formulaire d'inscription (nom + email + mot de passe + confirmation).
 *   - Validation Zod côté client via react-hook-form
 *   - Appelle better-auth signUp.email() ou signIn.social('google')
 *   - Google OAuth ouvre une popup (500×600px) : la fenêtre principale reste visible
 *     avec un bouton "Annuler" qui ferme la popup et remet le formulaire à l'état initial
 *   - Fallback redirection pleine page si la popup est bloquée par le navigateur
 *   - Affiche un message de succès invitant à vérifier l'email (flux email uniquement)
 *   - Gère les états de chargement et d'erreur via useAuthStore
 *
 * @example
 *   // app/(auth)/register/page.tsx
 *   <RegisterForm showGoogleOAuth={!!process.env.GOOGLE_CLIENT_ID} />
 */

'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { CheckCircle2, Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useRef, useState } from 'react'
import { useForm } from 'react-hook-form'


import { Button } from '@/components/ui/button'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/ui/password-input'
import { authClient, signIn, signUp } from '@/lib/auth-client'
import { RegisterSchema } from '@/modules/auth/schemas/auth.schema'
import type { RegisterFormData } from '@/modules/auth/schemas/auth.schema'
import { useAuthStore } from '@/modules/auth/store/auth.store'

// ─── Composant ────────────────────────────────────────────────────────────────

interface RegisterFormProps {
  /**
   * Affiche le bouton "Continuer avec Google" uniquement si les credentials
   * Google OAuth sont configurés. Passé depuis le Server Component parent.
   */
  showGoogleOAuth?: boolean
}

/**
 * Formulaire d'inscription complet (email/password + Google OAuth).
 * Après succès email, affiche un message demandant de vérifier la boîte mail.
 * Via Google, better-auth crée le compte si inexistant ou connecte si existant.
 *
 * @param showGoogleOAuth - Affiche le bouton Google si true (défaut: false)
 * @returns Formulaire d'inscription ou message de succès post-inscription
 */
export function RegisterForm({ showGoogleOAuth = false }: RegisterFormProps): React.JSX.Element {
  const router = useRouter()

  // Affiche le message de succès post-inscription (flux email uniquement)
  const [isSuccess, setIsSuccess] = useState(false)
  // Email soumis (pour l'afficher dans le message de succès)
  const [submittedEmail, setSubmittedEmail] = useState('')
  // État de chargement propre au flux Google (séparé du isLoading email)
  const [googleLoading, setGoogleLoading] = useState(false)
  // Référence à la popup OAuth pour la fermer depuis "Annuler"
  const popupRef = useRef<Window | null>(null)

  const { isLoading, error, setLoading, setError, reset } = useAuthStore()

  /**
   * Inscription / connexion via Google OAuth dans une popup 500×600px.
   * better-auth crée le compte automatiquement si l'email Google n'existe pas encore.
   *
   * Flux :
   *  1. better-auth retourne l'URL Google sans rediriger (redirect: false)
   *  2. On ouvre cette URL dans une popup centrée
   *  3. On poll popup.closed toutes les 500ms
   *  4. À la fermeture, on vérifie la session :
   *     - session présente → redirection de l'app parente vers /dashboard
   *     - session absente  → l'utilisateur a annulé, on remet le formulaire à l'état initial
   *
   * Fallback : si la popup est bloquée (bloqueur de pub, etc.), on redirige en pleine page.
   */
  const handleGoogleSignIn = async (): Promise<void> => {
    reset()
    setGoogleLoading(true)

    // Demande l'URL OAuth à better-auth sans déclencher de redirection
    const result = await signIn.social({
      provider: 'google',
      callbackURL: '/dashboard',
      redirect: false,
    })

    if (result.error || !result.data?.url) {
      setError('Impossible de lancer la connexion Google. Réessaie.')
      setGoogleLoading(false)
      return
    }

    // Dimensions et position centrées pour la popup
    const w = 500
    const h = 600
    const left = Math.round(window.innerWidth / 2 - w / 2)
    const top = Math.round(window.innerHeight / 2 - h / 2)

    const popup = window.open(
      result.data.url,
      'google-oauth',
      `width=${w},height=${h},left=${left},top=${top},resizable=yes`,
    )

    // Fallback si la popup est bloquée par le navigateur
    if (!popup) {
      window.location.href = result.data.url
      return
    }

    popupRef.current = popup

    // Poll toutes les 500ms pour détecter la fermeture de la popup
    const interval = setInterval(async () => {
      if (!popup.closed) return
      clearInterval(interval)
      popupRef.current = null

      // Vérifier si better-auth a créé une session dans la popup
      const session = await authClient.getSession()
      if (session.data?.session) {
        router.push('/dashboard')
        router.refresh()
      } else {
        // Popup fermée sans auth → annulation ou erreur côté Google
        setGoogleLoading(false)
      }
    }, 500)
  }

  /**
   * Annule le flux Google OAuth : ferme la popup et remet le formulaire à l'état initial.
   * Appelé par le bouton "Annuler" visible pendant googleLoading.
   */
  const handleCancelGoogle = (): void => {
    popupRef.current?.close()
    popupRef.current = null
    reset()
    setGoogleLoading(false)
  }

  const form = useForm<RegisterFormData>({
    resolver: zodResolver(RegisterSchema),
    defaultValues: { name: '', email: '', password: '', confirmPassword: '' },
  })

  /**
   * Soumission du formulaire d'inscription.
   * Appelle better-auth signUp.email puis affiche le message de vérification.
   */
  const onSubmit = async (data: RegisterFormData): Promise<void> => {
    reset()
    setLoading(true)
    setSubmittedEmail(data.email)

    const result = await signUp.email({
      name: data.name,
      email: data.email,
      password: data.password,
    })

    setLoading(false)

    if (result.error) {
      setError(getErrorMessage(result.error.code, result.error.message))
      return
    }

    // Succès → afficher le message de vérification email
    setIsSuccess(true)
  }

  // ── Écran de succès post-inscription ─────────────────────────────────────
  if (isSuccess) {
    return (
      <div className="flex flex-col items-center gap-4 py-4 text-center">
        <CheckCircle2 className="size-12 text-green-500" />
        <div>
          <p className="font-medium">Vérifie ta boîte mail !</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Un email de confirmation a été envoyé à{' '}
            <span className="font-medium text-foreground">{submittedEmail}</span>.
            <br />
            Clique sur le lien pour activer ton compte.
          </p>
        </div>
      </div>
    )
  }

  // ── Formulaire ────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* ── Bouton Google OAuth (affiché uniquement si configuré) ────── */}
      {showGoogleOAuth && (
        <>
          <div className="space-y-2">
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={handleGoogleSignIn}
              disabled={googleLoading || isLoading}
            >
              {googleLoading ? (
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
              {googleLoading ? 'Connexion avec Google…' : 'Continuer avec Google'}
            </Button>

            {/* Bouton "Annuler" visible uniquement pendant le flux Google popup */}
            {googleLoading && (
              <button
                type="button"
                onClick={handleCancelGoogle}
                className="w-full text-center text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                Annuler
              </button>
            )}
          </div>

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

    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
        {/* Erreur globale */}
        {error && (
          <div className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Champ nom */}
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nom</FormLabel>
              <FormControl>
                <Input placeholder="Marie Dupont" autoComplete="name" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

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
              <FormLabel>Mot de passe</FormLabel>
              <FormControl>
                <PasswordInput
                  placeholder="Minimum 8 caractères"
                  autoComplete="new-password"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Confirmation mot de passe */}
        <FormField
          control={form.control}
          name="confirmPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Confirmer le mot de passe</FormLabel>
              <FormControl>
                <PasswordInput
                  placeholder="••••••••"
                  autoComplete="new-password"
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
          Créer mon compte
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
 * @param code    - Code d'erreur better-auth (ex: "USER_ALREADY_EXISTS")
 * @param message - Message d'erreur texte retourné par better-auth
 * @returns Message d'erreur localisé affiché à l'utilisateur
 */
function getErrorMessage(code?: string, message?: string): string {
  // Correspondance sur le code machine (plus fiable que le message texte)
  switch (code) {
    case 'USER_ALREADY_EXISTS':
      return 'Cet email est déjà utilisé. Connecte-toi ou réinitialise ton mot de passe.'
    case 'EMAIL_ALREADY_IN_USE':
      return 'Cet email est déjà utilisé. Connecte-toi ou réinitialise ton mot de passe.'
    case 'INVALID_EMAIL':
      return "Format d'email invalide."
    case 'PASSWORD_TOO_SHORT':
      return 'Le mot de passe doit contenir au moins 8 caractères.'
    case 'PASSWORD_TOO_LONG':
      return 'Le mot de passe ne peut pas dépasser 72 caractères.'
    case 'INVALID_PASSWORD':
      return 'Le mot de passe ne respecte pas les critères requis.'
    case 'TOO_MANY_REQUESTS':
      return 'Trop de tentatives. Attends quelques minutes avant de réessayer.'
  }

  // Fallback : analyse du message texte pour les codes inconnus
  const msg = message?.toLowerCase() ?? ''
  if (msg.includes('email already') || msg.includes('user already')) {
    return 'Cet email est déjà utilisé. Connecte-toi ou réinitialise ton mot de passe.'
  }
  if (msg.includes('password')) return 'Le mot de passe ne respecte pas les critères requis.'
  if (msg.includes('too many')) return 'Trop de tentatives. Attends quelques minutes avant de réessayer.'

  return 'Une erreur est survenue. Réessaie.'
}
