/**
 * @file app/api/posts/filter-ai/route.ts
 * @description Route Handler POST : extraction de filtres structurés depuis une description
 *   en langage naturel, via Claude Sonnet (tool use).
 *
 *   Flow :
 *   1. Authentification better-auth
 *   2. Validation Zod du body ({ query: string })
 *   3. Appel Claude Sonnet avec tool "extract_post_filters"
 *   4. Extraction du résultat tool_use → filtres structurés
 *   5. Retour { statuses, platforms, dateRange, queryText }
 *
 *   Les filtres retournés sont appliqués côté serveur via /api/posts?compose=1&statuses=...
 *   DRAFT, SCHEDULED, PUBLISHED et FAILED sont des statuts valides (mode compose).
 *
 * @example
 *   const res = await fetch('/api/posts/filter-ai', {
 *     method: 'POST',
 *     body: JSON.stringify({ query: 'mes brouillons TikTok de la semaine prochaine' }),
 *   })
 *   const filters = await res.json()
 *   // → { statuses: ['DRAFT'], platforms: ['tiktok'], dateRange: { from: '...', to: '...' }, queryText: '...' }
 */

import { headers } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { FILTER_MODEL, anthropic } from '@/lib/ai'
import { auth } from '@/lib/auth'

// ─── Schéma du body entrant ────────────────────────────────────────────────────

/**
 * Validation Zod du body POST.
 * `query` : description en langage naturel de ce que l'utilisateur cherche.
 */
const BodySchema = z.object({
  query: z.string().min(1).max(500),
})

// ─── Définition de l'outil Sonnet ──────────────────────────────────────────────

/**
 * Outil Claude "extract_post_filters".
 * Sonnet utilise cet outil pour retourner des filtres structurés
 * extraits depuis la description de l'utilisateur.
 *
 * Tous les champs sont optionnels : Sonnet ne retourne que ce qu'il détecte.
 * Exemple : "posts instagram" → { platforms: ['instagram'] } (pas de statuses ni de dates)
 */
const filterTool = {
  name: 'extract_post_filters',
  description:
    'Extrait les critères de recherche depuis la description utilisateur pour filtrer ' +
    'une liste de posts (brouillons, planifiés, publiés ou échoués).',
  input_schema: {
    type: 'object' as const,
    properties: {
      statuses: {
        type: 'array',
        items: {
          type: 'string',
          enum: ['DRAFT', 'SCHEDULED', 'PUBLISHED', 'FAILED'],
        },
        description:
          'Statuts des posts : DRAFT = brouillon, SCHEDULED = planifié, ' +
          'PUBLISHED = publié avec succès, FAILED = échec de publication. ' +
          'Omettre si non spécifié.',
      },
      platforms: {
        type: 'array',
        items: { type: 'string' },
        description:
          'Plateformes mentionnées (ex: instagram, tiktok, youtube, facebook, ' +
          'twitter, linkedin, pinterest, threads…). Omettre si non spécifié.',
      },
      from: {
        type: 'string',
        description:
          'Date (et heure optionnelle) de début ISO 8601 pour filtrer sur scheduledFor. ' +
          'Calculer depuis les expressions relatives (ex: "semaine prochaine"). ' +
          "Inclure l'heure si l'utilisateur la mentionne. " +
          // ⚠️ Les heures sont en heure PARIS : les convertir en UTC (soustraire l'offset Paris actuel)
          "Convertir l'heure locale Paris en UTC (soustraire l'offset Paris actuel). " +
          'Omettre si non spécifié.',
      },
      to: {
        type: 'string',
        description:
          'Date (et heure optionnelle) de fin ISO 8601 pour filtrer sur scheduledFor. ' +
          "Inclure l'heure si l'utilisateur la mentionne. " +
          // ⚠️ Les heures sont en heure PARIS : les convertir en UTC (soustraire l'offset Paris actuel)
          "Convertir l'heure locale Paris en UTC (soustraire l'offset Paris actuel). " +
          'Omettre si la plage est ouverte vers le futur (ex: "depuis le X"). ' +
          'Ne fournir que si une borne de fin est explicitement mentionnée.',
      },
      search: {
        type: 'string',
        description:
          'Mots-clés à rechercher dans le texte des posts, séparés par un espace. ' +
          'Extraire TOUS les sujets mentionnés (un ou plusieurs). ' +
          'Exemple : "foot", "promo soldes", "lancement produit". ' +
          "Omettre si aucun sujet de contenu n'est mentionné.",
      },
    },
    // Tous les champs sont optionnels — Sonnet ne retourne que ce qu'il détecte
    required: [] as string[],
  },
}

// ─── Type retourné ─────────────────────────────────────────────────────────────

/**
 * Filtres structurés extraits par Sonnet depuis la requête en langage naturel.
 * Exporté pour être utilisé dans AIFilterModal et PostComposeList.
 */
export interface ExtractedFilters {
  /** Statuts filtrés — vide = tout afficher (DRAFT + SCHEDULED par défaut) */
  statuses: ('DRAFT' | 'SCHEDULED' | 'PUBLISHED' | 'FAILED')[]
  /** Plateformes filtrées — vide = tout afficher */
  platforms: string[]
  /**
   * Intervalle de date sur scheduledFor — null = pas de filtre date.
   * Sérialisé en ISO string (JSON) ; le client reconvertit en Date.
   */
  /**
   * `to` est optionnel : absent = plage ouverte vers le futur (ex: "depuis le X").
   * Le pipeline aval (queries, API route) n'applique pas de borne `lte` si `to` est absent.
   */
  dateRange: { from: string; to?: string } | null
  /** Texte original de la requête utilisateur (pour affichage dans le bouton) */
  queryText: string
  /** Mot-clé de contenu extrait par Claude — undefined si aucun sujet mentionné */
  search?: string
}

// ─── Handler POST ──────────────────────────────────────────────────────────────

/**
 * POST /api/posts/filter-ai
 * Extrait des filtres structurés depuis une description en langage naturel.
 *
 * @param request - Corps : { query: string }
 * @returns 200 ExtractedFilters | 400 requête invalide | 401 non authentifié | 500 erreur Sonnet
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  // ── Authentification ───────────────────────────────────────────────────────
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  // ── Validation du body ─────────────────────────────────────────────────────
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body JSON invalide' }, { status: 400 })
  }

  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Requête invalide', details: parsed.error.issues },
      { status: 400 },
    )
  }

  const { query } = parsed.data

  // ── Date du jour en heure locale Paris (Europe/Paris) ─────────────────────
  // ⚠️ Ne PAS utiliser new Date().toISOString() : retourne la date UTC, qui peut
  //    être le jour PRÉCÉDENT pour un utilisateur parisien entre minuit et 1h00.
  //    Exemple : 00h30 Paris (mardi 24) = 23h30 UTC (lundi 23) → LLM croirait
  //    que c'est lundi, calculerait "mercredi prochain" = mercredi 25 au lieu de 25 ✓,
  //    mais "demain" = mardi 24 au lieu de mercredi 25.
  //
  //    Solution : Intl.DateTimeFormat avec timeZone: 'Europe/Paris' donne toujours
  //    la date locale correcte indépendamment du fuseau du serveur (UTC ou Paris).
  const now = new Date()
  const parisParts = new Intl.DateTimeFormat('fr-FR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'long',
    timeZone: 'Europe/Paris',
  }).formatToParts(now)
  const p = Object.fromEntries(parisParts.map((x) => [x.type, x.value]))
  // Reconstruire en ISO YYYY-MM-DD (fr-FR donne jour/mois/année, donc on inverse)
  const todayIso = `${p.year}-${p.month}-${p.day}`
  const todayLabel = `${todayIso} (${p.weekday})`

  // ── Offset UTC pour Europe/Paris ─────────────────────────────────────────
  // CET (hiver) = UTC+1, CEST (été) = UTC+2. Nécessaire pour demander à Claude
  // de convertir les heures locales Paris en UTC dans les timestamps ISO.
  // Intl.DateTimeFormat 'shortOffset' retourne "UTC+1" ou "UTC+2" selon la saison.
  const parisOffsetLabel =
    new Intl.DateTimeFormat('fr-FR', {
      timeZone: 'Europe/Paris',
      timeZoneName: 'shortOffset',
    })
      .formatToParts(now)
      .find((x) => x.type === 'timeZoneName')?.value ?? 'UTC+1'

  // Extraire la valeur numérique : "UTC+1" → 1, "UTC+2" → 2
  const parisOffsetHours = parseInt(parisOffsetLabel.replace('UTC', ''), 10) || 1

  // Helper local : convertit une heure Paris (entier) en heure UTC string "HH"
  // Exemple (UTC+1) : h(10) → "09", h(14) → "13"
  const h = (local: number): string => String(local - parisOffsetHours).padStart(2, '0')

  // ── Prompt système ─────────────────────────────────────────────────────────
  const systemPrompt = [
    `Tu es un assistant d'extraction de filtres pour une application de planification de posts sur les réseaux sociaux.`,
    `Aujourd'hui est le ${todayLabel}.`,
    // ── Règle timezone ──────────────────────────────────────────────────────
    // Les posts sont stockés en UTC, mais l'utilisateur raisonne en heure Paris.
    // Claude DOIT soustraire l'offset pour produire le bon timestamp ISO UTC.
    `L'utilisateur est en heure locale Paris (Europe/Paris, actuellement ${parisOffsetLabel}).`,
    `⚠️ RÈGLE TIMEZONE OBLIGATOIRE : Toutes les heures que l'utilisateur mentionne sont en heure PARIS, PAS en UTC.`,
    `Tu DOIS convertir les heures Paris en UTC dans les timestamps ISO en soustrayant ${parisOffsetHours}h.`,
    `Exemple de conversion : l'utilisateur dit "10h" → timestamp ISO = "T${h(10)}:00:00Z" (10h Paris − ${parisOffsetHours}h = ${h(10)}h UTC).`,
    `L'utilisateur décrit ce qu'il cherche dans sa liste de posts (brouillons, planifiés, publiés ou échoués).`,
    `Utilise TOUJOURS le tool extract_post_filters pour retourner les filtres structurés.`,
    `N'extrais que ce qui est explicitement mentionné ou clairement implicite.`,
    `Si un critère n'est pas spécifié, ne l'inclus pas dans le résultat.`,
    `Pour les dates relatives (ex: "semaine prochaine", "ce mois-ci", "demain"), calcule les dates ISO 8601.`,
    `Exemples :`,
    `- "mes brouillons" → { statuses: ["DRAFT"] }`,
    `- "posts tiktok planifiés" → { statuses: ["SCHEDULED"], platforms: ["tiktok"] }`,
    `- "posts instagram de la semaine prochaine" → { platforms: ["instagram"], from: "...", to: "..." }`,
    `- "tiktok" → { platforms: ["tiktok"] }`,
    `- "posts échoués" → { statuses: ["FAILED"] }`,
    `- "posts publiés cette semaine" → { statuses: ["PUBLISHED"], from: "...", to: "..." }`,
    `- "posts sur le foot" → { search: "foot" }`,
    `- "posts sur le foot et le basket" → { search: "foot basket" }`,
    `- "posts avec promo soldes" → { search: "promo soldes" }`,
    `- "posts instagram sur le lancement produit" → { platforms: ["instagram"], search: "lancement produit" }`,
    // Exemples de plages ouvertes (sans `to`) — crucial pour éviter le fallback to=from
    `- "posts depuis le 24 février" → { from: "2026-02-24" }  // pas de \`to\` = ouvert vers le futur`,
    `- "posts depuis lundi" → { from: "2026-02-23" }          // pas de \`to\``,
    `- "posts entre le 1er et le 10 mars" → { from: "2026-03-01", to: "2026-03-10" }`,
    // Exemples avec granularité heure — heures Paris converties en UTC via offset dynamique
    // h(N) soustrait parisOffsetHours pour produire le bon timestamp UTC
    `- "posts du 24 février entre 14h et 20h" → { from: "2026-02-24T${h(14)}:00:00Z", to: "2026-02-24T${h(20)}:00:00Z" }  // ${parisOffsetLabel} : −${parisOffsetHours}h`,
    `- "posts entre le 21 février 17h et le 25 février 23h" → { from: "2026-02-21T${h(17)}:00:00Z", to: "2026-02-25T${h(23)}:00:00Z" }`,
    `- "posts publiés hier après 18h" → { statuses: ["PUBLISHED"], from: "2026-02-24T${h(18)}:00:00Z" }`,
  ].join('\n')

  // ── Appel Claude Sonnet ────────────────────────────────────────────────────
  try {
    const response = await anthropic.messages.create({
      model: FILTER_MODEL,
      max_tokens: 512,
      system: systemPrompt,
      tools: [filterTool],
      // Force Sonnet à utiliser l'outil (pas de réponse texte libre)
      tool_choice: { type: 'any' },
      messages: [{ role: 'user', content: query }],
    })

    // ── Extraction du résultat tool_use ─────────────────────────────────────
    const toolUse = response.content.find((block) => block.type === 'tool_use')
    if (!toolUse || toolUse.type !== 'tool_use') {
      return NextResponse.json(
        { error: 'Impossible d\'extraire les filtres depuis la description' },
        { status: 500 },
      )
    }

    // Cast du résultat Sonnet (input_schema garantit la structure)
    const input = toolUse.input as {
      statuses?: ('DRAFT' | 'SCHEDULED' | 'PUBLISHED' | 'FAILED')[]
      platforms?: string[]
      from?: string
      to?: string
      search?: string
    }

    // ── Construction du résultat ────────────────────────────────────────────
    const filters: ExtractedFilters = {
      statuses: input.statuses ?? [],
      platforms: (input.platforms ?? []).map((p) => p.toLowerCase()),
      // Si `from` absent → pas de filtre date.
      // `to` n'est inclus que si Claude l'a explicitement fourni :
      //   absent = plage ouverte vers le futur (ex: "depuis le 24 février").
      dateRange: input.from
        ? { from: input.from, ...(input.to ? { to: input.to } : {}) }
        : null,
      queryText: query,
      // Normalisation en minuscules pour correspondre au filtre Prisma insensible à la casse
      search: input.search?.toLowerCase(),
    }

    return NextResponse.json(filters)
  } catch (error) {
    console.error('[filter-ai] Erreur Sonnet :', error)
    return NextResponse.json(
      { error: 'Erreur lors de l\'appel à l\'IA. Veuillez réessayer.' },
      { status: 500 },
    )
  }
}
