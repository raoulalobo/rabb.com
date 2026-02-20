/**
 * @file app/(auth)/login/loading.tsx
 * @description Skeleton de la page de connexion.
 *   Reproduit fidèlement la structure de login/page.tsx :
 *   - En-tête (titre + sous-titre)
 *   - Bouton Google (pleine largeur)
 *   - Séparateur
 *   - 2 champs de formulaire (email + password)
 *   - Bouton de soumission
 *   Cf. CLAUDE.md §11 — skeleton qui épouse la forme du composant réel.
 */

import { Skeleton } from '@/components/ui/skeleton'

/**
 * Skeleton de la page de connexion — activé automatiquement par Next.js Suspense.
 */
export default function LoginLoading(): React.JSX.Element {
  return (
    <div className="w-full max-w-md">
      {/* ── En-tête ─────────────────────────────────────────────────── */}
      <div className="mb-8 text-center space-y-2">
        <Skeleton className="mx-auto h-8 w-48" />
        <Skeleton className="mx-auto h-4 w-72" />
      </div>

      {/* ── Carte ───────────────────────────────────────────────────── */}
      <div className="rounded-xl border bg-card p-8 shadow-sm space-y-6">
        {/* Bouton Google */}
        <Skeleton className="h-10 w-full rounded-md" />

        {/* Séparateur */}
        <div className="flex items-center gap-2">
          <Skeleton className="h-px flex-1" />
          <Skeleton className="h-3 w-4" />
          <Skeleton className="h-px flex-1" />
        </div>

        <div className="space-y-4">
          {/* Champ email */}
          <div className="space-y-2">
            <Skeleton className="h-4 w-10" />
            <Skeleton className="h-10 w-full rounded-md" />
          </div>

          {/* Champ mot de passe */}
          <div className="space-y-2">
            <div className="flex justify-between">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-32" />
            </div>
            <Skeleton className="h-10 w-full rounded-md" />
          </div>

          {/* Bouton submit */}
          <Skeleton className="h-10 w-full rounded-md" />
        </div>
      </div>

      {/* ── Lien inscription ────────────────────────────────────────── */}
      <Skeleton className="mx-auto mt-6 h-4 w-48" />
    </div>
  )
}
