/**
 * @file app/(auth)/register/loading.tsx
 * @description Skeleton de la page d'inscription.
 *   Reproduit la structure de register/page.tsx :
 *   - En-tête (titre + sous-titre)
 *   - 4 champs de formulaire (nom, email, password, confirm)
 *   - Bouton de soumission
 *   Cf. CLAUDE.md §11 — skeleton qui épouse la forme du composant réel.
 */

import { Skeleton } from '@/components/ui/skeleton'

/**
 * Skeleton de la page d'inscription — activé automatiquement par Next.js Suspense.
 */
export default function RegisterLoading(): React.JSX.Element {
  return (
    <div className="w-full max-w-md">
      {/* ── En-tête ─────────────────────────────────────────────────── */}
      <div className="mb-8 text-center space-y-2">
        <Skeleton className="mx-auto h-8 w-56" />
        <Skeleton className="mx-auto h-4 w-64" />
      </div>

      {/* ── Carte ───────────────────────────────────────────────────── */}
      <div className="rounded-xl border bg-card p-8 shadow-sm space-y-4">
        {/* 4 champs : nom, email, password, confirmation */}
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-10 w-full rounded-md" />
          </div>
        ))}

        {/* Bouton submit */}
        <Skeleton className="mt-2 h-10 w-full rounded-md" />
      </div>

      {/* ── Lien connexion ──────────────────────────────────────────── */}
      <Skeleton className="mx-auto mt-6 h-4 w-44" />
    </div>
  )
}
