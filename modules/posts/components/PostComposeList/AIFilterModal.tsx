/**
 * @file modules/posts/components/PostComposeList/AIFilterModal.tsx
 * @module posts
 * @description Dialog de recherche en langage naturel pour la page /compose.
 *
 *   L'utilisateur décrit ce qu'il cherche en texte libre (ou via dictée vocale).
 *   Sonnet extrait les filtres structurés via POST /api/posts/filter-ai.
 *   Le callback onFiltersApplied reçoit les filtres et les applique côté serveur.
 *
 *   Interface :
 *   ┌─────────────────────────────────────────────┐
 *   │  Rechercher des posts                   [×] │
 *   │                                             │
 *   │  ┌───────────────────────────────────────┐  │
 *   │  │ Ex : "brouillons TikTok de la         │  │
 *   │  │ semaine prochaine"                    │  │
 *   │  └───────────────────────────────────────┘  │
 *   │                                             │
 *   │   [🎤]          [Annuler]  [Rechercher →]   │
 *   └─────────────────────────────────────────────┘
 *
 *   Dictée vocale : Web Speech API (natif navigateur, aucun appel serveur).
 *   `window.SpeechRecognition` → remplit le textarea automatiquement.
 *
 * @example
 *   <AIFilterModal
 *     open={open}
 *     onOpenChange={setOpen}
 *     currentQuery="brouillons instagram"
 *     onFiltersApplied={(filters) => {
 *       setSelectedStatuses(filters.statuses)
 *       setSelectedPlatforms(filters.platforms)
 *       setDateRange(filters.dateRange)
 *     }}
 *   />
 */

'use client'

import { Loader2, Mic, MicOff, Search } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

import type { ExtractedFilters } from '@/app/api/posts/filter-ai/route'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { useSpeechRecognition } from '@/modules/posts/hooks/useSpeechRecognition'
import { useAppStore } from '@/store/app.store'

// ─── Export du type pour les consommateurs ─────────────────────────────────────

export type { ExtractedFilters }

// ─── Props ────────────────────────────────────────────────────────────────────

interface AIFilterModalProps {
  /** Ouverture / fermeture du Dialog */
  open: boolean
  onOpenChange: (open: boolean) => void
  /**
   * Requête actuellement active — pré-remplit le textarea si l'utilisateur
   * veut modifier une recherche existante.
   */
  currentQuery: string
  /**
   * Callback déclenché après extraction réussie des filtres par Sonnet.
   * Le parent ferme le modal et applique les filtres.
   */
  onFiltersApplied: (filters: ExtractedFilters) => void
}

// ─── Composant ────────────────────────────────────────────────────────────────

/**
 * Dialog de recherche en langage naturel pour /compose.
 * Sonnet extrait les filtres structurés depuis la description libre de l'utilisateur.
 *
 * @param open           - Contrôle l'ouverture du Dialog
 * @param onOpenChange   - Callback de fermeture
 * @param currentQuery   - Pré-remplit le textarea si une recherche est déjà active
 * @param onFiltersApplied - Callback avec les filtres extraits par Sonnet
 */
export function AIFilterModal({
  open,
  onOpenChange,
  currentQuery,
  onFiltersApplied,
}: AIFilterModalProps): React.JSX.Element {
  // ── État de la requête ─────────────────────────────────────────────────────
  const [query, setQuery] = useState(currentQuery)
  const [isSearching, setIsSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ── Synchronisation avec currentQuery (quand le modal rouvre) ─────────────
  useEffect(() => {
    if (open) {
      setQuery(currentQuery)
      setError(null)
    }
  }, [open, currentQuery])

  // ── Dictée vocale : Web Speech API ─────────────────────────────────────────
  /**
   * Callback stable pour éviter de recréer la reconnaissance à chaque render.
   * Appende le texte transcrit à la requête existante.
   */
  const handleVoiceResult = useCallback((text: string): void => {
    setQuery((prev) => (prev.trim() ? `${prev.trim()} ${text}` : text))
  }, [])

  // Préférence utilisateur : délai de silence avant arrêt automatique du micro
  const speechSilenceTimeoutMs = useAppStore((s) => s.speechSilenceTimeoutMs)

  const { isListening, startListening, stopListening, isSupported } = useSpeechRecognition({
    onResult: handleVoiceResult,
    silenceTimeoutMs: speechSilenceTimeoutMs,
  })

  // ── Recherche IA ───────────────────────────────────────────────────────────

  /**
   * Appelle POST /api/posts/filter-ai avec la requête texte.
   * Sonnet extrait les filtres → onFiltersApplied ferme le modal.
   */
  const handleSearch = async (): Promise<void> => {
    const trimmedQuery = query.trim()
    if (!trimmedQuery || isSearching || isListening) return

    setError(null)
    setIsSearching(true)

    try {
      const res = await fetch('/api/posts/filter-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: trimmedQuery }),
      })

      const data = (await res.json()) as ExtractedFilters & { error?: string }

      if (!res.ok) {
        throw new Error(data.error ?? `Erreur ${res.status}`)
      }

      // Convertir les dates string → Date pour dateRange (JSON sérialise en string)
      const filters: ExtractedFilters = {
        ...data,
        // dateRange.from et to restent en string — le parent les gère via DateRange
      }

      // Appliquer les filtres et fermer le modal
      onFiltersApplied(filters)
      onOpenChange(false)
    } catch (err) {
      console.error('[AIFilterModal] Erreur recherche :', err)
      setError(
        err instanceof Error
          ? err.message
          : 'Erreur lors de la recherche. Veuillez réessayer.',
      )
    } finally {
      setIsSearching(false)
    }
  }

  // ── Fermeture propre ───────────────────────────────────────────────────────
  const handleClose = (): void => {
    if (isSearching) return // Empêcher la fermeture pendant la recherche
    stopListening()
    onOpenChange(false)
  }

  // ── Rendu ──────────────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Search className="size-4 text-muted-foreground" />
            Rechercher des posts
          </DialogTitle>
          <DialogDescription>
            Décrivez ce que vous cherchez en langage naturel.
            L&apos;IA extraira automatiquement les filtres.
          </DialogDescription>
        </DialogHeader>

        {/* ── Zone de saisie ────────────────────────────────────────────────── */}
        <div className="space-y-3">
          <Textarea
            placeholder='Ex : "brouillons TikTok de la semaine prochaine" ou "posts instagram planifiés"'
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            disabled={isSearching}
            rows={3}
            className="resize-none text-sm"
            onKeyDown={(e) => {
              // Raccourci : Entrée (sans Shift) → lancer la recherche
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                void handleSearch()
              }
            }}
            autoFocus
          />

          {/* Indicateur d'état vocal */}
          {isListening && (
            <p className="text-xs font-medium text-red-500">
              ● En cours d&apos;écoute… (parlez maintenant)
            </p>
          )}
        </div>

        {/* ── Erreur ────────────────────────────────────────────────────────── */}
        {error && (
          <div className="rounded-lg bg-destructive/10 px-3.5 py-2.5 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* ── Actions ───────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-3">
          {/* Bouton micro — uniquement si le navigateur supporte Web Speech API */}
          {isSupported ? (
            <button
              type="button"
              onClick={isListening ? stopListening : startListening}
              disabled={isSearching}
              aria-label={isListening ? 'Arrêter la dictée vocale' : 'Démarrer la dictée vocale'}
              className={[
                'flex size-8 items-center justify-center rounded-full transition-all',
                isListening
                  ? 'animate-pulse bg-red-100 text-red-500 hover:bg-red-200'
                  : 'bg-violet-100 text-violet-600 hover:bg-violet-200',
                isSearching ? 'cursor-not-allowed opacity-50' : '',
              ].join(' ')}
            >
              {isListening ? (
                <MicOff className="size-4" />
              ) : (
                <Mic className="size-4" />
              )}
            </button>
          ) : (
            /* Espace vide pour l'alignement si le micro n'est pas disponible */
            <div />
          )}

          {/* Boutons Annuler + Rechercher */}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClose}
              disabled={isSearching}
            >
              Annuler
            </Button>

            <Button
              size="sm"
              onClick={() => void handleSearch()}
              disabled={isSearching || isListening || !query.trim()}
              className="gap-2"
            >
              {isSearching ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  Recherche…
                </>
              ) : (
                <>
                  <Search className="size-3.5" />
                  Rechercher
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
