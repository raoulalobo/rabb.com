/**
 * @file app/api/posts/generate/route.ts
 * @module posts
 * @description Route POST server-side pour la génération de contenu IA par plateforme.
 *   Reçoit un brief (optionnel), une liste de plateformes et une date planifiée,
 *   puis appelle Claude via callAnthropicWithFallback pour produire un texte DISTINCT
 *   par plateforme, en respectant les limites de caractères exactes de chaque réseau.
 *
 *   Logique du prompt :
 *   - Construit des contraintes par plateforme avec la limite `maxText` depuis PLATFORM_RULES
 *   - Instructions de ton propres à chaque réseau (emojis, hashtags, style)
 *   - Demande à Claude un JSON { platform: texte } — une entrée par plateforme
 *   - Mentionne le créneau si scheduledFor est fourni (ex: "prévu un lundi matin")
 *   - Répond { texts: Record<string, string> } pour que le client affiche des onglets
 *
 * @example
 *   POST /api/posts/generate
 *   Body: { brief: "Lancement fonctionnalité", platforms: ["twitter", "linkedin"], scheduledFor: "2026-03-15T10:00:00" }
 *   Response: { texts: { twitter: "Court et percutant !", linkedin: "Nous sommes fiers d'annoncer..." } }
 */

import { NextResponse } from 'next/server'

import { callAnthropicWithFallback, AGENT_MODEL } from '@/lib/ai'
import { PLATFORM_RULES } from '@/modules/platforms/config/platform-rules'

// ─── Constantes de personnalisation par plateforme ────────────────────────────

/**
 * Instructions de ton par plateforme, sans limite de caractères
 * (la limite est injectée dynamiquement depuis PLATFORM_RULES dans le prompt).
 *
 * Chaque entrée décrit : style, format, hashtags, call-to-action.
 */
const PLATFORM_TONE_HINTS: Record<string, string> = {
  instagram: 'ton chaleureux et conversationnel, emojis pertinents, 3-5 hashtags à la fin',
  tiktok: 'ton accrocheur et dynamique, commence par une question ou affirmation surprenante, emojis, appel à l\'action',
  youtube: 'description détaillée, mots-clés naturels intégrés, invite à s\'abonner et commenter',
  facebook: 'ton accessible et communautaire, peut inclure une question pour engager la discussion',
  twitter: 'très court et percutant, une seule idée forte, 1-2 hashtags maximum',
  linkedin: 'professionnel mais humain, partage de valeur ou d\'insight, pas de jargon creux, conclure par une question',
  snapchat: 'ton fun et spontané, court, emojis bienvenus, public jeune',
  pinterest: 'inspirant et descriptif, orienté DIY/lifestyle, inclure une incitation à l\'action',
  threads: 'conversationnel et authentique, réflexif, peut explorer plusieurs idées liées',
  bluesky: 'bref et percutant, ton direct et authentique',
  reddit: 'détaillé et sincère, adapté à une communauté de niche, sans langue de bois',
  telegram: 'informatif et clair, peut être structuré en points, adapté à un canal',
  google_business: 'professionnel, local, orienté service ou offre concrète',
}

// ─── Jours de la semaine en français ─────────────────────────────────────────

/** Tableau des noms de jours de la semaine pour le contexte temporel du prompt */
const JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi']

// ─── Route handler ────────────────────────────────────────────────────────────

/**
 * POST /api/posts/generate
 * Génère un texte distinct par plateforme via Claude, en respectant les limites exactes.
 *
 * @body {{ brief?: string; platforms: string[]; scheduledFor?: string | null }}
 * @returns {{ texts: Record<string, string> }} - Un texte par plateforme, prêt à injecter
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    // Extraction et validation du corps de la requête
    const body = (await request.json()) as {
      brief?: string
      platforms?: string[]
      scheduledFor?: string | null
    }

    const { brief = '', platforms = [], scheduledFor = null } = body

    // ── Construction des contraintes par plateforme ──────────────────────────
    // Pour chaque plateforme sélectionnée, on injecte : limite exacte + instructions de ton.
    // Ex: "- instagram (max 2200 chars) : ton chaleureux, 3-5 hashtags..."
    const platformConstraints = platforms
      .map((p) => {
        const key = p.toLowerCase()
        const rules = PLATFORM_RULES[key as keyof typeof PLATFORM_RULES]
        const maxText = rules?.maxText ?? 2000
        const tone = PLATFORM_TONE_HINTS[key] ?? 'ton adapté à cette plateforme'
        return `- ${key} (max ${maxText} chars) : ${tone}`
      })
      .join('\n')

    // ── Construction du contexte temporel ───────────────────────────────────
    // Si une date est fournie, extraire le jour et la tranche horaire
    let temporalContext = ''
    if (scheduledFor) {
      const date = new Date(scheduledFor)
      if (!isNaN(date.getTime())) {
        const jourSemaine = JOURS[date.getDay()]
        const heure = date.getHours()

        // Catégorisation de la tranche horaire pour adapter le ton
        let tranche: string
        if (heure < 7) tranche = 'tôt le matin'
        else if (heure < 12) tranche = 'en matinée'
        else if (heure < 14) tranche = 'en début d\'après-midi'
        else if (heure < 18) tranche = 'en après-midi'
        else if (heure < 21) tranche = 'en soirée'
        else tranche = 'en fin de soirée'

        temporalContext = `\nLe post est prévu un ${jourSemaine} ${tranche}. Adapte si pertinent le ton à ce contexte.`
      }
    }

    // ── Construction du brief utilisateur ───────────────────────────────────
    const briefContext = brief.trim()
      ? `Brief : "${brief.trim()}"`
      : 'Aucun brief fourni — génère un post original et engageant adapté à chaque plateforme.'

    // ── Prompt système ───────────────────────────────────────────────────────
    // Claude doit répondre UNIQUEMENT avec un objet JSON valide : { "platform": "texte..." }
    // Le JSON sera parsé côté serveur après strip des éventuels blocs markdown.
    const systemPrompt = `Tu es un expert en création de contenu pour les réseaux sociaux.
Tu rédiges des posts percutants, authentiques et parfaitement adaptés à leur audience.

Règles absolues :
- Réponds UNIQUEMENT avec un objet JSON valide. Aucun texte en dehors du JSON.
- Format exact : {"plateforme1": "texte...", "plateforme2": "texte..."}
- Une clé par plateforme demandée, en minuscules (ex: "twitter", "linkedin")
- N'ajoute pas de guillemets autour du contenu JSON
- Écris les textes en français (sauf si le brief est dans une autre langue)
- RESPECTE STRICTEMENT la limite de caractères indiquée pour chaque plateforme`

    // ── Message utilisateur ──────────────────────────────────────────────────
    const userMessage = `Génère un post pour chaque plateforme ci-dessous.
${briefContext}${temporalContext}

Contraintes strictes par plateforme (OBLIGATOIRES) :
${platformConstraints}`

    // ── Appel Claude avec fallback Sonnet → Opus ─────────────────────────────
    // max_tokens augmenté à 4096 pour couvrir plusieurs plateformes verbales (LinkedIn, Reddit)
    const response = await callAnthropicWithFallback({
      model: AGENT_MODEL,
      max_tokens: 4096,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: userMessage,
        },
      ],
    })

    // ── Parsing du JSON retourné par Claude ──────────────────────────────────
    const firstBlock = response.content[0]
    if (!firstBlock || firstBlock.type !== 'text') {
      return NextResponse.json({ error: 'Réponse IA invalide' }, { status: 500 })
    }

    // Claude peut entourer le JSON de ```json ... ``` → on strip les balises markdown
    const raw = firstBlock.text
      .trim()
      .replace(/^```json\n?/, '')
      .replace(/^```\n?/, '')
      .replace(/\n?```$/, '')
      .trim()

    let texts: Record<string, string>
    try {
      texts = JSON.parse(raw) as Record<string, string>
    } catch {
      // Si le JSON est malformé, on retourne une erreur explicite
      console.error('[POST /api/posts/generate] JSON invalide reçu de Claude :', raw)
      return NextResponse.json(
        { error: 'La réponse IA n\'était pas au format attendu. Réessayez.' },
        { status: 500 },
      )
    }

    // Retourne un texte par plateforme, prêt pour l'affichage en onglets dans AIAssistPanel
    return NextResponse.json({ texts })
  } catch (error) {
    console.error('[POST /api/posts/generate]', error)
    return NextResponse.json(
      { error: 'Erreur lors de la génération du texte' },
      { status: 500 },
    )
  }
}
