-- AlterTable : ajouter contentType et threadItems au modèle Post
-- contentType : type de contenu (feed, story, reel, thread, carousel), default "feed"
-- threadItems : éléments d'un thread (JSON, tableau de textes), nullable

ALTER TABLE "posts" ADD COLUMN "contentType" TEXT NOT NULL DEFAULT 'feed';
ALTER TABLE "posts" ADD COLUMN "threadItems" JSONB;
