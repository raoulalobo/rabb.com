/**
 * @file modules/posts/components/PostComposer/DateTimePicker.tsx
 * @module posts
 * @description Sélecteur de date et heure composé d'un bouton déclencheur et
 *   d'un popover contenant un calendrier mensuel (shadcn/react-day-picker) et
 *   un sélecteur d'heure/minute avec flèches de navigation.
 *
 *   Flux utilisateur :
 *   1. L'utilisateur clique sur le bouton déclencheur → popover s'ouvre
 *   2. L'utilisateur clique sur un jour dans le calendrier → date mise à jour
 *      avec l'heure courante du spinner (défaut : 09:00)
 *   3. L'utilisateur ajuste l'heure/minute avec les flèches ou la molette
 *   4. La valeur remonte via `onChange(date)` à chaque modification
 *   5. Le × dans le bouton efface la sélection (onChange(null))
 *
 * @example
 *   <DateTimePicker
 *     value={scheduledFor}
 *     onChange={setScheduledFor}
 *     minDate={new Date()}
 *     placeholder="Choisir une date de publication"
 *   />
 */

'use client'

import { fr } from 'date-fns/locale'
import { CalendarIcon, ChevronDown, ChevronUp, X } from 'lucide-react'
import { useRef, useState } from 'react'

import { Calendar } from '@/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

interface DateTimePickerProps {
  /** Date/heure actuellement sélectionnée, ou null si vide */
  value: Date | null
  /** Callback appelé à chaque modification (jour ou heure) */
  onChange: (date: Date | null) => void
  /** Date minimale autorisée dans le calendrier (les jours antérieurs sont grisés) */
  minDate?: Date
  /** Désactive toute interaction quand true */
  disabled?: boolean
  /** Texte affiché dans le bouton quand aucune date n'est sélectionnée */
  placeholder?: string
}

// ─── Helpers de formatage ─────────────────────────────────────────────────────

/**
 * Formate une date pour l'affichage compact dans le bouton déclencheur.
 * Utilise les API Intl natives pour éviter toute dépendance date-fns.
 *
 * @param date - La date à formater
 * @returns Chaîne lisible, ex. "lun. 24 févr. à 09:00"
 */
function formatTrigger(date: Date): string {
  const dayPart = date.toLocaleDateString('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
  const timePart = date.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  })
  return `${dayPart} à ${timePart}`
}

/**
 * Arrondit les minutes à l'intervalle de 5 min le plus proche.
 * Permet d'initialiser le spinner minute sur une valeur "propre".
 *
 * @param minutes - Valeur brute des minutes (0-59)
 * @returns Valeur arrondie au multiple de 5 (0, 5, 10, ..., 55)
 */
function roundMinutes(minutes: number): number {
  return Math.round(minutes / 5) * 5 % 60
}

// ─── Sous-composant : spinner heure/minute ─────────────────────────────────

interface TimeSpinnerProps {
  /** Valeur courante (entier) */
  value: number
  /** Valeur minimale (incluse) */
  min: number
  /** Valeur maximale (incluse) */
  max: number
  /** Pas d'incrémentation (défaut : 1) */
  step?: number
  /** Callback appelé avec la nouvelle valeur */
  onChange: (value: number) => void
  /** Label accessibilité (ex: "heures", "minutes") */
  ariaLabel: string
}

/**
 * Spinner numérique avec boutons haut/bas pour sélectionner une valeur
 * dans un intervalle cyclique (overflow → retour à l'opposé).
 * Supporte aussi la molette de la souris et les touches clavier.
 *
 * @example
 *   <TimeSpinner value={9} min={0} max={23} onChange={setHour} ariaLabel="heures" />
 */
function TimeSpinner({
  value,
  min,
  max,
  step = 1,
  onChange,
  ariaLabel,
}: TimeSpinnerProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)

  /** Incrémente la valeur, revient à min si on dépasse max */
  const increment = (): void => {
    const next = value + step
    onChange(next > max ? min : next)
  }

  /** Décrémente la valeur, revient à max si on passe sous min */
  const decrement = (): void => {
    const prev = value - step
    onChange(prev < min ? max : prev)
  }

  /** Gestion de la molette de la souris (up = incrément, down = décrément) */
  const handleWheel = (e: React.WheelEvent): void => {
    e.preventDefault()
    e.stopPropagation()
    if (e.deltaY < 0) increment()
    else decrement()
  }

  return (
    <div
      ref={containerRef}
      className="flex flex-col items-center gap-0.5"
      onWheel={handleWheel}
      aria-label={ariaLabel}
    >
      {/* Flèche haut */}
      <button
        type="button"
        onClick={increment}
        className={cn(
          'rounded p-0.5 text-muted-foreground transition-colors',
          'hover:bg-accent hover:text-accent-foreground',
          'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
        )}
        aria-label={`Augmenter les ${ariaLabel}`}
      >
        <ChevronUp className="size-3.5" />
      </button>

      {/* Valeur affichée — toujours sur 2 chiffres */}
      <span className="w-7 select-none text-center font-mono text-sm tabular-nums">
        {String(value).padStart(2, '0')}
      </span>

      {/* Flèche bas */}
      <button
        type="button"
        onClick={decrement}
        className={cn(
          'rounded p-0.5 text-muted-foreground transition-colors',
          'hover:bg-accent hover:text-accent-foreground',
          'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
        )}
        aria-label={`Diminuer les ${ariaLabel}`}
      >
        <ChevronDown className="size-3.5" />
      </button>
    </div>
  )
}

// ─── Composant principal ───────────────────────────────────────────────────────

/**
 * Sélecteur de date et heure avec popover calendrier + spinners heure/minute.
 * Composant contrôlé : la valeur est toujours pilotée par le parent via
 * `value` et `onChange`.
 *
 * @param props - Voir interface `DateTimePickerProps`
 * @returns Bouton déclencheur + popover avec calendrier et spinners
 */
export function DateTimePicker({
  value,
  onChange,
  minDate,
  disabled = false,
  placeholder = 'Choisir une date…',
}: DateTimePickerProps): React.JSX.Element {
  const [open, setOpen] = useState(false)

  // ── État "en attente" pour l'heure/minute avant qu'un jour soit sélectionné ──
  // Quand `value` est null (aucun jour sélectionné), l'utilisateur peut quand
  // même pré-régler l'heure : ces valeurs seront appliquées au premier clic
  // sur un jour dans le calendrier.
  const [pendingHour, setPendingHour] = useState<number>(9)
  const [pendingMinute, setPendingMinute] = useState<number>(0)

  // Valeurs affichées dans les spinners :
  // - si une date est sélectionnée → dérivées directement depuis `value` (pas d'état local)
  // - sinon → état interne "pending" (heure pré-réglée sans jour)
  // Ce pattern évite le useEffect pour synchroniser state/props (anti-pattern React).
  const displayHour = value ? value.getHours() : pendingHour
  const displayMinute = value ? roundMinutes(value.getMinutes()) : pendingMinute

  // ── Sélection d'un jour dans le calendrier ────────────────────────────────

  /**
   * Appelé quand l'utilisateur clique sur un jour dans le calendrier.
   * Combine le jour sélectionné avec l'heure/minute courante (displayHour/displayMinute).
   * Si aucun jour n'était encore sélectionné, les valeurs "pending" sont utilisées.
   */
  const handleDaySelect = (day: Date | undefined): void => {
    if (!day) {
      onChange(null)
      return
    }
    // Appliquer l'heure affichée dans les spinners sur le nouveau jour
    const combined = new Date(day)
    combined.setHours(displayHour, displayMinute, 0, 0)
    onChange(combined)
  }

  // ── Mise à jour de l'heure ────────────────────────────────────────────────

  /**
   * Met à jour les heures.
   * Si un jour est sélectionné → met à jour la date complète via onChange.
   * Sinon → met à jour l'état "pending" (heure pré-réglée).
   */
  const handleHourChange = (hour: number): void => {
    if (value) {
      const updated = new Date(value)
      updated.setHours(hour)
      onChange(updated)
    } else {
      setPendingHour(hour)
    }
  }

  /**
   * Met à jour les minutes.
   * Même logique que handleHourChange : date complète si jour sélectionné, pending sinon.
   */
  const handleMinuteChange = (minute: number): void => {
    if (value) {
      const updated = new Date(value)
      updated.setMinutes(minute, 0, 0)
      onChange(updated)
    } else {
      setPendingMinute(minute)
    }
  }

  // ── Effacement de la sélection ────────────────────────────────────────────

  /**
   * Efface la date sélectionnée sans ouvrir/fermer le popover.
   * stopPropagation empêche le clic de remonter au DropdownTrigger.
   */
  const handleClear = (e: React.MouseEvent): void => {
    e.stopPropagation()
    onChange(null)
  }

  // ─── Rendu ───────────────────────────────────────────────────────────────

  return (
    <Popover open={open} onOpenChange={disabled ? undefined : setOpen}>
      {/* ── Bouton déclencheur ──────────────────────────────────────────── */}
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            // Base : aspect "input"
            'flex h-9 w-full items-center gap-2 rounded-md border border-input',
            'bg-background px-3 text-sm shadow-sm transition-colors',
            // Focus
            'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
            // Désactivé
            'disabled:cursor-not-allowed disabled:opacity-50',
            // Couleur du texte selon état
            value ? 'text-foreground' : 'text-muted-foreground',
          )}
          aria-label={value ? `Date de publication : ${formatTrigger(value)}` : placeholder}
        >
          {/* Icône calendrier */}
          <CalendarIcon className="size-4 shrink-0 text-muted-foreground" />

          {/* Texte : date formatée ou placeholder */}
          <span className="flex-1 text-left">
            {value ? formatTrigger(value) : placeholder}
          </span>

          {/* Bouton ✕ pour effacer — visible uniquement si une date est sélectionnée */}
          {value && (
            <span
              role="button"
              tabIndex={0}
              onClick={handleClear}
              onKeyDown={(e) => e.key === 'Enter' && handleClear(e as unknown as React.MouseEvent)}
              className={cn(
                'ml-auto rounded p-0.5 text-muted-foreground transition-colors',
                'hover:text-foreground',
                'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
              )}
              aria-label="Effacer la date de planification"
            >
              <X className="size-3.5" />
            </span>
          )}
        </button>
      </PopoverTrigger>

      {/* ── Contenu du popover ──────────────────────────────────────────── */}
      <PopoverContent
        className="w-auto p-0"
        align="start"
        // data-slot pour permettre le thème calendrier via CSS selector
        data-slot="popover-content"
      >
        {/* Calendrier mensuel — locale française */}
        <Calendar
          mode="single"
          selected={value ?? undefined}
          onSelect={handleDaySelect}
          // Désactiver les jours avant minDate (ou aujourd'hui si non précisé)
          disabled={minDate ? { before: minDate } : { before: new Date() }}
          locale={fr}
          // Commence la semaine le lundi (ISO)
          weekStartsOn={1}
          autoFocus
        />

        {/* Séparateur visuel entre calendrier et sélecteur d'heure */}
        <div className="mx-3 border-t" />

        {/* Sélecteur d'heure et de minutes */}
        <div className="flex items-center justify-center gap-1 px-3 py-3">
          <span className="text-xs text-muted-foreground">Heure</span>

          {/* Spinner heures (0 → 23, pas 1) */}
          <TimeSpinner
            value={displayHour}
            min={0}
            max={23}
            step={1}
            onChange={handleHourChange}
            ariaLabel="heures"
          />

          {/* Séparateur visuel ":" */}
          <span className="mb-0.5 text-sm font-medium text-foreground">:</span>

          {/* Spinner minutes (0 → 55, pas 5) */}
          <TimeSpinner
            value={displayMinute}
            min={0}
            max={55}
            step={5}
            onChange={handleMinuteChange}
            ariaLabel="minutes"
          />
        </div>
      </PopoverContent>
    </Popover>
  )
}
