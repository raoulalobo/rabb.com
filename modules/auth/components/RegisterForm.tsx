/**
 * @file modules/auth/components/RegisterForm.tsx
 * @module auth
 * @description Formulaire d'inscription (nom + email + mot de passe + confirmation).
 *   - Validation Zod côté client via react-hook-form
 *   - Appelle better-auth signUp.email()
 *   - Affiche un message de succès invitant à vérifier l'email
 *   - Gère les états de chargement et d'erreur via useAuthStore
 *
 * @example
 *   // app/(auth)/register/page.tsx
 *   <RegisterForm />
 */

'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { CheckCircle2, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'


import { Button } from '@/components/ui/button'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/ui/password-input'
import { signUp } from '@/lib/auth-client'
import { RegisterSchema } from '@/modules/auth/schemas/auth.schema'
import type { RegisterFormData } from '@/modules/auth/schemas/auth.schema'
import { useAuthStore } from '@/modules/auth/store/auth.store'

// ─── Composant ────────────────────────────────────────────────────────────────

/**
 * Formulaire d'inscription complet.
 * Après succès, affiche un message demandant à l'utilisateur de vérifier son email.
 *
 * @returns Formulaire d'inscription ou message de succès post-inscription
 */
export function RegisterForm(): React.JSX.Element {
  // Affiche le message de succès post-inscription
  const [isSuccess, setIsSuccess] = useState(false)
  // Email soumis (pour l'afficher dans le message de succès)
  const [submittedEmail, setSubmittedEmail] = useState('')

  const { isLoading, error, setLoading, setError, reset } = useAuthStore()

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
  // Capacité Late atteinte — le hook before d'inscription a bloqué la création
  if (msg.includes('late_capacity_reached')) {
    return "Les inscriptions sont temporairement suspendues. Réessaie dans quelques heures."
  }

  return 'Une erreur est survenue. Réessaie.'
}
