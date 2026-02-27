-- Migration : sécurisation complète de toutes les tables publiques
--
-- Contexte : ce projet utilise better-auth (pas Supabase Auth) et accède
-- à la base exclusivement via des Server Actions / API Routes Next.js avec
-- Prisma (DATABASE_URL = connexion directe, service_role). Aucun composant
-- client ne requête directement les tables via la clé `anon`.
--
-- Deux stratégies selon le type de table :
--
--   A. Tables internes (Prisma + better-auth) → REVOKE ALL
--      Ces tables ne doivent jamais être accessibles via PostgREST.
--
--   B. Tables données utilisateur → RLS activé (refus implicite)
--      RLS activé sans politique = aucun accès pour anon/authenticated.
--      Extensible facilement si on ajoute des politiques Supabase plus tard.
--      auth.uid() ne fonctionnerait pas (auth = better-auth, pas Supabase Auth)
--      donc toutes les lectures passent par service_role (bypass RLS).

-- ─────────────────────────────────────────────────────────────────────────────
-- A. Tables internes — REVOKE ALL
-- ─────────────────────────────────────────────────────────────────────────────

-- _prisma_migrations : table de suivi des migrations Prisma.
-- Expose l'historique exact de la structure DB → aide les attaquants.
REVOKE ALL ON public._prisma_migrations FROM anon, authenticated;

-- accounts : comptes OAuth better-auth (access_token, refresh_token).
-- Données hautement sensibles — jamais accessibles via API.
REVOKE ALL ON public.accounts FROM anon, authenticated;

-- verifications : codes de vérification email better-auth (tokens à usage unique).
-- Exposition = possible hijack de compte.
REVOKE ALL ON public.verifications FROM anon, authenticated;

-- sessions : jetons de session better-auth (déjà partiellement révoqué).
-- REVOKE ALL couvre TRUNCATE, REFERENCES, TRIGGER restants.
REVOKE ALL ON public.sessions FROM anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- B. Tables données utilisateur — RLS activé (refus implicite sans politique)
-- ─────────────────────────────────────────────────────────────────────────────

-- users : profils utilisateur (email, avatar, lateWorkspaceId…)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- posts : publications planifiées/publiées de l'utilisateur
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

-- connected_platforms : comptes réseaux sociaux connectés (tokens OAuth)
ALTER TABLE public.connected_platforms ENABLE ROW LEVEL SECURITY;

-- media : fichiers uploadés vers Supabase Storage
ALTER TABLE public.media ENABLE ROW LEVEL SECURITY;

-- notification_prefs : préférences de notification de l'utilisateur
ALTER TABLE public.notification_prefs ENABLE ROW LEVEL SECURITY;

-- signatures : signatures personnalisées par plateforme
ALTER TABLE public.signatures ENABLE ROW LEVEL SECURITY;
