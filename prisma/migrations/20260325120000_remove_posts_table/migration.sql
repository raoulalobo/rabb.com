-- Migration : Supprimer la table posts et l'enum PostStatus
-- Les posts sont désormais stockés exclusivement chez Zernio (source de vérité unique).

-- Supprimer les index
DROP INDEX IF EXISTS "posts_userId_status_idx";
DROP INDEX IF EXISTS "posts_scheduledFor_idx";

-- Supprimer la table posts
DROP TABLE IF EXISTS "posts";

-- Supprimer l'enum PostStatus
DROP TYPE IF EXISTS "PostStatus";
