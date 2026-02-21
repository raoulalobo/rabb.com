-- Refonte posts : 1 post = 1 plateforme (platform string au lieu de platforms[])
-- Suppression de AgentSession et PostPlatformContent

-- ── Étape 1 : Supprimer les FK avant de dropper les tables ──────────────────

ALTER TABLE "agent_sessions" DROP CONSTRAINT IF EXISTS "agent_sessions_postId_fkey";
ALTER TABLE "agent_sessions" DROP CONSTRAINT IF EXISTS "agent_sessions_userId_fkey";
ALTER TABLE "post_platform_contents" DROP CONSTRAINT IF EXISTS "post_platform_contents_postId_fkey";

-- ── Étape 2 : Supprimer les tables supprimées du modèle ──────────────────────

DROP TABLE IF EXISTS "agent_sessions";
DROP TABLE IF EXISTS "post_platform_contents";

-- ── Étape 3 : Supprimer les enums supprimés du modèle ───────────────────────

DROP TYPE IF EXISTS "AgentSessionStatus";
DROP TYPE IF EXISTS "PostPlatformStatus";

-- ── Étape 4 : Ajouter la colonne platform avec un DEFAULT temporaire ─────────
-- Nécessaire car la table a des lignes existantes (NOT NULL sans DEFAULT interdit)

ALTER TABLE "posts" ADD COLUMN "platform" TEXT NOT NULL DEFAULT '';

-- ── Étape 5 : Migrer les données — premier élément de platforms[] ────────────
-- Pour chaque post existant, utiliser la première plateforme du tableau

UPDATE "posts" SET "platform" = platforms[1] WHERE array_length(platforms, 1) > 0;

-- ── Étape 6 : Retirer le DEFAULT temporaire ──────────────────────────────────

ALTER TABLE "posts" ALTER COLUMN "platform" DROP DEFAULT;

-- ── Étape 7 : Supprimer l'ancienne colonne platforms ────────────────────────

ALTER TABLE "posts" DROP COLUMN "platforms";
