/**
 * @file modules/posts/components/AgentComposer/AgentInput.tsx
 * @module posts
 * @description Zone de saisie de l'instruction pour l'AgentComposer (premier tour).
 *
 *   Permet à l'utilisateur de rédiger son instruction en :
 *   1. Texte libre — zone de texte multiligne classique
 *   2. Dictée vocale — via le hook `useVoiceDictation` (Web Speech API, fr-FR)
 *      Aucun appel réseau, aucune clé API, résultats en temps réel.
 *
 *   Compatibilité dictée :
 *   - Chrome, Edge : supporté nativement ✅
 *   - Firefox, Safari : non supporté → bouton micro désactivé avec message ℹ️
 *
 * @example
 *   <AgentInput
 *     value={instruction}
 *     onChange={setInstruction}
 *     disabled={isGenerating}
 *   />
 */

'use client'

import { Mic, MicOff, Square } from 'lucide-react'

import { useVoiceDictation } from './useVoiceDictation'

// ─── Props ────────────────────────────────────────────────────────────────────

interface AgentInputProps {
  /** Valeur actuelle de l'instruction */
  value: string
  /** Callback mis à jour à chaque frappe ou segment vocal finalisé */
  onChange: (value: string) => void
  /** Désactiver les interactions (pendant génération ou soumission) */
  disabled?: boolean
  /** Placeholder de la zone de texte */
  placeholder?: string
}

// ─── Composant ────────────────────────────────────────────────────────────────

/**
 * Zone de saisie d'instruction avec dictée vocale (Web Speech API).
 * La logique vocale est déléguée au hook `useVoiceDictation`.
 */
export function AgentInput({
  value,
  onChange,
  disabled = false,
  placeholder = 'Ex : Poste mes 5 photos sur Instagram et la vidéo sur YouTube demain à 9h...',
}: AgentInputProps): React.JSX.Element {
  const { isRecording, isSupported, micError, interimText, handleMicToggle } =
    useVoiceDictation({ value, onChange, disabled })

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-foreground">
        Votre instruction
      </label>

      {/* Zone de texte + bouton microphone */}
      <div className="relative">
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          placeholder={placeholder}
          rows={4}
          className={[
            'w-full resize-none rounded-lg border border-input bg-background px-3 py-3 pr-12',
            'text-sm leading-relaxed text-foreground placeholder:text-muted-foreground',
            'transition-colors focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30',
            'disabled:cursor-not-allowed disabled:opacity-50',
          ].join(' ')}
          aria-label="Instruction pour l'agent"
        />

        {/* Overlay du texte intermédiaire (résultats en cours, non finalisés) */}
        {interimText && (
          <p className="pointer-events-none absolute bottom-10 left-3 right-12 text-sm italic text-muted-foreground/60 line-clamp-2">
            {interimText}
          </p>
        )}

        {/* Bouton microphone */}
        <button
          type="button"
          onClick={handleMicToggle}
          disabled={disabled || !isSupported}
          className={[
            'absolute bottom-2.5 right-2.5 flex size-8 items-center justify-center rounded-full',
            'transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            isRecording
              ? 'animate-pulse bg-destructive text-white shadow-md hover:bg-destructive/90'
              : !isSupported
                ? 'cursor-not-allowed bg-muted text-muted-foreground/40'
                : 'bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary cursor-pointer',
            disabled ? 'cursor-not-allowed opacity-50' : '',
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
            <Square className="size-3.5 fill-current" />
          ) : (
            <Mic className="size-4" />
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

      {/* Message si Web Speech API non supportée */}
      {!isSupported && (
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

      {/* Compteur de caractères */}
      {value.length > 0 && (
        <p className="text-right text-xs text-muted-foreground">
          {value.length} / 2000
        </p>
      )}
    </div>
  )
}
