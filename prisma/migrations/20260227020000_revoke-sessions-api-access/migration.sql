-- Migration : retirer public.sessions de l'API PostgREST
--
-- Contexte : la table `sessions` est gérée exclusivement par better-auth
-- via SUPABASE_SERVICE_ROLE_KEY côté serveur. Elle ne doit jamais être
-- accessible depuis le client Supabase (clé anon/authenticated).
--
-- Sans cette restriction, n'importe quel client peut lire tous les tokens
-- de session → usurpation d'identité possible.
--
-- Solution : révoquer tous les privilèges SQL sur la table pour les rôles
-- PostgREST (`anon` et `authenticated`). better-auth continue de fonctionner
-- car il utilise service_role qui n'est pas affecté par ce REVOKE.

REVOKE SELECT, INSERT, UPDATE, DELETE ON public.sessions FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.sessions FROM authenticated;
