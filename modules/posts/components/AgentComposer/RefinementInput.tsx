/**
 * @file modules/posts/components/AgentComposer/RefinementInput.tsx
 * @module posts
 * @description Zone de raffinement du plan agent — visible à l'étape "plan".
 *
 *   Regroupe trois fonctionnalités :
 *   1. Gestion du pool de médias (accordéon) — ajouter/retirer des médias
 *      sans repasser à l'étape "input"
 *   2. Instruction de raffinement (texte libre) — affine le plan courant
 *      sans repartir de zéro
 *   3. Dictée vocale — via le hook `useVoiceDictation` (Web Speech API, fr-FR)
 *      Même comportement que dans AgentInput : Chrome/Edge uniquement
 *
 *   Affiche également :
 *   - Le numéro du tour courant ("Tour N")
 *   - Un badge "Sauvegardé" temporaire après auto-save du plan édité manuellement
 *
 *   Maquette (accordéon médias replié) :
 *   ┌──────────────────────────────────────────────────────┐
 *   │ ✎  Affiner le plan     [🖼 3 médias ▼]  Tour 2  ✓  │
 *   │ ┌────────────────────────────────────────────────┐  │
 *   │ │ Ex : Retire YouTube, ajoute une légende...  🎙 │  │
 *   │ └────────────────────────────────────────────────┘  │
 *   │                                      [Affiner ▶]    │
 *   └──────────────────────────────────────────────────────┘
 *
 * @example
 *   <RefinementInput
 *     value={refinementInstruction}
 *     onChange={setRefinementInstruction}
 *     onSubmit={handleRefinePlan}
 *     isLoading={isRefining}
 *     disabled={isSubmitting}
 *     turnCount={turnCount}
 *     isSaving={isSaving}
 *     mediaPool={mediaPool}
 *     uploadingFiles={uploadingFiles}
 *     onUploadMedia={handleUploadFile}
 *     onRemoveMedia={handleRemoveMedia}
 *   />
 */

'use client'

import { Check, ChevronDown, ChevronUp, ImagePlus, Loader2, Mic, MicOff, Pencil, Sparkles, Square } from 'lucide-react'
import * as React from 'react'
import { useState } from 'react'

import type { PoolMedia, UploadingFile } from '@/modules/posts/types'

import { MediaPool } from './MediaPool'
import { useVoiceDictation } from './useVoiceDictation'

// ─── Props ─────────────────────────────────────────────────────────────────────

interface RefinementInputProps {
  /** Texte de l'instruction de raffinement (contrôlé depuis le parent) */
  value: string
  /** Callback de mise à jour du texte */
  onChange: (v: string) => void
  /** Callback de soumission de l'instruction de raffinement */
  onSubmit: () => Promise<void>
  /** Vrai pendant l'appel API de raffinement (spinner sur le bouton) */
  isLoading: boolean
  /** Désactive l'input, le bouton et le pool pendant la soumission du plan */
  disabled: boolean
  /** Numéro du tour courant (affiché "Tour N") */
  turnCount: number
  /** Vrai pendant 1.5s après auto-save (badge "✓ Sauvegardé") */
  isSaving: boolean

  // ── Props du pool de médias ──────────────────────────────────────────────
  /** Médias actuellement dans le pool */
  mediaPool: PoolMedia[]
  /** Fichiers en cours d'upload */
  uploadingFiles: UploadingFile[]
  /** Callback pour uploader un fichier dans le pool */
  onUploadMedia: (file: File) => Promise<void>
  /** Callback pour retirer un média du pool */
  onRemoveMedia: (url: string) => void
}

// ─── Composant ─────────────────────────────────────────────────────────────────

/**
 * Zone de raffinement multi-tours du plan agent.
 *
 * Regroupe la gestion du pool de médias (accordéon), la saisie d'instruction
 * (texte ou dictée vocale) pour affiner le plan courant sans repartir de zéro.
 */
export function RefinementInput({
  value,
  onChange,
  onSubmit,
  isLoading,
  disabled,
  turnCount,
  isSaving,
  mediaPool,
  uploadingFiles,
  onUploadMedia,
  onRemoveMedia,
}: RefinementInputProps): React.JSX.Element {
  /** Contrôle l'ouverture de l'accordéon du pool de médias */
  const [isMediaOpen, setIsMediaOpen] = useState(false)

  const isDisabled = isLoading || disabled

  // Nombre total de fichiers (uploadés + en cours) pour le badge du bouton accordéon
  const totalMediaCount = mediaPool.length + uploadingFiles.length

  // ── Dictée vocale ──────────────────────────────────────────────────────────
  // Même comportement que AgentInput — le hook gère l'instance SpeechRecognition
  const { isRecording, isSupported, micError, interimText, handleMicToggle } =
    useVoiceDictation({ value, onChange, disabled: isDisabled })

  /**
   * Soumet l'instruction via Entrée (sans Shift).
   * Shift+Entrée insère un saut de ligne.
   */
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === 'Enter' && !e.shiftKey && !isLoading && !disabled && value.trim()) {
      e.preventDefault()
      void onSubmit()
    }
  }

  return (
    <div className="rounded-xl border border-border/60 bg-muted/30 px-4 py-4 space-y-3">
      {/* ── En-tête : titre + accordéon médias + indicateurs ─────────────────── */}
      <div className="flex items-center gap-2 flex-wrap">
        <Pencil className="size-3.5 text-muted-foreground shrink-0" />
        <span className="text-xs font-medium text-muted-foreground">Affiner le plan</span>

        {/* Séparateur flexible */}
        <span className="flex-1" />

        {/* Bouton accordéon pool de médias */}
        <button
          type="button"
          onClick={() => setIsMediaOpen((v) => !v)}
          disabled={isDisabled}
          className={[
            'flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium',
            'transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            isMediaOpen
              ? 'border-primary/40 bg-primary/10 text-primary'
              : 'border-border bg-background text-muted-foreground hover:text-foreground hover:border-foreground/20',
            isDisabled ? 'cursor-not-allowed opacity-50' : '',
          ].join(' ')}
          aria-expanded={isMediaOpen}
          aria-label="Gérer les médias du pool"
        >
          <ImagePlus className="size-3" />
          {/* Badge : affiche le compteur si des médias sont présents */}
          {totalMediaCount > 0
            ? `${totalMediaCount} média${totalMediaCount > 1 ? 's' : ''}`
            : 'Médias'}
          {/* Chevron indique l'état de l'accordéon */}
          {isMediaOpen
            ? <ChevronUp className="size-3" />
            : <ChevronDown className="size-3" />}
        </button>

        {/* Compteur de tours */}
        {turnCount > 0 && (
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
            Tour {turnCount}
          </span>
        )}

        {/* Badge "Sauvegardé" — visible 1.5s après auto-save */}
        {isSaving && (
          <span className="flex items-center gap-1 text-xs text-emerald-600">
            <Check className="size-3" />
            Sauvegardé
          </span>
        )}
      </div>

      {/* ── Accordéon : pool de médias ────────────────────────────────────────── */}
      {isMediaOpen && (
        <div className="rounded-lg border border-border/50 bg-background px-3 py-3">
          <MediaPool
            mediaPool={mediaPool}
            uploadingFiles={uploadingFiles}
            onUpload={onUploadMedia}
            onRemove={onRemoveMedia}
            disabled={isDisabled}
          />
        </div>
      )}

      {/* ── Textarea de raffinement + bouton micro ───────────────────────────── */}
      <div className="relative">
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ex : Retire YouTube, ajoute une légende sur Instagram, décale à demain 10h..."
          disabled={isDisabled}
          rows={2}
          className={[
            'w-full resize-none rounded-lg border border-input bg-background px-3 py-2.5 pr-10',
            'text-sm text-foreground placeholder:text-muted-foreground/60',
            'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1',
            'transition-colors',
            isDisabled ? 'cursor-not-allowed opacity-50' : '',
          ].join(' ')}
        />

        {/* Overlay du texte intermédiaire (résultats vocaux en cours, non finalisés) */}
        {interimText && (
          <p className="pointer-events-none absolute bottom-8 left-3 right-10 text-xs italic text-muted-foreground/60 line-clamp-1">
            {interimText}
          </p>
        )}

        {/* Bouton microphone — même design que dans AgentInput */}
        <button
          type="button"
          onClick={handleMicToggle}
          disabled={isDisabled || !isSupported}
          className={[
            'absolute bottom-2 right-2 flex size-7 items-center justify-center rounded-full',
            'transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            isRecording
              ? 'animate-pulse bg-destructive text-white shadow-md hover:bg-destructive/90'
              : !isSupported
                ? 'cursor-not-allowed bg-muted text-muted-foreground/40'
                : 'bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary cursor-pointer',
            isDisabled ? 'cursor-not-allowed opacity-50' : '',
          ].join(' ')}
          aria-label={
            !isSupported
              ? 'Dictée vocale non supportée par ce navigateur'
              : isRecording
                ? 'Arrêter la dictée vocale'
                : 'Dicter mon instruction'
          }
          title={
            !isSupported
              ? 'Utilisez Chrome ou Edge pour la dictée vocale'
              : isRecording
                ? 'Cliquer pour arrêter'
                : 'Dicter par voix (Web Speech API)'
          }
        >
          {isRecording ? (
            <Square className="size-3 fill-current" />
          ) : (
            <Mic className="size-3.5" />
          )}
        </button>
      </div>

      {/* Indicateur d'écoute en cours */}
      {isRecording && (
        <p className="flex items-center gap-1.5 text-xs text-destructive">
          <span className="inline-block size-1.5 animate-pulse rounded-full bg-destructive" />
          Écoute en cours — parlez, puis cliquez sur le bouton pour terminer
        </p>
      )}

      {/* Message si Web Speech API non supportée (affiché uniquement si le composant est actif) */}
      {!isSupported && !isDisabled && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <MicOff className="size-3.5" />
          Dictée vocale disponible uniquement sur Chrome et Edge
        </p>
      )}

      {/* Erreur microphone */}
      {micError && (
        <p className="flex items-center gap-1.5 text-xs text-destructive">
          <MicOff className="size-3.5" />
          {micError}
        </p>
      )}

      {/* ── Bouton Affiner ───────────────────────────────────────────────────── */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => void onSubmit()}
          disabled={isDisabled || !value.trim()}
          className={[
            'flex items-center gap-1.5 rounded-lg px-4 py-2',
            'bg-primary/10 text-xs font-semibold text-primary',
            'hover:bg-primary/20 active:scale-[0.98]',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            'transition-all',
            isDisabled || !value.trim() ? 'cursor-not-allowed opacity-50' : '',
          ].join(' ')}
        >
          {isLoading ? (
            <>
              <Loader2 className="size-3.5 animate-spin" />
              Raffinement...
            </>
          ) : (
            <>
              <Sparkles className="size-3.5" />
              Affiner
            </>
          )}
        </button>
      </div>
    </div>
  )
}
