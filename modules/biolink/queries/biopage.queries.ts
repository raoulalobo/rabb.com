/**
 * @file modules/biolink/queries/biopage.queries.ts
 * @module biolink/queries
 * @description Clés TanStack Query du module Bio Link.
 *
 *   Le module privilégie `router.refresh()` après chaque Server Action pour
 *   la simplicité du MVP (pas de cache client à invalider côté TanStack).
 *   Toutefois on exporte tout de même une convention de clés pour le jour où
 *   on basculera sur des queries côté client (ex: slug availability debounced,
 *   chargement paginé des liens, etc.).
 *
 *   Convention clé : `['biopage', <entité>, ...args]`.
 *
 * @example
 *   import { biopageQueryKeys } from '@/modules/biolink/queries/biopage.queries'
 *   useQuery({ queryKey: biopageQueryKeys.slugCheck('mon-slug'), queryFn: ... })
 */

/**
 * Keys centralisées pour les requêtes TanStack Query du module Bio Link.
 * Regroupées dans un objet pour permettre une invalidation ciblée
 * (`queryClient.invalidateQueries({ queryKey: biopageQueryKeys.all })`).
 */
export const biopageQueryKeys = {
  /** Racine — invalide toutes les queries du module */
  all: ['biopage'] as const,

  /** Détail de la BioPage de l'utilisateur courant */
  detail: () => [...biopageQueryKeys.all, 'detail'] as const,

  /**
   * Check de disponibilité d'un slug précis.
   * @param slug - valeur saisie par l'utilisateur, utilisée comme cache key
   */
  slugCheck: (slug: string) => [...biopageQueryKeys.all, 'slug', slug] as const,
}
