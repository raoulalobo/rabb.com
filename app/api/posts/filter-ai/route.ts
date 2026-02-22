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

import { AGENT_MODEL, anthropic } from '@/lib/ai'
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
          'Date de début ISO 8601 pour filtrer sur scheduledFor. ' +
          'Calculer depuis les expressions relatives (ex: "semaine prochaine"). ' +
          'Omettre si non spécifié.',
      },
      to: {
        type: 'string',
        description:
          'Date de fin ISO 8601 pour filtrer sur scheduledFor. ' +
          'Omettre si non spécifié.',
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
  dateRange: { from: string; to: string } | null
  /** Texte original de la requête utilisateur (pour affichage dans le bouton) */
  queryText: string
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

  // ── Date du jour (pour les expressions relatives : "cette semaine", "demain"…) ──
  const today = new Date().toISOString().split('T')[0]!

  // ── Prompt système ─────────────────────────────────────────────────────────
  const systemPrompt = [
    `Tu es un assistant d'extraction de filtres pour une application de planification de posts sur les réseaux sociaux.`,
    `Aujourd'hui est le ${today}.`,
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
  ].join('\n')

  // ── Appel Claude Sonnet ────────────────────────────────────────────────────
  try {
    const response = await anthropic.messages.create({
      model: AGENT_MODEL,
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
    }

    // ── Construction du résultat ────────────────────────────────────────────
    const filters: ExtractedFilters = {
      statuses: input.statuses ?? [],
      platforms: (input.platforms ?? []).map((p) => p.toLowerCase()),
      // Si `from` absent → pas de filtre date
      dateRange:
        input.from
          ? {
              from: input.from,
              // Si `to` absent (un seul jour) → utiliser `from` comme borne de fin
              to: input.to ?? input.from,
            }
          : null,
      queryText: query,
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
