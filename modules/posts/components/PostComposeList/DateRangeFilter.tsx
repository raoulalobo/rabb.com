/**
 * @file modules/posts/components/PostComposeList/DateRangeFilter.tsx
 * @module posts
 * @description Filtre par intervalle de date sur `scheduledFor` pour la page /compose.
 *
 *   Affiche un bouton "Date" qui ouvre un Dialog shadcn/ui (modal centré avec overlay sombre).
 *   L'utilisateur sélectionne une plage de dates dans un calendrier à 2 mois côte à côte.
 *   La confirmation se fait via le bouton "Appliquer" — les changements en cours (pendingRange)
 *   ne sont pas propagés tant que l'utilisateur n'a pas confirmé.
 *
 *   Comportement :
 *   - Posts sans `scheduledFor` (null) → exclus si le filtre est actif
 *   - Plage d'un seul jour possible (from === to)
 *   - "Effacer" dans le Dialog réinitialise le filtre ET ferme le Dialog
 *   - Fermer le Dialog sans confirmer (croix ou clic overlay) annule la sélection en cours
 *
 *   Conçu pour s'utiliser en AND avec PlatformFilter et StatusFilter dans PostComposeList.
 *
 * @example
 *   const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined)
 *
 *   <DateRangeFilter
 *     dateRange={dateRange}
 *     onChange={setDateRange}
 *   />
 */

'use client'

import { CalendarDays } from 'lucide-react'
import { useState } from 'react'
import type { DateRange } from 'react-day-picker'
import { format, isSameDay } from 'date-fns'
import { fr } from 'date-fns/locale'

import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

// ─── Props ────────────────────────────────────────────────────────────────────

interface DateRangeFilterProps {
  /** Intervalle de dates confirmé (undefined = aucun filtre actif) */
  dateRange: DateRange | undefined
  /**
   * Callback déclenché uniquement sur "Appliquer" ou "Effacer".
   * Reçoit `undefined` quand le filtre est effacé.
   */
  onChange: (range: DateRange | undefined) => void
}

// ─── Utilitaire : label dynamique du bouton trigger ───────────────────────────

/**
 * Formate l'intervalle sélectionné pour l'affichage dans le bouton déclencheur.
 *
 * @param range - Intervalle confirmé (undefined = aucun filtre actif)
 * @returns "Date" si pas de filtre, "16 fév" si un seul jour, "16 fév – 22 fév" si plage
 *
 * @example
 *   formatRangeLabel(undefined)                          // → "Date"
 *   formatRangeLabel({ from: new Date('2025-02-16') })   // → "16 fév"
 *   formatRangeLabel({ from: new Date('2025-02-16'), to: new Date('2025-02-22') })
 *   // → "16 fév – 22 fév"
 */
function formatRangeLabel(range: DateRange | undefined): string {
  // Pas de filtre actif → libellé générique
  if (!range?.from) return 'Date'

  const from = format(range.from, 'd MMM', { locale: fr })

  // Plage d'un seul jour (ou `to` absent) → afficher uniquement la date de début
  if (!range.to || isSameDay(range.from, range.to)) return from

  // Plage multi-jours → "16 fév – 22 fév"
  return `${from} – ${format(range.to, 'd MMM', { locale: fr })}`
}

// ─── Composant ────────────────────────────────────────────────────────────────

/**
 * Bouton "Date" ouvrant un Dialog avec double calendrier pour filtrer par intervalle.
 *
 * - Filtre confirmé uniquement sur "Appliquer"
 * - Annulation automatique si le Dialog est fermé sans confirmation
 * - Point indicateur bleu sur le bouton si un filtre est actif
 * - "Effacer" supprime le filtre ET ferme le Dialog
 *
 * @param dateRange - Intervalle de dates actuellement appliqué comme filtre
 * @param onChange  - Callback avec le nouvel intervalle (ou undefined pour effacer)
 */
export function DateRangeFilter({
  dateRange,
  onChange,
}: DateRangeFilterProps): React.JSX.Element {
  // ── État d'ouverture du Dialog ─────────────────────────────────────────────
  const [open, setOpen] = useState(false)

  // ── Sélection en cours (non confirmée) ────────────────────────────────────
  // N'est propagée vers le parent qu'à l'appui sur "Appliquer".
  // Initialisé avec le filtre confirmé à l'ouverture du Dialog.
  const [pendingRange, setPendingRange] = useState<DateRange | undefined>(dateRange)

  // ── Callbacks ──────────────────────────────────────────────────────────────

  /**
   * Gère l'ouverture/fermeture du Dialog.
   * À l'ouverture : synchronise `pendingRange` avec le filtre confirmé
   * (pré-remplit la sélection avec ce qui est actuellement actif).
   *
   * @param isOpen - Nouvel état d'ouverture du Dialog
   */
  const handleOpenChange = (isOpen: boolean): void => {
    if (isOpen) {
      // Pré-remplir la sélection avec le filtre actuellement confirmé
      setPendingRange(dateRange)
    }
    setOpen(isOpen)
  }

  /**
   * Efface la sélection en cours ET le filtre confirmé, puis ferme le Dialog.
   * Les autres filtres (plateforme, statut) restent inchangés.
   */
  const handleClear = (): void => {
    setPendingRange(undefined)
    onChange(undefined)
    setOpen(false)
  }

  /**
   * Confirme `pendingRange` comme nouveau filtre actif et ferme le Dialog.
   * Désactivé si aucune date de début n'est sélectionnée.
   */
  const handleApply = (): void => {
    onChange(pendingRange)
    setOpen(false)
  }

  // ── Rendu ──────────────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {/* ── Bouton déclencheur ───────────────────────────────────────────────── */}
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <CalendarDays className="size-3.5" />
          {/* Label dynamique : "Date" ou "16 fév – 22 fév" */}
          {formatRangeLabel(dateRange)}
          {/* Point indicateur de filtre actif — visible uniquement si un filtre est confirmé */}
          {dateRange?.from && (
            <span className="ml-0.5 size-1.5 rounded-full bg-primary" aria-hidden="true" />
          )}
        </Button>
      </DialogTrigger>

      {/* ── Contenu du Dialog ────────────────────────────────────────────────── */}
      <DialogContent className="sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle>Filtrer par intervalle de date</DialogTitle>
          <DialogDescription>
            Sélectionnez une période pour filtrer les posts planifiés.
            Les brouillons sans date planifiée ne seront pas affichés.
          </DialogDescription>
        </DialogHeader>

        {/* Calendrier à 2 mois côte à côte en mode range */}
        <Calendar
          mode="range"
          selected={pendingRange}
          onSelect={setPendingRange}
          numberOfMonths={2}
          className="mx-auto"
        />

        {/* ── Pied de Dialog : Effacer / Appliquer ──────────────────────────── */}
        <DialogFooter className="gap-2">
          {/* "Effacer" : réinitialise le filtre et ferme le Dialog */}
          <Button variant="ghost" onClick={handleClear}>
            Effacer
          </Button>
          {/* "Appliquer" : confirme la sélection — désactivé si pas de date de début */}
          <Button onClick={handleApply} disabled={!pendingRange?.from}>
            Appliquer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
