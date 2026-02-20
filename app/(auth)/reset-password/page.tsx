/**
 * @file app/(auth)/reset-password/page.tsx
 * @description Page de réinitialisation de mot de passe (/reset-password).
 *   Formulaire simple : saisie de l'email → envoi du lien de reset via better-auth.
 *   La page du nouveau mot de passe (étape 2) sera gérée par better-auth
 *   via le lien dans l'email (callbackUrl vers cette même route avec token).
 */

'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { CheckCircle2, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'
import { useForm } from 'react-hook-form'


import { Button } from '@/components/ui/button'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { authClient } from '@/lib/auth-client'
import { ForgotPasswordSchema } from '@/modules/auth/schemas/auth.schema'
import type { ForgotPasswordFormData } from '@/modules/auth/schemas/auth.schema'

// Note : metadata ne peut pas être exporté depuis un Client Component en Next.js.
// La metadata de cette page est définie via generateMetadata ou dans un Server Component parent.
// Pour le MVP, le titre est géré par le layout racine (template '%s · rabb').

/**
 * Page de demande de réinitialisation de mot de passe.
 * Client Component car il utilise react-hook-form et l'état local.
 */
export default function ResetPasswordPage(): React.JSX.Element {
  const [isSuccess, setIsSuccess] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const form = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(ForgotPasswordSchema),
    defaultValues: { email: '' },
  })

  /**
   * Envoie le lien de réinitialisation via better-auth.
   * Better-auth envoie un email avec un lien vers /reset-password?token=...
   */
  const onSubmit = async (data: ForgotPasswordFormData): Promise<void> => {
    setError(null)
    setIsLoading(true)

    const result = await authClient.requestPasswordReset({
      email: data.email,
      // URL de callback : better-auth y ajoute le token de reset
      redirectTo: `${window.location.origin}/reset-password`,
    })

    setIsLoading(false)

    if (result.error) {
      // Ne pas révéler si l'email existe ou non (sécurité)
      // On affiche le succès dans tous les cas
    }

    setIsSuccess(true)
  }

  // ── Écran de succès ──────────────────────────────────────────────────────
  if (isSuccess) {
    return (
      <div className="w-full max-w-md">
        <div className="rounded-xl border bg-card p-8 shadow-sm">
          <div className="flex flex-col items-center gap-4 text-center">
            <CheckCircle2 className="size-12 text-green-500" />
            <div>
              <p className="font-medium">Vérifie ta boîte mail</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Si cet email est associé à un compte, tu recevras un lien de
                réinitialisation dans quelques minutes.
              </p>
            </div>
            <Link href="/login" className="text-sm font-medium text-primary hover:underline">
              Retour à la connexion
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // ── Formulaire ────────────────────────────────────────────────────────────
  return (
    <div className="w-full max-w-md">
      {/* En-tête */}
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold tracking-tight">Mot de passe oublié ?</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Saisis ton email pour recevoir un lien de réinitialisation
        </p>
      </div>

      {/* Carte de formulaire */}
      <div className="rounded-xl border bg-card p-8 shadow-sm">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
            {error && (
              <div className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
            )}

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

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 size-4 animate-spin" />}
              Envoyer le lien
            </Button>
          </form>
        </Form>
      </div>

      {/* Lien retour */}
      <p className="mt-6 text-center text-sm text-muted-foreground">
        <Link href="/login" className="font-medium text-primary hover:underline">
          ← Retour à la connexion
        </Link>
      </p>
    </div>
  )
}
